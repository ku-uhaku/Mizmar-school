import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { levelSubjectScopeKey } from "@/modules/academics/enums";
import { CYCLE_CATALOGUE, MOROCCAN_CURSUS, SUBJECTS } from "@/modules/academics/presets";
import { feeRateScopeKey } from "@/modules/billing/enums";
import { offeringScopeKey } from "@/modules/classes/enums";
import { classCodesFor, programmeFor, suggestedRooms } from "@/modules/setup/catalogue";
import { slotsForBell } from "@/modules/setup/bell";

/**
 * The setup wizard: one submit, nineteen tables, one transaction.
 *
 * Three things here are not checkable by types and are the whole reason this
 * file exists. The parallel arrays the programme step posts must zip by index
 * or every coefficient lands on the wrong subject. The denormalised `schoolId`
 * and the three `scopeKey`s must come from the transaction and their helpers,
 * never from the form. And every write must be an upsert, because the wizard
 * is re-runnable on a school somebody has already started editing.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: Record<string, unknown> }[] = [];
let answers: Record<string, unknown> = {};

/** Ids the fake client hands back, so the applier's own maps are exercised. */
let nextId = 0;

const client = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: Record<string, unknown>) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            if (op === "findMany") return [];
            if (op === "count") return 0;
            if (op === "findFirst" || op === "findUnique") return null;
            if (op === "updateMany") return { count: 0 };
            nextId += 1;
            return { id: `${model}-${nextId}` };
          },
        },
      ),
  },
);

const db = new Proxy(
  {},
  {
    get: (_target, prop: string) => {
      if (prop === "$transaction") {
        return async (run: (tx: unknown) => Promise<unknown>) => run(client);
      }
      return (client as Record<string, unknown>)[prop];
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

const granted = new Set<string>();
const askedOrg: string[] = [];
const askedSchool: string[] = [];

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super("Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

const context = {
  user: { id: "user-1" },
  organization: { id: "org-1" },
  currentSchool: null,
};

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  authorizeOrg: async (permission: string) => {
    askedOrg.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return context;
  },
  authorizeSchool: async (_schoolId: string, permission: string) => {
    askedSchool.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return context;
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

/** `redirect` throws in Next; the action's success path ends in one. */
class RedirectError extends Error {
  readonly digest: string;
  constructor(readonly to: string) {
    super("redirect");
    this.digest = `NEXT_REDIRECT;${to}`;
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

const { applySetup } = await import("@/modules/setup/service");
const { runSetupAction } = await import("@/modules/setup/actions");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const IDLE = { status: "idle" } as never;

beforeEach(() => {
  calls.length = 0;
  askedOrg.length = 0;
  askedSchool.length = 0;
  answers = {};
  granted.clear();
  nextId = 0;
});

// ── The catalogue is the only source of truth ────────────────────────────────

describe("the cursus preset", () => {
  it("still lays down the demonstration's cursus, préscolaire excluded", () => {
    // The extraction into presets.ts derives Level.position and
    // LevelSubject.position from these array lengths and orders, so a change
    // here silently renumbers every seeded school.
    expect(MOROCCAN_CURSUS.cycles).toHaveLength(3);
    expect(MOROCCAN_CURSUS.levels).toHaveLength(12);
    expect(MOROCCAN_CURSUS.tracks).toHaveLength(9);
    expect(MOROCCAN_CURSUS.subjects).toHaveLength(20);
    expect(MOROCCAN_CURSUS.programme).toHaveLength(154);

    expect(MOROCCAN_CURSUS.cycles.map((cycle) => cycle.cycle)).not.toContain("PRESCHOOL");
    expect(MOROCCAN_CURSUS.levels.map((level) => level.code)).toEqual([
      "1AP", "2AP", "3AP", "4AP", "5AP", "6AP",
      "1AC", "2AC", "3AC",
      "TC", "1BAC", "2BAC",
    ]);
  });

  it("offers préscolaire to the wizard even though the seed skips it", () => {
    expect(CYCLE_CATALOGUE.PRESCHOOL.levels.map((level) => level.code)).toEqual(["PS", "GS"]);
    expect(CYCLE_CATALOGUE.PRESCHOOL.tracks).toHaveLength(0);
    expect(CYCLE_CATALOGUE.PRESCHOOL.programme.length).toBeGreaterThan(0);
  });

  it("keeps every component after its parent", () => {
    for (const [index, subject] of SUBJECTS.entries()) {
      if (!subject.parent) continue;
      const parentIndex = SUBJECTS.findIndex((item) => item.code === subject.parent);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    }
  });

  it("drops programme rows of a filière the school did not take", () => {
    const withTrack = programmeFor(["2BAC"], ["2B-SVT"]);
    expect(withTrack.some((row) => row.trackCode === "2B-SVT")).toBe(true);
    expect(withTrack.some((row) => row.trackCode === "2B-PC")).toBe(false);

    // The common rows survive either way — that is what makes unticking a
    // filière cost the school nothing it still teaches.
    expect(withTrack.some((row) => row.trackCode === null)).toBe(true);
  });

  it("offers a lab only when the programme needs one", () => {
    const withScience = suggestedRooms({
      cycles: ["SECONDARY_QUALIFYING"],
      classCountByCycle: { SECONDARY_QUALIFYING: 2 },
      subjectCodes: ["SVT", "PC"],
    });
    expect(withScience.some((room) => room.kind === "LAB_SCIENCE")).toBe(true);
    expect(withScience.some((room) => room.kind === "LAB_COMPUTER")).toBe(false);

    const preschool = suggestedRooms({
      cycles: ["PRESCHOOL"],
      classCountByCycle: { PRESCHOOL: 2 },
      subjectCodes: ["AR", "FR"],
    });
    expect(preschool.some((room) => room.kind === "LAB_SCIENCE")).toBe(false);
    expect(preschool.filter((room) => room.kind === "CLASSROOM")).toHaveLength(2);
  });

  it("names classes the way seedClasses does", () => {
    expect(classCodesFor("3AP", null, 2)).toEqual(["3AP-A", "3AP-B"]);
    expect(classCodesFor("2BAC", "2B-SVT", 1)).toEqual(["2BAC-2B-SVT-A"]);
    expect(classCodesFor("3AP", null, 0)).toEqual([]);
  });
});

// ── The bell ─────────────────────────────────────────────────────────────────

describe("the bell schedule", () => {
  const bell = {
    teachingDays: [1, 2, 3, 4, 5, 6],
    dayStartsAt: "08:00",
    afternoonStartsAt: "14:00",
    periodMinutes: 60,
    morningPeriods: 4,
    afternoonPeriods: 4,
    periodsBeforeBreak: 2,
    breakMinutes: 15,
    saturdayMorningOnly: true,
    withRamadan: false,
    ramadanStartsAt: "09:00",
    ramadanPeriods: 0,
  };

  it("lays a break after the period it is asked for", () => {
    const monday = slotsForBell(bell).filter(
      (slot) => slot.dayOfWeek === 1 && slot.session === "MORNING",
    );
    expect(monday.map((slot) => slot.startTime)).toEqual([
      "08:00", "09:00", "10:00", "10:15", "11:15",
    ]);
    expect(monday.filter((slot) => slot.isBreak)).toHaveLength(1);
    expect(monday.map((slot) => slot.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("continues the day's numbering into the afternoon", () => {
    const monday = slotsForBell(bell).filter((slot) => slot.dayOfWeek === 1);
    // Five in the morning (four periods and a break), five in the afternoon.
    expect(monday.map((slot) => slot.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("gives Saturday a morning and no afternoon", () => {
    const saturday = slotsForBell(bell).filter((slot) => slot.dayOfWeek === 6);
    expect(saturday.every((slot) => slot.session === "MORNING")).toBe(true);
    expect(saturday.length).toBeGreaterThan(0);
  });

  it("lays no break when none is asked for", () => {
    const slots = slotsForBell({ ...bell, periodsBeforeBreak: 0 });
    expect(slots.some((slot) => slot.isBreak)).toBe(false);
  });

  it("adds the Ramadan grid only when asked", () => {
    expect(slotsForBell(bell).some((slot) => slot.scheduleKind === "RAMADAN")).toBe(false);
    const withRamadan = slotsForBell({ ...bell, withRamadan: true, ramadanPeriods: 4 });
    expect(withRamadan.some((slot) => slot.scheduleKind === "RAMADAN")).toBe(true);
  });
});

// ── The form contract ────────────────────────────────────────────────────────

function baseForm(extra: Record<string, string | string[]> = {}): FormData {
  const form = new FormData();
  form.set("mode", "new");
  form.set("code", "TEST");
  form.set("name", "École de test");
  form.set("level", "GROUP");
  form.set("country", "MA");
  form.set("isActive", "on");
  for (const [name, value] of Object.entries(extra)) {
    if (Array.isArray(value)) for (const item of value) form.append(name, item);
    else form.set(name, value);
  }
  return form;
}

/** A three-row programme table, posted as six aligned arrays. */
function programmeForm(rows: { level: string; subject: string; coef: string; included: string }[]) {
  return {
    cycle: ["PRIMARY"],
    levelCode: ["1AP"],
    subjectCode: ["AR", "MATH", "FR"],
    progLevelCode: rows.map((row) => row.level),
    progTrackCode: rows.map(() => ""),
    progSubjectCode: rows.map((row) => row.subject),
    progCoefficient: rows.map((row) => row.coef),
    progWeeklyMinutes: rows.map(() => ""),
    progIncluded: rows.map((row) => row.included),
  };
}

describe("the posted form", () => {
  beforeEach(() => {
    granted.add("school.create");
    granted.add("schoolYear.create");
    granted.add("configuration.manage");
  });

  it("zips the programme arrays by index", async () => {
    const form = baseForm(
      programmeForm([
        { level: "1AP", subject: "AR", coef: "6", included: "1" },
        { level: "1AP", subject: "MATH", coef: "5", included: "1" },
        { level: "1AP", subject: "FR", coef: "4", included: "1" },
      ]),
    );

    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const written = of("levelSubject", "upsert").map(
      (call) => (call.args.create as Record<string, unknown>).coefficient,
    );
    expect(written).toEqual([6, 5, 4]);
  });

  it("refuses a ragged table rather than shifting every coefficient", async () => {
    const form = baseForm({
      cycle: ["PRIMARY"],
      levelCode: ["1AP"],
      subjectCode: ["AR", "MATH"],
      progLevelCode: ["1AP", "1AP"],
      progTrackCode: ["", ""],
      progSubjectCode: ["AR", "MATH"],
      // One coefficient short — the row that follows would take the wrong one.
      progCoefficient: ["6"],
      progWeeklyMinutes: ["", ""],
      progIncluded: ["1", "1"],
    });

    const result = await runSetupAction(IDLE, form);
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.programme).toBe(t.setup.rowsMisaligned);
    expect(of("levelSubject", "upsert")).toHaveLength(0);
  });

  it("drops an unticked row but keeps its slot", async () => {
    const form = baseForm(
      programmeForm([
        { level: "1AP", subject: "AR", coef: "6", included: "1" },
        { level: "1AP", subject: "MATH", coef: "5", included: "0" },
        { level: "1AP", subject: "FR", coef: "4", included: "1" },
      ]),
    );

    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const written = of("levelSubject", "upsert").map(
      (call) => (call.args.create as Record<string, unknown>).coefficient,
    );
    // The dropped row did not take the next row's coefficient with it.
    expect(written).toEqual([6, 4]);
  });

  it("ignores a code the catalogue does not know", async () => {
    const form = baseForm({
      cycle: ["PRIMARY", "NOT_A_CYCLE"],
      levelCode: ["1AP", "FORGED"],
      subjectCode: ["AR", "FORGED-SUBJECT"],
    });

    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const levels = of("level", "upsert").map(
      (call) => (call.args.create as Record<string, unknown>).code,
    );
    expect(levels).toEqual(["1AP"]);
    expect(of("educationLevel", "upsert")).toHaveLength(1);
  });

  it("takes a level's name from the catalogue, never from the form", async () => {
    const form = baseForm({ cycle: ["PRIMARY"], levelCode: ["1AP"], name: "École de test" });
    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const created = of("level", "upsert")[0]!.args.create as Record<string, unknown>;
    expect(created.name).toBe("1ère année primaire");
    expect(created.massarCode).toBe("P1");
  });

  it("gives a hand-typed level no MASSAR code", async () => {
    const form = baseForm({
      cycle: ["PRIMARY"],
      levelCode: [],
      customLevelCycle: ["PRIMARY"],
      customLevelCode: ["7AP"],
      customLevelName: ["7ème année"],
      customLevelNameAr: [""],
      customLevelGradeYear: ["7"],
    });
    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    const created = of("level", "upsert")[0]!.args.create as Record<string, unknown>;
    expect(created.code).toBe("7AP");
    // Nullable-unique on (school, massarCode): a typed code is how two levels
    // collide, so an invented level carries none.
    expect(created.massarCode).toBeNull();
  });
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("authorization", () => {
  it("refuses a new school without school.create", async () => {
    const result = await runSetupAction(IDLE, baseForm());
    expect(result.status).toBe("error");
    expect(of("school", "create")).toHaveLength(0);
  });

  it("asks for configuration.manage only when it writes configuration", async () => {
    granted.add("school.create");
    granted.add("configuration.manage");

    await expect(runSetupAction(IDLE, baseForm())).rejects.toBeInstanceOf(RedirectError);
    expect(askedOrg).toEqual(["school.create"]);

    askedOrg.length = 0;
    calls.length = 0;
    await expect(
      runSetupAction(IDLE, baseForm({ cycle: ["PRIMARY"], levelCode: ["1AP"] })),
    ).rejects.toBeInstanceOf(RedirectError);
    expect(askedOrg).toEqual(["school.create", "configuration.manage"]);
  });

  it("scopes an existing school to itself and never to the organisation", async () => {
    granted.add("configuration.manage");
    granted.add("schoolYear.create");
    answers["school.findFirst"] = { id: "school-9" };

    const form = baseForm({ mode: "existing", schoolId: "school-9", cycle: ["PRIMARY"] });
    await expect(runSetupAction(IDLE, form)).rejects.toBeInstanceOf(RedirectError);

    expect(askedOrg).toEqual([]);
    expect(askedSchool).toEqual(["configuration.manage"]);
    expect(of("school", "create")).toHaveLength(0);
  });
});

// ── The applier ──────────────────────────────────────────────────────────────

const EMPTY_PLAN = {
  settings: {},
  year: null,
  cycles: [],
  levels: [],
  tracks: [],
  subjects: [],
  programme: [],
  rooms: [],
  bell: null,
  offerings: [],
  groupsPerClass: 0,
  groupPurpose: "OTHER",
  feeTypes: [],
  feeRates: [],
  discounts: [],
};

const FULL_PLAN = {
  ...EMPTY_PLAN,
  year: {
    name: "2026-2027",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2027-06-30"),
    status: "ACTIVE",
    isDefault: true,
    terms: [
      {
        number: 1,
        name: "Semestre 1",
        nameAr: null,
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-01-15"),
      },
    ],
    holidays: [],
  },
  cycles: [{ cycle: "PRIMARY", name: "Primaire", nameAr: "ابتدائي", position: 2 }],
  levels: [
    {
      cycle: "PRIMARY",
      code: "1AP",
      name: "1ère année primaire",
      nameAr: null,
      gradeYear: 1,
      massarCode: "P1",
    },
  ],
  subjects: [
    {
      code: "MATH",
      name: "Mathématiques",
      nameAr: null,
      shortName: null,
      massarCode: null,
      parent: null,
      colorHex: null,
      isLanguage: false,
      requiresLab: false,
    },
  ],
  programme: [
    {
      levelCode: "1AP",
      trackCode: null,
      subjectCode: "MATH",
      coefficient: 5,
      weeklyMinutes: 300,
    },
  ],
  rooms: [
    { code: "A001", name: "Salle A001", kind: "CLASSROOM", building: null, floor: 0, capacity: 30 },
  ],
  offerings: [
    { levelCode: "1AP", trackCode: null, classCount: 2, capacity: 30, classCodes: ["1AP-A", "1AP-B"] },
  ],
  groupsPerClass: 2,
  groupPurpose: "LAB",
  feeTypes: [
    {
      code: "SCOLARITE",
      name: "Scolarité",
      nameAr: null,
      kind: "TUITION",
      billingCycle: "MONTHLY",
      isMandatory: true,
    },
  ],
  feeRates: [{ feeCode: "SCOLARITE", levelCode: "1AP", amountCentimes: 1500000 }],
  discounts: [],
};

describe("applySetup", () => {
  it("writes in an order the foreign keys allow", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    const order = calls
      .filter((call) => call.op === "upsert" || call.op === "create")
      .map((call) => call.model);

    const first = (model: string) => order.indexOf(model);
    expect(first("school")).toBeLessThan(first("schoolSettings"));
    expect(first("schoolSettings")).toBeLessThan(first("schoolYear"));
    expect(first("schoolYear")).toBeLessThan(first("term"));
    expect(first("term")).toBeLessThan(first("educationLevel"));
    expect(first("educationLevel")).toBeLessThan(first("level"));
    expect(first("level")).toBeLessThan(first("subject"));
    expect(first("subject")).toBeLessThan(first("levelSubject"));
    expect(first("levelSubject")).toBeLessThan(first("room"));
    expect(first("room")).toBeLessThan(first("feeType"));
    expect(first("feeType")).toBeLessThan(first("schoolWeek"));
    expect(first("schoolWeek")).toBeLessThan(first("feeRate"));
    expect(first("feeRate")).toBeLessThan(first("levelOffering"));
    expect(first("levelOffering")).toBeLessThan(first("schoolClass"));
    expect(first("schoolClass")).toBeLessThan(first("classGroup"));
  });

  it("derives every denormalised schoolId from the school it just wrote", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    // Whatever id the School row came back with — never anything from the plan.
    const schoolId = "school-1";
    expect(of("school", "create")).toHaveLength(1);

    for (const call of [...of("level", "upsert"), ...of("schoolClass", "upsert")]) {
      expect((call.args.create as Record<string, unknown>).schoolId).toBe(schoolId);
    }
  });

  it("puts every scopeKey through its own helper", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    const programmeKey = (of("levelSubject", "upsert")[0]!.args.create as Record<string, unknown>)
      .scopeKey;
    expect(programmeKey).toBe(levelSubjectScopeKey(null));

    const offeringKey = (of("levelOffering", "upsert")[0]!.args.create as Record<string, unknown>)
      .scopeKey;
    expect(offeringKey).toBe(offeringScopeKey(null));

    const levelId = (of("feeRate", "upsert")[0]!.args.create as Record<string, unknown>).levelId;
    const rateKey = (of("feeRate", "upsert")[0]!.args.create as Record<string, unknown>).scopeKey;
    expect(rateKey).toBe(feeRateScopeKey(levelId as string));
  });

  it("upserts everything except the school itself", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    const created = calls.filter((call) => call.op === "create").map((call) => call.model);
    // Only the School row is a bare create; a re-run must correct the rest in
    // place rather than lay a second copy over it.
    expect([...new Set(created)]).toEqual(["school"]);
  });

  it("never clears a class's room or titulaire on a re-run", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    const update = of("schoolClass", "upsert")[0]!.args.update as Record<string, unknown>;
    expect(update).not.toHaveProperty("roomId");
    expect(update).not.toHaveProperty("mainTeacherId");
    expect(update).not.toHaveProperty("isActive");
  });

  it("writes nothing year-scoped when the year step was skipped", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
      year: null,
    } as never);

    for (const model of ["schoolYear", "term", "timeSlot", "schoolWeek", "feeRate", "levelOffering", "schoolClass", "classGroup"]) {
      expect(of(model, "upsert"), model).toHaveLength(0);
    }
    // The school, its settings and its cursus still land.
    expect(of("school", "create")).toHaveLength(1);
    expect(of("schoolSettings", "upsert")).toHaveLength(1);
    expect(of("level", "upsert")).toHaveLength(1);
    expect(of("feeType", "upsert")).toHaveLength(1);
  });

  it("refuses an existing school that is not in the organisation", async () => {
    answers["school.findFirst"] = null;
    const result = await applySetup("org-1", {
      school: { mode: "existing", id: "elsewhere" },
      ...EMPTY_PLAN,
    } as never);

    expect(result).toBeNull();
    expect(of("schoolSettings", "upsert")).toHaveLength(0);
  });

  it("opens one class per section and the groups under it", async () => {
    await applySetup("org-1", {
      school: { mode: "new", data: { code: "T" } as never },
      ...FULL_PLAN,
    } as never);

    expect(of("schoolClass", "upsert").map((call) => (call.args.create as Record<string, unknown>).code))
      .toEqual(["1AP-A", "1AP-B"]);
    // Two groups each.
    expect(of("classGroup", "upsert")).toHaveLength(4);
  });
});
