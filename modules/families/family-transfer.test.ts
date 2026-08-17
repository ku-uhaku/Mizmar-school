import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Moving a dossier familial to another school.
 *
 * A dossier is identity — who the household is, which adults are on it, which
 * children belong to it — and identity is not a fact about a school year, which
 * is the only reason it can move at all. Two things follow, and they are what
 * this file pins.
 *
 * **Nothing year-bound or money-bound may go with it.** An `Enrollment` names a
 * level of one school's cursus and carries a whole fee schedule; a `Payment` was
 * taken into one school's caisse. Carried across, a receipt in one till would be
 * made out to another school's family and no reconciliation would balance.
 *
 * **A school's own lists are its own.** `City`, `Neighbourhood`, `ParentJob` and
 * `DocumentType` are school-scoped on purpose, so every reference to one has to
 * be re-matched by name in the new school's list — and cleared when it has no
 * counterpart, rather than left pointing at another school's row.
 */

type Call = { model: string; op: string; args: Record<string, unknown> };

const calls: Call[] = [];
let answers: Record<string, (args: Record<string, unknown>) => unknown> = {};

const client = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_m, op: string) => async (args: Record<string, unknown> = {}) => {
            calls.push({ model, op, args });
            const answer = answers[`${model}.${op}`];
            return answer ? answer(args) : null;
          },
        },
      ),
  },
);

const db = new Proxy(
  {},
  {
    get: (_target, key: string) => {
      if (key === "$transaction") {
        return async (run: (tx: unknown) => Promise<unknown>) => run(client);
      }
      return (client as Record<string, unknown>)[key];
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({
    familyCodeFormat: "F-{year}-{seq:4}",
    studentCodeFormat: "E-{year}-{seq:4}",
  }),
}));
vi.mock("@/lib/auth", () => ({
  generatePassword: () => "password",
  hashPassword: async (plain: string) => `hashed:${plain}`,
}));
vi.mock("@/modules/users/service", () => ({
  allocateUsername: async () => "f-2026-0042",
  createLoginAccount: async () => ({ ok: false, reason: "no-username" }),
}));

const { transferFamily } = await import("@/modules/families/service");

const ORG = "org-1";
const FROM = "school-from";
const TO = "school-to";

/** A child with nothing hanging off, and no references to anybody's lists. */
function child(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    code: "E-2026-0031",
    birthCityId: null,
    previousSchoolCityId: null,
    neighbourhoodId: null,
    _count: { enrollments: 0, documentRequests: 0 },
    documents: [],
    ...overrides,
  };
}

function dossier(overrides: Record<string, unknown> = {}) {
  return {
    id: "family-1",
    code: "F-2026-0042",
    school: { organizationId: ORG },
    _count: { payments: 0 },
    guardians: [{ id: "guardian-1", parentJobId: null, userId: null }],
    children: [child()],
    ...overrides,
  };
}

type Lists = {
  oldCities?: { id: string; name: string }[];
  newCities?: { id: string; name: string }[];
  oldNeighbourhoods?: { id: string; name: string; city: { name: string } }[];
  newNeighbourhoods?: { id: string; name: string; city: { name: string } }[];
  oldJobs?: { id: string; name: string }[];
  newJobs?: { id: string; name: string }[];
  oldTypes?: { id: string; code: string }[];
  newTypes?: { id: string; code: string }[];
};

/**
 * Scripts the reads. Each list is asked twice — once for the rows the dossier
 * points at, once for the target school's whole list — told apart by whether the
 * `where` names the school, exactly as the code asks them.
 */
function scriptReads({
  family = dossier(),
  codeTaken = false,
  takenChildCodes = [] as string[],
  targetOrganizationId = ORG as string | null,
  lists = {} as Lists,
}: {
  family?: unknown;
  codeTaken?: boolean;
  takenChildCodes?: string[];
  targetOrganizationId?: string | null;
  lists?: Lists;
} = {}) {
  const bySchool =
    <T>(old: T[], fresh: T[]) =>
    (args: Record<string, unknown>) => {
      const where = (args["where"] ?? {}) as { schoolId?: string };
      return where.schoolId === TO ? fresh : old;
    };

  answers = {
    "family.findFirst": (args) => {
      const where = args["where"] as { schoolId?: string };
      // The second question this serves: is the dossier number free over there.
      if (where.schoolId === TO) return codeTaken ? { id: "other" } : null;
      return family;
    },
    "school.findUnique": () =>
      targetOrganizationId === null
        ? null
        : { organizationId: targetOrganizationId },
    "city.findMany": bySchool(lists.oldCities ?? [], lists.newCities ?? []),
    "neighbourhood.findMany": bySchool(
      lists.oldNeighbourhoods ?? [],
      lists.newNeighbourhoods ?? [],
    ),
    "parentJob.findMany": bySchool(lists.oldJobs ?? [], lists.newJobs ?? []),
    "documentType.findMany": bySchool(lists.oldTypes ?? [], lists.newTypes ?? []),
    "student.findMany": () => takenChildCodes.map((code) => ({ code })),
    "family.findMany": () => [],
    "family.update": () => ({ id: "family-1" }),
    "student.update": () => ({ id: "student-1" }),
    "studentDocument.update": () => ({ id: "document-1" }),
    "guardian.update": () => ({ id: "guardian-1" }),
    "user.updateMany": () => ({ count: 1 }),
  };
}

/** Whether a `student.findMany` is the "is this code taken over there" scan. */
function isClashScan(args: Record<string, unknown>): boolean {
  const where = (args["where"] ?? {}) as { code?: { in?: string[] } };
  return Array.isArray(where.code?.in);
}

const wrote = (model: string, op: string) =>
  calls.find((call) => call.model === model && call.op === op);
const allWrites = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);
const blockersOf = (result: Awaited<ReturnType<typeof transferFamily>>) =>
  result.ok === false && "blockers" in result ? result.blockers : [];

const move = () =>
  transferFamily({ familyId: "family-1", fromSchoolId: FROM, toSchoolId: TO });

beforeEach(() => {
  calls.length = 0;
  scriptReads();
});

// ── What refuses to move ─────────────────────────────────────────────────────

describe("what keeps a dossier where it is", () => {
  it("refuses the school it is already at", async () => {
    const result = await transferFamily({
      familyId: "family-1",
      fromSchoolId: FROM,
      toSchoolId: FROM,
    });

    expect(result).toEqual({ ok: false, reason: "same-school" });
    expect(calls).toEqual([]);
  });

  it("refuses a school in another organisation", async () => {
    scriptReads({ targetOrganizationId: "org-2" });
    expect(await move()).toEqual({ ok: false, reason: "other-organisation" });
    expect(wrote("family", "update")).toBeUndefined();
  });

  it("refuses a dossier of another school", async () => {
    scriptReads({ family: null });
    expect(await move()).toEqual({ ok: false, reason: "not-found" });
  });

  it("refuses once a child is enrolled", async () => {
    // The enrolment names a level of this school's cursus, a class of its own
    // drawing-up and a year of fee lines. None of that can follow, so the honest
    // move from here is a transfer proper: withdraw here, admit there.
    scriptReads({
      family: dossier({
        children: [child({ _count: { enrollments: 1, documentRequests: 0 } })],
      }),
    });

    const result = await move();
    expect(blockersOf(result)).toEqual(["enrolments"]);
    expect(wrote("family", "update")).toBeUndefined();
  });

  it("refuses once a receipt has been made out to it", async () => {
    scriptReads({ family: dossier({ _count: { payments: 2 } }) });
    expect(blockersOf(await move())).toEqual(["payments"]);
  });

  it("refuses when papers have been asked of this school", async () => {
    scriptReads({
      family: dossier({
        children: [child({ _count: { enrollments: 0, documentRequests: 1 } })],
      }),
    });
    expect(blockersOf(await move())).toEqual(["requests"]);
  });

  it("refuses a pièce of a type the other school does not keep", async () => {
    // `StudentDocument.documentTypeId` is required, so there is nothing to fall
    // back to — emptying the dossier's pièces silently would be worse.
    scriptReads({
      family: dossier({
        children: [
          child({ documents: [{ id: "document-1", documentTypeId: "type-old" }] }),
        ],
      }),
      lists: {
        oldTypes: [{ id: "type-old", code: "CIN" }],
        newTypes: [{ id: "type-new", code: "ACTE" }],
      },
    });

    expect(blockersOf(await move())).toEqual(["documents"]);
    expect(wrote("student", "update")).toBeUndefined();
  });

  it("names every blocker at once, not the first", async () => {
    scriptReads({
      family: dossier({
        _count: { payments: 1 },
        children: [child({ _count: { enrollments: 1, documentRequests: 1 } })],
      }),
    });

    expect(blockersOf(await move())).toEqual([
      "enrolments",
      "payments",
      "requests",
    ]);
  });
});

// ── What moves with it ───────────────────────────────────────────────────────

describe("moving a clean dossier", () => {
  it("re-points the household and its children", async () => {
    const result = await move();

    expect(result).toMatchObject({
      ok: true,
      code: "F-2026-0042",
      recoded: false,
      childCount: 1,
      recodedChildren: 0,
    });
    expect(wrote("family", "update")?.args).toMatchObject({
      where: { id: "family-1" },
      data: { schoolId: TO, code: "F-2026-0042" },
    });
    expect(wrote("student", "update")?.args).toMatchObject({
      where: { id: "student-1" },
      data: { schoolId: TO, code: "E-2026-0031" },
    });
  });

  it("reissues the dossier number when the new school already used it", async () => {
    scriptReads({ codeTaken: true });
    answers["family.findMany"] = () => [{ code: "F-2026-0100" }];

    const result = await move();

    expect(result).toMatchObject({ ok: true, code: "F-2026-0101", recoded: true });
  });

  it("reissues a child's matricule only when it is taken over there", async () => {
    scriptReads({
      family: dossier({
        children: [
          child({ id: "student-1", code: "E-2026-0031" }),
          child({ id: "student-2", code: "E-2026-0032" }),
        ],
      }),
      takenChildCodes: ["E-2026-0031"],
    });
    // Two questions through one door, told apart the way they are asked: the
    // clash scan matches `code: { in: [...] }`, the allocator's own read of the
    // school's issued numbers matches `code: { startsWith }`.
    answers["student.findMany"] = (args) =>
      isClashScan(args) ? [{ code: "E-2026-0031" }] : [{ code: "E-2026-0044" }];

    const result = await move();

    expect(result).toMatchObject({ ok: true, childCount: 2, recodedChildren: 1 });
    const writes = allWrites("student", "update");
    expect(writes[0]?.args).toMatchObject({
      where: { id: "student-1" },
      data: { code: "E-2026-0045" },
    });
    // Left alone: nothing over there is using it.
    expect(writes[1]?.args).toMatchObject({
      where: { id: "student-2" },
      data: { code: "E-2026-0032" },
    });
  });

  it("hands two clashing children different numbers", async () => {
    /*
      The allocator reads a table this loop has not written to yet, so both
      children would otherwise be offered the same next number — and the unique
      index would refuse the second half of the move after the first half had
      been written.
    */
    scriptReads({
      family: dossier({
        children: [
          child({ id: "student-1", code: "E-2026-0031" }),
          child({ id: "student-2", code: "E-2026-0032" }),
        ],
      }),
    });
    answers["student.findMany"] = (args) =>
      isClashScan(args)
        ? [{ code: "E-2026-0031" }, { code: "E-2026-0032" }]
        : [{ code: "E-2026-0044" }];

    const result = await move();

    expect(result).toMatchObject({ ok: true, recodedChildren: 2 });
    const codes = allWrites("student", "update").map(
      (call) => (call.args["data"] as { code: string }).code,
    );
    expect(new Set(codes).size).toBe(2);
    expect(codes).toEqual(["E-2026-0045", "E-2026-0046"]);
  });

  it("re-matches the school's own lists by name", async () => {
    // Two schools each keep their own towns and professions, deliberately. The
    // rows are different rows; the name is what makes them the same place.
    scriptReads({
      family: dossier({
        guardians: [{ id: "guardian-1", parentJobId: "job-old", userId: null }],
        children: [
          child({ birthCityId: "city-old", neighbourhoodId: "quartier-old" }),
        ],
      }),
      lists: {
        oldCities: [{ id: "city-old", name: "Oujda" }],
        newCities: [{ id: "city-new", name: "Oujda" }],
        oldNeighbourhoods: [
          { id: "quartier-old", name: "Centre", city: { name: "Oujda" } },
        ],
        newNeighbourhoods: [
          { id: "quartier-new", name: "Centre", city: { name: "Oujda" } },
        ],
        oldJobs: [{ id: "job-old", name: "Enseignant" }],
        newJobs: [{ id: "job-new", name: "Enseignant" }],
      },
    });

    const result = await move();

    expect(result).toMatchObject({ ok: true, clearedReferences: 0 });
    expect(wrote("student", "update")?.args).toMatchObject({
      data: { birthCityId: "city-new", neighbourhoodId: "quartier-new" },
    });
    expect(wrote("guardian", "update")?.args).toMatchObject({
      data: { parentJobId: "job-new" },
    });
  });

  it("does not match a quartier of the same name in another town", async () => {
    // Both schools keep a "Centre" and they are not the same place, so the town
    // is part of the key.
    scriptReads({
      family: dossier({
        children: [child({ neighbourhoodId: "quartier-old" })],
      }),
      lists: {
        oldNeighbourhoods: [
          { id: "quartier-old", name: "Centre", city: { name: "Oujda" } },
        ],
        newNeighbourhoods: [
          { id: "quartier-new", name: "Centre", city: { name: "Casablanca" } },
        ],
      },
    });

    const result = await move();

    expect(result).toMatchObject({ ok: true, clearedReferences: 1 });
    expect(wrote("student", "update")?.args).toMatchObject({
      data: { neighbourhoodId: null },
    });
  });

  it("clears what the new school has never heard of, and counts it", async () => {
    // Reported rather than swallowed: the office has to go and re-pick them, and
    // leaving them pointing at another school's rows would put one school's list
    // on another school's screen.
    scriptReads({
      family: dossier({
        guardians: [{ id: "guardian-1", parentJobId: "job-old", userId: null }],
        children: [
          child({
            birthCityId: "city-old",
            previousSchoolCityId: "city-other",
          }),
        ],
      }),
      lists: {
        oldCities: [
          { id: "city-old", name: "Oujda" },
          { id: "city-other", name: "Berkane" },
        ],
        newCities: [],
        oldJobs: [{ id: "job-old", name: "Enseignant" }],
        newJobs: [],
      },
    });

    const result = await move();

    expect(result).toMatchObject({ ok: true, clearedReferences: 3 });
    expect(wrote("student", "update")?.args).toMatchObject({
      data: { birthCityId: null, previousSchoolCityId: null },
    });
    expect(wrote("guardian", "update")?.args).toMatchObject({
      data: { parentJobId: null },
    });
  });

  it("re-points a pièce onto the same type in the new school", async () => {
    scriptReads({
      family: dossier({
        children: [
          child({ documents: [{ id: "document-1", documentTypeId: "type-old" }] }),
        ],
      }),
      lists: {
        oldTypes: [{ id: "type-old", code: "CIN" }],
        newTypes: [{ id: "type-new", code: "CIN" }],
      },
    });

    expect(await move()).toMatchObject({ ok: true });
    expect(wrote("studentDocument", "update")?.args).toMatchObject({
      where: { id: "document-1" },
      data: { documentTypeId: "type-new" },
    });
  });

  it("carries the portal login's context over and forgets the year with it", async () => {
    // A guardian holds no membership — everything they read is scoped by the
    // household — so the context is the only thing naming the old school, and
    // the year inside it belongs to a school this account no longer touches.
    scriptReads({
      family: dossier({
        guardians: [{ id: "guardian-1", parentJobId: null, userId: "user-1" }],
      }),
    });

    await move();

    expect(wrote("user", "updateMany")?.args).toMatchObject({
      where: { id: { in: ["user-1"] }, currentSchoolId: FROM },
      data: { currentSchoolId: TO, currentSchoolYearId: null },
    });
  });

  it("touches no account when the dossier has no login", async () => {
    await move();
    expect(wrote("user", "updateMany")).toBeUndefined();
  });

  it("moves a dossier with no children yet", async () => {
    // The common shape of the mistake: a file opened, the school noticed, and
    // nobody enrolled in between.
    scriptReads({ family: dossier({ children: [] }) });

    const result = await move();

    expect(result).toMatchObject({ ok: true, childCount: 0 });
    expect(wrote("student", "update")).toBeUndefined();
  });
});
