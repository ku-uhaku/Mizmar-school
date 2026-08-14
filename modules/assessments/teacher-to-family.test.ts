import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n/config";
import {
  FAMILY_VISIBLE_STATUSES,
  acceptsMarks,
  stageOf,
  statusesForStage,
} from "@/modules/assessments/enums";
import { webHref } from "@/modules/notifications/enums";

/**
 * The rule the whole vie scolaire hangs on: **a teacher never reaches a family
 * directly.** Everything a teacher writes stops at the office, and it is the
 * office's decision that reaches the household.
 *
 * That rule is not one check in one place — it is a property of four write paths
 * that each look reasonable on their own. This file tests the property rather
 * than the paths, because the way it broke was not a missing check. It was a
 * status: `createDevoir` wrote PUBLISHED, PUBLISHED is what fires
 * `announceScheduled`, and so setting a devoir on a phone put a line on every
 * parent's lock screen with nobody at the school having seen it. Every
 * individual function was doing what its own comment said.
 *
 * Two halves, and both are asserted here:
 *
 *   1. **Nothing reaches a family unvalidated.** A devoir is DRAFT until the
 *      office opens it; a remark is internal until the office releases it; a
 *      mark is provisional until the office accepts it.
 *   2. **Everything a teacher creates reaches the office.** A gate nobody is
 *      told about is a queue nobody opens, which is the same as no gate — the
 *      work simply stops instead of being decided on.
 */

const t = getDictionaryFor("en");

const SCHOOL = "school-1";
const ORG = "org-1";
const TEACHER = "teacher-1";
const CLASS = "class-1";
const DIRECTOR = "director-1";
const GUARDIAN = "guardian-1";

// ── The fake database ────────────────────────────────────────────────────────

/** Every notification written, in the shape `notify` was called with. */
type Written = {
  kind: string;
  userId: string;
  subjectId: string | null;
  params: Record<string, string>;
};

const written: Written[] = [];
/** Which resolvers ran, so "did this even ask who the guardians are" is testable. */
const resolved: string[] = [];

let assessmentStatus = "DRAFT";
const created: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];

function reset() {
  written.length = 0;
  resolved.length = 0;
  created.length = 0;
  updates.length = 0;
  assessmentStatus = "DRAFT";
}

const assessmentRow = () => ({
  id: "devoir-1",
  title: "Devoir n°1",
  schoolId: SCHOOL,
  schoolClassId: CLASS,
  classGroupId: null,
  teacherId: TEACHER,
  scheduledOn: new Date("2026-03-04"),
  status: assessmentStatus,
  subject: { name: "Mathématiques" },
  schoolClass: { code: "3AP-A" },
  school: { organizationId: ORG },
  teacher: { email: "b@x.ma", profile: { firstName: "Nadia", lastName: "B." } },
  // The fake ignores `select`, so one row has to satisfy every caller's shape —
  // `countPendingMarks` reaches for these two.
  term: { schoolYearId: "year-1" },
  grades: [{ enrollmentId: "enrolment-1" }],
});

vi.mock("@/lib/db", () => ({
  db: {
    teachingAssignment: {
      findFirst: async () => ({
        classGroupId: null,
        teacherId: TEACHER,
        schoolClass: { id: CLASS },
      }),
    },
    term: {
      findFirst: async () => ({ id: "term-1", status: "ACTIVE" }),
    },
    assessmentType: {
      findFirst: async () => ({ id: "type-devoir" }),
    },
    assessment: {
      findFirst: async () => null,
      findUnique: async () => assessmentRow(),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        /*
          The written status becomes the row's, which is not fussiness — it is
          the whole mechanism under test. `announceScheduled` re-reads the paper
          and returns early unless it finds PUBLISHED, so a fake that kept
          returning DRAFT whatever was written would make the family-facing
          announcement unreachable and quietly pass the very regression this
          file exists to catch. Verified by reintroducing the bug: without this
          line, one of the four assertions below stopped failing.
        */
        assessmentStatus = String(data.status ?? assessmentStatus);
        return { id: "devoir-1" };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        assessmentStatus = String(data.status ?? assessmentStatus);
        return { id: "devoir-1" };
      },
    },
    assessmentGrade: { count: async () => 0 },
    enrollment: { findMany: async () => [], count: async () => 0 },
    student: { findMany: async () => [] },
    user: { findMany: async () => [] },
  },
  auditClient: {},
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

/*
  The notifications service is faked rather than driven, because what is under
  test is *which resolver each write path chose* — `staffHolding` or
  `guardiansOf…`. Those two answers are what separate telling the office from
  telling a family, and driving the real ones through a fake database would test
  Prisma's `where` clauses instead of the decision this file is about.
*/
vi.mock("@/modules/notifications/service", () => ({
  // Faithful to the real one, which swallows: a notification that throws must
  // not roll back the write it is about.
  dispatch: async (label: string, work: () => Promise<unknown>) => {
    try {
      await work();
    } catch {
      /* swallowed, exactly as in production */
    }
  },
  notify: async (input: {
    kind: string;
    subjectId?: string | null;
    params?: Record<string, unknown>;
    targets: { userId: string; params?: Record<string, unknown> }[];
  }) => {
    for (const target of input.targets) {
      written.push({
        kind: input.kind,
        userId: target.userId,
        subjectId: input.subjectId ?? null,
        params: Object.fromEntries(
          Object.entries({ ...input.params, ...target.params }).map(
            ([key, value]) => [key, String(value)],
          ),
        ),
      });
    }
    return input.targets.length;
  },
  staffHolding: async (_org: string, _school: string, code: string) => {
    resolved.push(`staffHolding:${code}`);
    // The author holds the teaching code and the director the publish one; both
    // are returned so the "does it exclude the author" case has something to
    // exclude.
    return [{ userId: DIRECTOR }, { userId: TEACHER }];
  },
  guardiansOfClass: async () => {
    resolved.push("guardiansOfClass");
    return [{ userId: GUARDIAN, studentId: "student-1" }];
  },
  guardiansOfStudent: async () => {
    resolved.push("guardiansOfStudent");
    return [{ userId: GUARDIAN, studentId: "student-1" }];
  },
  guardiansOf: async () => {
    resolved.push("guardiansOf");
    return [{ userId: GUARDIAN, studentId: "student-1" }];
  },
}));

const { createDevoir, setAssessmentStatus } = await import(
  "@/modules/assessments/service"
);

const devoirInput = {
  authorId: TEACHER,
  schoolId: SCHOOL,
  schoolYearId: "year-1",
  actsForSchool: false,
  schoolClassId: CLASS,
  subjectId: "subject-1",
  termId: "term-1",
  assessmentTypeId: "type-devoir",
  title: "Devoir n°1",
  notes: null,
  scheduledOn: new Date("2026-03-04"),
  maxScore: 20,
  coefficient: 1,
  questions: [],
};

/** Everyone told about a given kind. */
const recipientsOf = (kind: string) =>
  written.filter((row) => row.kind === kind).map((row) => row.userId);

beforeEach(reset);

// ─────────────────────────────────────────────────────────────────────────────

describe("a teacher setting a devoir", () => {
  it("writes it DRAFT, so no family is told a paper exists", async () => {
    const result = await createDevoir(devoirInput);

    expect(result).toEqual({ ok: true, assessmentId: "devoir-1" });
    expect(created).toHaveLength(1);
    /*
      The regression this file was written for. PUBLISHED here is not a cosmetic
      difference: it is the status `announceScheduled` keys on, so writing it
      would send the announcement from inside the teacher's own create call.
    */
    expect(created[0].status).toBe("DRAFT");
  });

  it("tells the office, and nobody else", async () => {
    await createDevoir(devoirInput);

    expect(recipientsOf("ASSESSMENT_CREATED")).toEqual([DIRECTOR]);
    // The gate is worth nothing if the queue is invisible — see the file note.
    expect(resolved).toContain("staffHolding:assessment.publish");
  });

  it("never resolves a guardian at all", async () => {
    await createDevoir(devoirInput);

    /*
      Asserted on the *resolver* rather than on the absence of a guardian in
      `written`, deliberately. "No family was written to" would also pass if the
      code asked who the guardians were and the school happened to have none on
      file — which is exactly the state a fresh school is in, and would have let
      this regression through on any database where the assertion was checked.
    */
    expect(resolved.some((call) => call.startsWith("guardians"))).toBe(false);
    expect(written.every((row) => row.userId !== GUARDIAN)).toBe(true);
  });

  it("does not notify the author, even though they hold a code", async () => {
    await createDevoir(devoirInput);

    // A teacher who is also the head of studies has not created a decision for
    // themselves. Same rule as the carnet's.
    expect(recipientsOf("ASSESSMENT_CREATED")).not.toContain(TEACHER);
  });

  it("names the class, which is what makes it decidable", async () => {
    await createDevoir(devoirInput);

    const line = written.find((row) => row.kind === "ASSESSMENT_CREATED");
    expect(line?.params.className).toBe("3AP-A");
    expect(line?.params.teacher).toBe("Nadia B.");
    // The subject id is the paper, so the line opens the right one.
    expect(line?.subjectId).toBe("devoir-1");
  });

  it("still creates the devoir when telling the office fails", async () => {
    // `dispatch` swallows on purpose: the paper is written by the time it runs,
    // and losing it because an inbox row failed would be far worse.
    const { db } = await import("@/lib/db");
    const findUnique = db.assessment.findUnique;
    // @ts-expect-error — replacing a fake's method for one case.
    db.assessment.findUnique = async () => {
      throw new Error("inbox is down");
    };

    const result = await createDevoir(devoirInput);
    expect(result).toEqual({ ok: true, assessmentId: "devoir-1" });

    db.assessment.findUnique = findUnique;
  });
});

describe("the office opening it", () => {
  it("is what announces the paper to the families", async () => {
    assessmentStatus = "DRAFT";
    await setAssessmentStatus("devoir-1", "PUBLISHED");

    expect(recipientsOf("ASSESSMENT_SCHEDULED")).toEqual([GUARDIAN]);
    expect(resolved).toContain("guardiansOfClass");
  });

  it("does not announce it a second time when the teacher takes it back", async () => {
    /*
      SUBMITTED → PUBLISHED is a teacher pulling their own mark sheet back to fix
      a mark. It lands on PUBLISHED, which used to be the whole condition — so
      the announcement fired, from a teacher, with no decision behind it. On a
      devoir that had never been announced, this would have been the *first*
      thing the families heard.
    */
    assessmentStatus = "SUBMITTED";
    await setAssessmentStatus("devoir-1", "PUBLISHED");

    expect(recipientsOf("ASSESSMENT_SCHEDULED")).toEqual([]);
    expect(resolved).not.toContain("guardiansOfClass");
  });
});

describe("handing the marking back and forth", () => {
  it("puts a corrected paper on the office's list", async () => {
    assessmentStatus = "PUBLISHED";
    await setAssessmentStatus("devoir-1", "SUBMITTED");

    // The teacher is *not* excluded here, and that is the deliberate difference
    // from creation: handing marks up is real work for whoever validates them.
    expect(recipientsOf("ASSESSMENT_SUBMITTED")).toContain(DIRECTOR);
    expect(resolved).toContain("staffHolding:assessment.publish");
  });

  it("tells nobody's family that marking has finished", async () => {
    assessmentStatus = "PUBLISHED";
    await setAssessmentStatus("devoir-1", "SUBMITTED");

    // A handed-in sheet is provisional. The family hears when it is accepted.
    expect(written.every((row) => row.userId !== GUARDIAN)).toBe(true);
  });

  it("tells the families only once the office accepts the marks", async () => {
    assessmentStatus = "SUBMITTED";
    await setAssessmentStatus("devoir-1", "GRADED");

    expect(recipientsOf("MARKS_PUBLISHED")).toEqual([GUARDIAN]);
    // And the teacher hears that their paper was accepted.
    expect(recipientsOf("ASSESSMENT_VALIDATED")).toEqual([TEACHER]);
  });

  it("refuses to accept a sheet that is not finished", async () => {
    const { db } = await import("@/lib/db");
    const rosterOf = db.enrollment.findMany;
    // A roster of two against the one marked pupil on the row — so one child has
    // neither a mark nor an absence, which is what "unfinished" means here.
    // @ts-expect-error — replacing a fake's method for one case.
    db.enrollment.findMany = async () => [
      { id: "enrolment-1" },
      { id: "enrolment-2" },
    ];

    const result = await setAssessmentStatus("devoir-1", "GRADED");
    expect(result).toEqual({ ok: false, reason: "incomplete" });
    // Refused means refused: no family may be told about a half-marked sheet,
    // and the status must not have moved either.
    expect(written).toHaveLength(0);
    expect(updates).toHaveLength(0);

    db.enrollment.findMany = rosterOf;
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("the invariants the workflow rests on", () => {
  it("shows a family a mark only once it has been accepted", () => {
    /*
      The other half of "validated by the office", and the one that is pure data.
      COUNTED_STATUSES includes PUBLISHED and SUBMITTED, because a running
      average across a term genuinely should include a paper being marked — but
      a *family* reading that same paper would be reading a half-marked sheet as
      a result.
    */
    expect(FAMILY_VISIBLE_STATUSES).toEqual(["GRADED"]);
    expect(FAMILY_VISIBLE_STATUSES).not.toContain("PUBLISHED");
    expect(FAMILY_VISIBLE_STATUSES).not.toContain("SUBMITTED");
  });

  it("leaves a fresh devoir on the office's stage and nowhere else", () => {
    // The stage vocabulary already had a name for the gate; DRAFT is what puts a
    // paper on it. The devoirs review screen filters on exactly this value.
    expect(stageOf("DRAFT")).toBe("TO_PUBLISH");
    expect(statusesForStage("TO_PUBLISH")).toEqual(["DRAFT"]);
  });

  it("will not take a mark against a paper the office has not opened", () => {
    // Belt and braces on the same gate: even reaching the mark sheet of a DRAFT
    // devoir cannot write to it.
    expect(acceptsMarks("DRAFT")).toBe(false);
    expect(acceptsMarks("PUBLISHED")).toBe(true);
  });

  it("carries every stage of the workflow to a screen somebody can act on", () => {
    // A queue nobody can open is a queue nobody works, so each desk-facing kind
    // has to land somewhere. The new one goes to the list, not to the paper —
    // the office decides a morning's devoirs in one sitting.
    expect(webHref("ASSESSMENT_CREATED", { subjectId: "devoir-1" })).toBe(
      "/school-life/devoirs?stage=TO_PUBLISH",
    );
    expect(webHref("ASSESSMENT_SUBMITTED", { subjectId: "devoir-1" })).toBe(
      "/assessments/devoir-1",
    );
    // And the family-facing ones deliberately go nowhere on the web: a guardian
    // holds no membership, so every dashboard screen refuses them.
    expect(webHref("ASSESSMENT_SCHEDULED", { subjectId: "devoir-1" })).toBeNull();
    expect(webHref("MARKS_PUBLISHED", { subjectId: "devoir-1" })).toBeNull();
  });

  it("words the new kind in all three languages", () => {
    // The dictionary type would already catch a missing key; this catches the
    // subtler one — a placeholder the writer never supplies, which renders on a
    // real phone as a literal "{className}".
    for (const locale of LOCALES) {
      const template = getDictionaryFor(locale).notification.kinds
        .ASSESSMENT_CREATED;
      expect(template).toContain("{teacher}");
      expect(template).toContain("{assessment}");
      expect(template).toContain("{className}");
    }
  });

  it("keeps the office's own vocabulary out of the family's kinds", () => {
    // A sanity check on the split the enum file claims: one kind, one audience.
    // If ASSESSMENT_CREATED ever grew a family recipient this would still pass,
    // which is why the write-path tests above exist — but a kind that reads as
    // an instruction to the office must never be worded at a parent.
    expect(t.notification.kinds.ASSESSMENT_CREATED).toContain(
      "awaiting your decision",
    );
  });
});
