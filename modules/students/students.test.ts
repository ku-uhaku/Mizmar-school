import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import {
  BLOOD_TYPES,
  GENDERS,
  LIVES_WITH,
  SCHOOLING_TYPES,
  STUDENT_STATUSES,
  STUDENT_WORKFLOW_STEPS,
  deriveStudentStatus,
  nextWorkflowStep,
  siblingCountOf,
  workflowStateOf,
} from "@/modules/students/enums";
import { studentSchema } from "@/modules/students/validation";

/**
 * L'élève: the row that turns a file into a pupil.
 *
 * Almost nothing about a child is stored twice here, and the tests follow that
 * shape. Three columns that *could* have been typed in are derived instead, and
 * each one has a reason worth holding still:
 *
 *   * **`Student.status`** comes from the enrolments. A status column that can
 *     disagree with the rows underneath it is worse than no status column, so
 *     `refreshStudentStatus` is the only thing allowed to write it and every
 *     write that could change an enrolment calls it afterwards.
 *   * **the parcours** comes from the facts — a family attached, a dossier
 *     settled, a class seated, an échéancier raised — rather than from flags.
 *   * **the fratrie size** is the sum of two counts, never a third column.
 *
 * The validation carries the other half: `status` is deliberately absent from
 * the schema, because accepting it from a form would let a POST claim a child
 * is enrolled when no enrolment row exists.
 */

const t = getDictionaryFor("en");

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findMany"
              ? []
              : op === "updateMany"
                ? { count: 1 }
                : op === "update"
                  ? {}
                  : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({ studentCodeFormat: "E-{YY}-{####}" }),
}));

const { attachToFamily, refreshStudentStatus } = await import(
  "@/modules/students/service"
);

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string) => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The status nobody types in ───────────────────────────────────────────────

describe("deriveStudentStatus", () => {
  const enrolled = (...statuses: string[]) =>
    statuses.map((status) => ({ status }));

  it("opens a file with no enrolment as pre-registered", () => {
    expect(deriveStudentStatus([])).toBe("PRE_REGISTERED");
  });

  it("reads an active enrolment as enrolled", () => {
    expect(deriveStudentStatus(enrolled("ACTIVE"))).toBe("ENROLLED");
  });

  it("lets an active enrolment beat anything older", () => {
    // A child re-admitted after withdrawing is enrolled, and the old row's
    // status is history.
    expect(deriveStudentStatus(enrolled("ACTIVE", "WITHDRAWN"))).toBe("ENROLLED");
    expect(deriveStudentStatus(enrolled("WITHDRAWN", "ACTIVE"))).toBe("ENROLLED");
    expect(deriveStudentStatus(enrolled("TRANSFERRED", "ACTIVE"))).toBe(
      "ENROLLED",
    );
  });

  it("takes how the pupil left from the newest enrolment", () => {
    expect(deriveStudentStatus(enrolled("TRANSFERRED", "COMPLETED"))).toBe(
      "TRANSFERRED",
    );
    expect(deriveStudentStatus(enrolled("WITHDRAWN", "COMPLETED"))).toBe(
      "WITHDRAWN",
    );
    expect(deriveStudentStatus(enrolled("COMPLETED", "WITHDRAWN"))).toBe(
      "GRADUATED",
    );
  });

  it("reads a place applied for but not confirmed as pre-registered", () => {
    expect(deriveStudentStatus(enrolled("PENDING"))).toBe("PRE_REGISTERED");
  });

  it("falls back to pre-registered for anything it does not recognise", () => {
    // A file with no place yet is the safe reading: it claims nothing.
    for (const status of ["", "ENROLLED", "__proto__", "active"]) {
      expect(deriveStudentStatus(enrolled(status)), status).toBe(
        "PRE_REGISTERED",
      );
    }
  });

  it("only ever answers a status the column declares", () => {
    for (const status of ["ACTIVE", "PENDING", "TRANSFERRED", "WITHDRAWN", "COMPLETED"]) {
      expect(STUDENT_STATUSES, status).toContain(
        deriveStudentStatus(enrolled(status)),
      );
    }
  });
});

describe("refreshStudentStatus", () => {
  it("writes the status it derived, and nothing else", () => {
    answers = { "enrollment.findMany": [{ status: "ACTIVE" }] };
    return refreshStudentStatus("student-1").then(() => {
      expect(only("student", "update").args).toEqual({
        where: { id: "student-1" },
        data: { status: "ENROLLED" },
      });
    });
  });

  it("orders the enrolments by year, not by the day the family signed", async () => {
    // The bug this closes. "The most recent enrolment says how the pupil left"
    // is about which *year* they left in; `enrolledOn` is only a proxy for it.
    // A place granted in June is signed months before the year it is for, so a
    // child pre-enrolled for next year and enrolled for this one ordered the
    // older year first and took its status.
    answers = { "enrollment.findMany": [] };
    await refreshStudentStatus("student-1");

    expect(only("enrollment", "findMany").args).toMatchObject({
      where: { studentId: "student-1" },
      orderBy: [{ schoolYear: { startDate: "desc" } }, { enrolledOn: "desc" }],
    });
  });

  it("reads every enrolment the pupil has, not only this year's", async () => {
    // The derivation is about the whole file: a child who left last year and
    // came back is enrolled.
    await refreshStudentStatus("student-1");
    const where = (only("enrollment", "findMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(Object.keys(where)).toEqual(["studentId"]);
  });

  it("opens a file with no enrolments as pre-registered", async () => {
    answers = { "enrollment.findMany": [] };
    await refreshStudentStatus("student-1");
    expect(only("student", "update").args).toMatchObject({
      data: { status: "PRE_REGISTERED" },
    });
  });
});

// ── Attaching a dossier ──────────────────────────────────────────────────────

describe("attachToFamily", () => {
  it("attaches a pupil to a dossier of their own school", async () => {
    answers = { "family.findFirst": { id: "family-1" } };
    expect(await attachToFamily("student-1", "school-1", "family-1")).toBe(true);

    expect(only("student", "updateMany").args).toMatchObject({
      where: { id: "student-1", schoolId: "school-1" },
      data: { familyId: "family-1" },
    });
  });

  it("re-derives the dossier against the pupil's school", async () => {
    // A family id from another school must match nothing rather than link
    // across the tenant boundary.
    answers = { "family.findFirst": { id: "family-1" } };
    await attachToFamily("student-1", "school-1", "family-1");

    expect(only("family", "findFirst").args).toMatchObject({
      where: { id: "family-1", schoolId: "school-1" },
    });
  });

  it("refuses a dossier of another school", async () => {
    expect(await attachToFamily("student-1", "school-1", "elsewhere")).toBe(
      false,
    );
    expect(of("student", "updateMany")).toEqual([]);
  });

  it("detaches without looking a dossier up", async () => {
    expect(await attachToFamily("student-1", "school-1", null)).toBe(true);
    expect(of("family", "findFirst")).toEqual([]);
    expect(only("student", "updateMany").args).toMatchObject({
      data: { familyId: null },
    });
  });

  it("scopes the write by the school as well as the pupil", async () => {
    // So a crafted student id reaches nothing either.
    await attachToFamily("student-1", "school-1", null);
    const where = (only("student", "updateMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where["schoolId"]).toBe("school-1");
  });

  it("reports nothing attached when the pupil is not this school's", async () => {
    answers = {
      "family.findFirst": { id: "family-1" },
      "student.updateMany": { count: 0 },
    };
    expect(await attachToFamily("elsewhere", "school-1", "family-1")).toBe(false);
  });
});

// ── The parcours ─────────────────────────────────────────────────────────────

describe("workflowStateOf", () => {
  const facts = (extra: Record<string, boolean> = {}) => ({
    hasFamily: true,
    hasDossier: true,
    hasEnrolment: true,
    hasClass: true,
    hasFees: true,
    isUpToDate: true,
    ...extra,
  });

  it("counts the file itself as always done", () => {
    // The pupil is being looked at, so it exists.
    const state = workflowStateOf(
      facts({
        hasFamily: false,
        hasDossier: false,
        hasEnrolment: false,
        hasClass: false,
        hasFees: false,
        isUpToDate: false,
      }),
    );
    expect(state.FILE).toBe(true);
  });

  it("reads each step off its own fact", () => {
    for (const [fact, step] of [
      ["hasFamily", "FAMILY"],
      ["hasDossier", "DOSSIER"],
      ["hasEnrolment", "ENROLMENT"],
      ["hasClass", "CLASS"],
      ["hasFees", "FEES"],
    ] as const) {
      const state = workflowStateOf(facts({ [fact]: false }));
      expect(state[step], step).toBe(false);
    }
  });

  it("does not call a family behind when nothing has been raised", () => {
    // An échéancier that does not exist cannot be in arrears.
    const state = workflowStateOf(facts({ hasFees: false, isUpToDate: false }));
    expect(state.FEES).toBe(false);
    expect(state.PAYMENT).toBe(false);
  });

  it("counts payment as done for a family that has missed nothing", () => {
    // Deliberately not "the year is paid in full": scolarité is collected in
    // nine or ten instalments, so a family that has never missed one still owes
    // most of the year until June. Marking that incomplete would leave the
    // parcours red for every pupil all year, and a warning that is always on is
    // a warning nobody reads.
    expect(workflowStateOf(facts()).PAYMENT).toBe(true);
  });

  it("counts payment as outstanding for one that has", () => {
    expect(workflowStateOf(facts({ isUpToDate: false })).PAYMENT).toBe(false);
  });

  it("answers every declared step", () => {
    const state = workflowStateOf(facts());
    expect(Object.keys(state).sort()).toEqual([...STUDENT_WORKFLOW_STEPS].sort());
  });
});

describe("nextWorkflowStep", () => {
  const state = (done: Partial<Record<string, boolean>>) =>
    Object.fromEntries(
      STUDENT_WORKFLOW_STEPS.map((step) => [step, done[step] ?? true]),
    ) as Record<(typeof STUDENT_WORKFLOW_STEPS)[number], boolean>;

  it("names the first thing not yet done", () => {
    expect(nextWorkflowStep(state({ CLASS: false }))).toBe("CLASS");
  });

  it("takes them in the order the guichet works in", () => {
    // The dossier comes before the inscription: the dossier is what the family
    // brings, and the inscription is what the school does once it has it.
    expect(nextWorkflowStep(state({ DOSSIER: false, ENROLMENT: false }))).toBe(
      "DOSSIER",
    );
    expect([...STUDENT_WORKFLOW_STEPS].indexOf("DOSSIER")).toBeLessThan(
      [...STUDENT_WORKFLOW_STEPS].indexOf("ENROLMENT"),
    );
  });

  it("answers nothing when the parcours is complete", () => {
    expect(nextWorkflowStep(state({}))).toBeNull();
  });

  it("never tells a reader to chase what they may not see", () => {
    // The caller narrows the list to the steps the viewer may read, so somebody
    // without the caisse is not told the next thing to do is chase a payment.
    const visible = STUDENT_WORKFLOW_STEPS.filter(
      (step) => step !== "PAYMENT" && step !== "FEES",
    );
    expect(nextWorkflowStep(state({ PAYMENT: false }), visible)).toBeNull();
  });
});

describe("siblingCountOf", () => {
  it("sums the two counts rather than storing a third", () => {
    // A third column that can disagree with the two it sums is a bug waiting to
    // be filed.
    expect(siblingCountOf({ brotherCount: 2, sisterCount: 3 })).toBe(5);
  });

  it("keeps 'none' apart from 'not asked'", () => {
    expect(siblingCountOf({ brotherCount: 0, sisterCount: 0 })).toBe(0);
    expect(siblingCountOf({ brotherCount: null, sisterCount: null })).toBeNull();
  });

  it("counts a half-answered pair as what was answered", () => {
    expect(siblingCountOf({ brotherCount: 2, sisterCount: null })).toBe(2);
    expect(siblingCountOf({ brotherCount: null, sisterCount: 3 })).toBe(3);
  });
});

// ── What a form may say about a child ────────────────────────────────────────

describe("studentSchema", () => {
  const form = (extra: Record<string, unknown> = {}) => ({
    code: "",
    massarCode: "",
    firstName: "Amine",
    lastName: "Benali",
    firstNameAr: "",
    lastNameAr: "",
    gender: "MALE",
    birthDate: "2012-09-15",
    birthCityId: "",
    neighbourhoodId: "",
    nationality: "MA",
    nationalId: "",
    photoUrl: "",
    familyId: "",
    entryDate: "",
    bloodType: "",
    allergies: "",
    chronicCondition: "",
    medications: "",
    doctorName: "",
    doctorPhone: "",
    insurer: "",
    hasDisability: false,
    medicalNotes: "",
    previousSchool: "",
    previousSchoolCityId: "",
    previousLevel: "",
    schoolingType: "",
    transferReason: "",
    brotherCount: "",
    sisterCount: "",
    birthRank: "",
    livesWith: "",
    isOrphan: false,
    notes: "",
    isActive: true,
    ...extra,
  });

  it("accepts a well-formed pupil", () => {
    expect(studentSchema(t).safeParse(form()).success).toBe(true);
  });

  it("never lets a form say what a pupil's status is", () => {
    // Derived from the enrolments. Accepting it here would let a POST claim a
    // child is enrolled when no enrolment row exists — which is what every
    // class list, every fee schedule and every register would then believe.
    const parsed = studentSchema(t).safeParse({
      ...form(),
      status: "ENROLLED",
      schoolId: "another-school",
      id: "another-pupil",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("status");
      expect(parsed.data).not.toHaveProperty("schoolId");
      expect(parsed.data).not.toHaveProperty("id");
    }
  });

  it("requires a birth date, because it decides which level a child may enter", () => {
    expect(studentSchema(t).safeParse(form({ birthDate: "" })).success).toBe(
      false,
    );
  });

  it("refuses a birth date in the future", () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(studentSchema(t).safeParse(form({ birthDate: tomorrow })).success)
      .toBe(false);
  });

  it("refuses a birth date from before the school existed", () => {
    expect(
      studentSchema(t).safeParse(form({ birthDate: "1930-01-01" })).success,
    ).toBe(false);
  });

  it("bounds the sibling counts, because a two-digit one is a typo", () => {
    // Letting one through skews every social-case report drawn from these
    // columns.
    expect(studentSchema(t).safeParse(form({ brotherCount: "20" })).success)
      .toBe(true);
    expect(studentSchema(t).safeParse(form({ brotherCount: "21" })).success)
      .toBe(false);
    expect(studentSchema(t).safeParse(form({ sisterCount: "21" })).success)
      .toBe(false);
  });

  it("refuses a birth rank of zero, since one is the eldest", () => {
    expect(studentSchema(t).safeParse(form({ birthRank: "0" })).success).toBe(
      false,
    );
    expect(studentSchema(t).safeParse(form({ birthRank: "1" })).success).toBe(
      true,
    );
    expect(studentSchema(t).safeParse(form({ birthRank: "22" })).success).toBe(
      false,
    );
  });

  it("accepts every declared value of each enum, and refuses the rest", () => {
    for (const gender of GENDERS) {
      expect(studentSchema(t).safeParse(form({ gender })).success, gender).toBe(
        true,
      );
    }
    for (const gender of ["", "OTHER", "male"]) {
      expect(studentSchema(t).safeParse(form({ gender })).success, gender).toBe(
        false,
      );
    }
    for (const bloodType of BLOOD_TYPES) {
      expect(
        studentSchema(t).safeParse(form({ bloodType })).success,
        bloodType,
      ).toBe(true);
    }
    for (const livesWith of LIVES_WITH) {
      expect(
        studentSchema(t).safeParse(form({ livesWith })).success,
        livesWith,
      ).toBe(true);
    }
    for (const schoolingType of SCHOOLING_TYPES) {
      expect(
        studentSchema(t).safeParse(form({ schoolingType })).success,
        schoolingType,
      ).toBe(true);
    }
  });

  it("lets the optional enums be left unanswered", () => {
    // "Not asked yet" is a real state, which is why those columns are nullable.
    const parsed = studentSchema(t).safeParse(form());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bloodType).toBeNull();
      expect(parsed.data.livesWith).toBeNull();
      expect(parsed.data.schoolingType).toBeNull();
    }
  });

  it("refuses a code that would not survive a URL", () => {
    for (const code of ["E 2026", "E/2026", "../etc"]) {
      expect(studentSchema(t).safeParse(form({ code })).success, code).toBe(
        false,
      );
    }
  });

  it("lets the code be left out, for a file being opened", () => {
    const parsed = studentSchema(t).safeParse(form({ code: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.code).toBeNull();
  });

  it("refuses a photo that is not an image", () => {
    // The one field on a pupil that is rendered as a URL.
    expect(
      studentSchema(t).safeParse(form({ photoUrl: "javascript:alert(1)" }))
        .success,
    ).toBe(false);
    expect(
      studentSchema(t).safeParse(form({ photoUrl: "data:text/html;base64,AA" }))
        .success,
    ).toBe(false);
  });

  it("normalises the nationality to a country code", () => {
    const parsed = studentSchema(t).safeParse(form({ nationality: "ma" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nationality).toBe("MA");
  });
});
