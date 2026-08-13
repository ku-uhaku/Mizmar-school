import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import type { AuthContext } from "@/lib/dal";

/**
 * La vie scolaire: a module that owns no tables and shows nothing of its own.
 *
 * Everything on this screen is another module's figure, and everything in the
 * header search is another module's query. That makes the whole module a
 * composition, and gives it exactly two ways to be wrong:
 *
 *   * **it could ask for something the reader may not see.** `schoolLife.view`
 *     grants the *overview* — the right to look at the year as a whole rather
 *     than one child at a time — and not the contents. So each figure is gated
 *     on the permission that opens the screen it summarises.
 *   * **it could answer zero instead of nothing.** "0 families" is a claim
 *     about the school, and a reader without `family.view` has not earned it.
 *     A figure they may not have comes back `null` for the caller to omit.
 *
 * The search has a third: it reaches three tables at once, which is exactly the
 * shape a scoping leak takes. Each module's own search is confined to the
 * working context, and this file asserts that rather than assuming it.
 */

// ─────────────────────────────────────────────────────────────────────────────

/** Which cross-module reads were asked for, and with what. */
const asked: { name: string; args: unknown[] }[] = [];

const record =
  <T>(name: string, answer: T) =>
  async (...args: unknown[]) => {
    asked.push({ name, args });
    return answer;
  };

vi.mock("@/modules/students/queries", () => ({
  countStudentsByStanding: record("countStudentsByStanding", {
    enrolled: 214,
    preRegistered: 12,
    left: 8,
    total: 234,
  }),
  searchStudents: record("searchStudents", [
    {
      id: "student-1",
      firstName: "Amine",
      lastName: "Benali",
      code: "E-2026-0042",
      className: "3AP-A",
      levelName: "3e année",
    },
  ]),
}));

vi.mock("@/modules/families/queries", () => ({
  countFamilies: record("countFamilies", 180),
  searchFamilies: record("searchFamilies", [
    {
      id: "family-1",
      name: "Benali",
      code: "F-2026-0042",
      primaryContactPhone: "0661234567",
    },
  ]),
}));

vi.mock("@/modules/classes/queries", () => ({
  loadClassFill: record("loadClassFill", [
    { id: "class-1", code: "3AP-A", enrolled: 28, capacity: 30 },
  ]),
  searchClasses: record("searchClasses", [
    { id: "class-1", code: "3AP-A", levelLabel: "3AP", enrolled: 28 },
  ]),
}));

vi.mock("@/modules/hr/queries", () => ({
  searchStaff: record("searchStaff", [
    {
      id: "staff-1",
      code: "P-2026-0007",
      fullName: "Fatima Benali",
      jobRole: "TEACHER",
      jobTitle: "Professeure de mathématiques",
      status: "ACTIVE",
      phone: "0661234567",
    },
  ]),
}));

vi.mock("@/modules/enrolment/queries", () => ({
  loadEnrolmentStats: record("loadEnrolmentStats", {
    enrolled: 214,
    pending: 6,
    unplaced: 3,
    billedCentimes: 120_000_000,
    discountedCentimes: 4_500_000,
  }),
  countEnrolmentsByLevel: record("countEnrolmentsByLevel", [
    { label: "3AP", levelCode: "3AP", value: 84 },
  ]),
}));

vi.mock("@/modules/classroom/queries", () => ({
  loadClassroomActivity: record("loadClassroomActivity", {
    marks: [],
    remarks: [],
  }),
}));

vi.mock("@/modules/assessments/queries", () => ({
  listAssessments: record("listAssessments", [
    {
      id: "paper-1",
      title: "Contrôle n°1",
      classCode: "3AP-A",
      subjectName: "Mathématiques",
      teacherName: "Karim Alaoui",
      average: 12.4,
      coefficient: 2,
      colorHex: "#123456",
    },
  ]),
  countAssessments: record("countAssessments", 11),
}));

let signedIn = true;

vi.mock("@/lib/dal", () => ({
  requireAuth: async () => {
    if (!signedIn) throw new Error("redirect to /login");
    return currentContext;
  },
}));

const { loadSchoolLifeStats, loadSchoolLifeSummary } =
  await import("@/modules/school-life/queries");
const { globalSearchAction } = await import("@/modules/school-life/actions");

// ─────────────────────────────────────────────────────────────────────────────

let currentContext: AuthContext;

function reader(...codes: string[]): AuthContext {
  const held = new Set(codes);
  return {
    organization: { id: "org-1" },
    currentSchool: { id: "school-1" },
    currentSchoolYear: { id: "year-1" },
    user: { id: "user-1" },
    can: (code: string) => held.has(code),
    canOrg: (code: string) => held.has(code),
    canInSchool: (_school: string, code: string) => held.has(code),
  } as unknown as AuthContext;
}

const wasAsked = (name: string) => asked.some((call) => call.name === name);

const EVERYTHING = Object.values(PERMISSIONS) as string[];

beforeEach(() => {
  asked.length = 0;
  signedIn = true;
  currentContext = reader(...EVERYTHING);
});

// ── Each figure behind its own permission ────────────────────────────────────

describe("loadSchoolLifeStats", () => {
  it("gives a reader who holds everything the whole picture", async () => {
    const stats = await loadSchoolLifeStats(reader(...EVERYTHING));

    expect(stats.standing).toMatchObject({ total: 234 });
    expect(stats.families).toBe(180);
    expect(stats.enrolment).toMatchObject({ enrolled: 214, unplaced: 3 });
    expect(stats.billing).toMatchObject({ billedCentimes: 120_000_000 });
    expect(stats.byLevel).toHaveLength(1);
    expect(stats.classFill).toHaveLength(1);
  });

  it("answers nothing, not zero, for a figure the reader may not have", async () => {
    // "0 families" is a claim about the school, and the reader has not earned
    // it. Null is what lets the caller omit the card rather than print a lie.
    const stats = await loadSchoolLifeStats(
      reader(PERMISSIONS.SCHOOL_LIFE_VIEW),
    );

    expect(stats.standing).toBeNull();
    expect(stats.families).toBeNull();
    expect(stats.enrolment).toBeNull();
    expect(stats.billing).toBeNull();
  });

  it("does not even ask for what it may not show", async () => {
    // Gated before the query, not filtered after it: a count taken and thrown
    // away is a read somebody was not entitled to make.
    await loadSchoolLifeStats(reader(PERMISSIONS.SCHOOL_LIFE_VIEW));

    expect(wasAsked("countStudentsByStanding")).toBe(false);
    expect(wasAsked("countFamilies")).toBe(false);
    expect(wasAsked("loadEnrolmentStats")).toBe(false);
    expect(wasAsked("countEnrolmentsByLevel")).toBe(false);
    expect(wasAsked("loadClassFill")).toBe(false);
  });

  it("gates each figure on the code that opens the screen it summarises", async () => {
    for (const [code, read] of [
      [PERMISSIONS.STUDENT_VIEW, "countStudentsByStanding"],
      [PERMISSIONS.FAMILY_VIEW, "countFamilies"],
      [PERMISSIONS.ENROLMENT_VIEW, "countEnrolmentsByLevel"],
      [PERMISSIONS.CLASS_VIEW, "loadClassFill"],
    ] as const) {
      asked.length = 0;
      await loadSchoolLifeStats(reader(code));
      expect(wasAsked(read), code).toBe(true);
    }
  });

  it("keeps what a family is charged behind the bursar's own code", async () => {
    // The split the enrolment module already makes: a secretary seats a child,
    // and only the bursar sees what the family is charged for it.
    const secretary = await loadSchoolLifeStats(
      reader(PERMISSIONS.ENROLMENT_VIEW),
    );
    expect(secretary.enrolment).not.toBeNull();
    expect(secretary.billing).toBeNull();

    asked.length = 0;
    const bursar = await loadSchoolLifeStats(
      reader(PERMISSIONS.ENROLMENT_FEES),
    );
    expect(bursar.billing).not.toBeNull();
    expect(bursar.enrolment).toBeNull();
  });

  it("takes one read for both halves of the enrolment figures", async () => {
    // Which halves survive is decided afterwards; the query runs once.
    await loadSchoolLifeStats(
      reader(PERMISSIONS.ENROLMENT_VIEW, PERMISSIONS.ENROLMENT_FEES),
    );
    expect(
      asked.filter((call) => call.name === "loadEnrolmentStats"),
    ).toHaveLength(1);
  });

  it("lists the papers waiting on the office only for whoever accepts them", async () => {
    // A paper in SUBMITTED is waiting on somebody at this desk — and until it
    // appeared here the only way to find one was to open every class's round.
    const office = await loadSchoolLifeStats(
      reader(PERMISSIONS.ASSESSMENT_PUBLISH),
    );
    expect(office.awaitingValidation.rows).toHaveLength(1);
    expect(office.awaitingValidation.more).toBe(10);

    asked.length = 0;
    const teacher = await loadSchoolLifeStats(
      reader(PERMISSIONS.ASSESSMENT_GRADE),
    );
    expect(teacher.awaitingValidation).toEqual({ rows: [], more: 0 });
    expect(wasAsked("listAssessments")).toBe(false);
  });

  it("asks only for papers a teacher has handed in", async () => {
    await loadSchoolLifeStats(reader(PERMISSIONS.ASSESSMENT_PUBLISH));
    const call = asked.find((entry) => entry.name === "listAssessments")!;
    expect(call.args[1]).toMatchObject({ statuses: ["SUBMITTED"] });
  });

  it("sends the card five fields, not a whole assessment row", async () => {
    // An AssessmentRow carries every paper's average, mark counts, coefficient
    // and colours; the card renders five. The rest was crossing to the client
    // for nothing.
    const stats = await loadSchoolLifeStats(
      reader(PERMISSIONS.ASSESSMENT_PUBLISH),
    );
    expect(Object.keys(stats.awaitingValidation.rows[0]!).sort()).toEqual([
      "classCode",
      "id",
      "subjectName",
      "teacherName",
      "title",
    ]);
  });

  it("never reports a negative count of papers left over", async () => {
    expect(
      (await loadSchoolLifeStats(reader(PERMISSIONS.ASSESSMENT_PUBLISH)))
        .awaitingValidation.more,
    ).toBeGreaterThanOrEqual(0);
  });

  it("asks the classroom for today, and lets it gate itself", async () => {
    // `loadClassroomActivity` decides inside on the classroom codes, so the
    // caller does not have to know which two they are.
    await loadSchoolLifeStats(reader(PERMISSIONS.SCHOOL_LIFE_VIEW));
    const call = asked.find((entry) => entry.name === "loadClassroomActivity")!;
    expect(call.args[1]).toBeInstanceOf(Date);
  });

  it("passes the reader's own context to every figure it takes", async () => {
    // The whole reason the dashboard agrees with the list screens: it is the
    // same query, scoped the same way.
    const context = reader(...EVERYTHING);
    await loadSchoolLifeStats(context);

    for (const call of asked) {
      expect(call.args[0], call.name).toBe(context);
    }
  });
});

describe("loadSchoolLifeSummary", () => {
  it("answers nothing at all without student.view", async () => {
    // The card is omitted rather than zeroed.
    expect(
      await loadSchoolLifeSummary(reader(PERMISSIONS.SCHOOL_LIFE_VIEW)),
    ).toBeNull();
    expect(asked).toEqual([]);
  });

  it("takes three numbers rather than the page's dozen", async () => {
    // Running the page's queries to throw eleven results away was the single
    // most expensive thing on the dashboard.
    await loadSchoolLifeSummary(reader(...EVERYTHING));
    expect(asked.map((call) => call.name).sort()).toEqual([
      "countStudentsByStanding",
      "loadEnrolmentStats",
    ]);
  });

  it("reports the pupils without the inscriptions when that is all it may see", async () => {
    // Null, not zero. These used to fall back to 0, which put "0 inscrits" on
    // the dashboard card as a statement about the school for a reader not
    // entitled to the figure — the very claim `loadSchoolLifeStats` refuses to
    // make one function above. A missing number reads as missing.
    const summary = await loadSchoolLifeSummary(
      reader(PERMISSIONS.STUDENT_VIEW),
    );
    expect(summary).toEqual({ students: 234, enrolled: null, unplaced: null });
    expect(wasAsked("loadEnrolmentStats")).toBe(false);
  });
});

// ── The header search ────────────────────────────────────────────────────────

describe("globalSearchAction", () => {
  it("searches every kind a reader may see", async () => {
    const results = await globalSearchAction("Benali");

    expect(results.students).toHaveLength(1);
    expect(results.families).toHaveLength(1);
    expect(results.classes).toHaveLength(1);
    expect(results.staff).toHaveLength(1);
  });

  it("filters by permission per kind, not all or nothing", async () => {
    // A bursar with no access to family files gets pupils and classes and
    // nothing else, rather than an empty box or a forbidden error.
    currentContext = reader(PERMISSIONS.STUDENT_VIEW, PERMISSIONS.CLASS_VIEW);
    const results = await globalSearchAction("Benali");

    expect(results.students).toHaveLength(1);
    expect(results.classes).toHaveLength(1);
    expect(results.families).toEqual([]);
    expect(wasAsked("searchFamilies")).toBe(false);
  });

  it("keeps the payroll behind HR_VIEW", async () => {
    // The one kind that is not vie scolaire: a reader who may look up pupils
    // has no business finding employees by their CIN.
    currentContext = reader(PERMISSIONS.STUDENT_VIEW);
    const results = await globalSearchAction("Benali");

    expect(results.students).toHaveLength(1);
    expect(results.staff).toEqual([]);
    expect(wasAsked("searchStaff")).toBe(false);
  });

  it("gives a reader with none of the kinds an empty box", async () => {
    currentContext = reader(PERMISSIONS.SCHOOL_LIFE_VIEW);
    const results = await globalSearchAction("Benali");

    expect(results).toEqual({
      students: [],
      families: [],
      classes: [],
      staff: [],
    });
    expect(asked).toEqual([]);
  });

  it("asks nothing at all for a term too short to mean anything", async () => {
    // Two characters is where a name search stops matching half the school.
    for (const term of ["", " ", "a", " b "]) {
      asked.length = 0;
      expect(await globalSearchAction(term), term).toEqual({
        students: [],
        families: [],
        classes: [],
        staff: [],
      });
      expect(asked, term).toEqual([]);
    }
  });

  it("trims before it measures and before it searches", async () => {
    await globalSearchAction("  Benali  ");
    for (const call of asked) {
      expect(call.args[1], call.name).toBe("Benali");
    }
  });

  it("hands each module the reader's own context to scope with", async () => {
    // Each search confines itself to the working context — that is what stops
    // one box reaching three tables across the whole deployment.
    const context = reader(...EVERYTHING);
    currentContext = context;
    await globalSearchAction("Benali");

    for (const call of asked) {
      expect(call.args[0], call.name).toBe(context);
    }
  });

  it("goes quiet when one kind fails rather than losing the others", async () => {
    // The caller is a `useTransition` in a dialog with nowhere to render an
    // error, and a search box that goes quiet on a hiccup beats an unhandled
    // rejection.
    const families = await import("@/modules/families/queries");
    const original = families.searchFamilies;
    (families as { searchFamilies: unknown }).searchFamilies = async () => {
      throw new Error("database unavailable");
    };

    const results = await globalSearchAction("Benali");
    expect(results.families).toEqual([]);
    expect(results.students).toHaveLength(1);

    (families as { searchFamilies: unknown }).searchFamilies = original;
  });

  it("still refuses somebody who is not signed in", async () => {
    // Only the expected failure is swallowed: a signed-out user has to be sent
    // to the login screen, not shown an empty list.
    signedIn = false;
    await expect(globalSearchAction("Benali")).rejects.toThrow();
  });

  it("renders every kind into the one shape the box draws", async () => {
    const results = await globalSearchAction("Benali");

    for (const hit of [
      ...results.students,
      ...results.families,
      ...results.classes,
    ]) {
      expect(Object.keys(hit).sort()).toEqual(["detail", "id", "label"]);
      expect(typeof hit.label).toBe("string");
    }
  });

  it("leaves out a detail a row does not have", async () => {
    const students = await import("@/modules/students/queries");
    const original = students.searchStudents;
    (students as { searchStudents: unknown }).searchStudents = async () => [
      {
        id: "student-2",
        firstName: "Salma",
        lastName: "Idrissi",
        code: "E-2026-0043",
        className: null,
        levelName: null,
      },
    ];

    const results = await globalSearchAction("Idrissi");
    expect(results.students[0]!.detail).toBe("E-2026-0043");

    (students as { searchStudents: unknown }).searchStudents = original;
  });
});
