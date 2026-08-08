import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";

/**
 * Who may write a mark, against a faked database.
 *
 * A school has one teacher per subject per class and a couple of people in the
 * office, and the module draws the line between them three times:
 *
 *   * **the office plans, the teacher marks.** Generating a term's contrôles is
 *     `assessment.manage`; typing the marks is `assessment.grade`. Granting mark
 *     entry must not hand over the calendar.
 *   * **handing a paper back is the teacher's own move**, and the one the office
 *     cannot make on their behalf — so it is confined to their own paper by a
 *     `where`, not by an `if`, and asking after a colleague's is indistinguishable
 *     from asking after one that does not exist.
 *   * **a devoir belongs to whoever set it.** A contrôle the office planned is
 *     anybody's to mark — covering for an absent colleague is the ordinary case
 *     — but a piece of work a teacher set for their own class is theirs.
 *
 * The third one is why this file exists. `findMarkSheet` has always refused to
 * *show* a colleague's devoir; the write path asked only for the school and the
 * year, so a mark could be posted onto a sheet the poster could not open. A
 * Server Function is reachable by direct POST, which is exactly the reason the
 * read was narrowed in the first place.
 */

const t = getDictionaryFor("en");

const SCHOOL = "school-1";
const YEAR = "year-1";
const TEACHER = "teacher-1";
const COLLEAGUE = "teacher-2";

type PaperRow = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  status: string;
  maxScore: number;
  teacherId: string | null;
  createdById: string | null;
  /** `AssessmentType.allowTeacherCreate` — true for a devoir. */
  isDevoir: boolean;
};

const papers = new Map<string, PaperRow>();
const marksWritten: unknown[] = [];
const statusWrites: { id: string; status: string }[] = [];

function seed() {
  papers.clear();
  marksWritten.length = 0;
  statusWrites.length = 0;

  // A contrôle the head of studies planned, attributed to one teacher.
  papers.set("controle", {
    id: "controle",
    schoolId: SCHOOL,
    schoolYearId: YEAR,
    status: "PUBLISHED",
    maxScore: 20,
    teacherId: TEACHER,
    createdById: "office-1",
    isDevoir: false,
  });
  // A devoir the colleague set for their own class.
  papers.set("devoir-colleague", {
    id: "devoir-colleague",
    schoolId: SCHOOL,
    schoolYearId: YEAR,
    status: "PUBLISHED",
    maxScore: 20,
    teacherId: COLLEAGUE,
    createdById: COLLEAGUE,
    isDevoir: true,
  });
  // The teacher's own devoir.
  papers.set("devoir-mine", {
    id: "devoir-mine",
    schoolId: SCHOOL,
    schoolYearId: YEAR,
    status: "PUBLISHED",
    maxScore: 20,
    teacherId: TEACHER,
    createdById: TEACHER,
    isDevoir: true,
  });
  // Another school's paper, present so a crafted id has something to reach.
  papers.set("foreign", {
    id: "foreign",
    schoolId: "school-2",
    schoolYearId: YEAR,
    status: "PUBLISHED",
    maxScore: 20,
    teacherId: TEACHER,
    createdById: TEACHER,
    isDevoir: false,
  });
  // Last year's paper, in this school.
  papers.set("last-year", {
    id: "last-year",
    schoolId: SCHOOL,
    schoolYearId: "year-0",
    status: "PUBLISHED",
    maxScore: 20,
    teacherId: TEACHER,
    createdById: TEACHER,
    isDevoir: false,
  });
}

/** The subset of Prisma's `where` these actions actually build. */
type Where = {
  id?: string;
  schoolId?: string;
  term?: { schoolYearId?: string };
  teacherId?: string;
  OR?: {
    assessmentType?: { allowTeacherCreate?: boolean };
    teacherId?: string;
    createdById?: string;
  }[];
};

function matches(row: PaperRow, where: Where): boolean {
  if (where.id !== undefined && where.id !== row.id) return false;
  if (where.schoolId !== undefined && where.schoolId !== row.schoolId) return false;
  if (
    where.term?.schoolYearId !== undefined &&
    where.term.schoolYearId !== row.schoolYearId
  ) {
    return false;
  }
  if (where.teacherId !== undefined && where.teacherId !== row.teacherId) {
    return false;
  }
  if (where.OR) {
    const any = where.OR.some((clause) => {
      if (clause.assessmentType) {
        return clause.assessmentType.allowTeacherCreate === row.isDevoir;
      }
      if (clause.teacherId) return clause.teacherId === row.teacherId;
      if (clause.createdById) return clause.createdById === row.createdById;
      return false;
    });
    if (!any) return false;
  }
  return true;
}

vi.mock("@/lib/db", () => ({
  db: {
    assessment: {
      findFirst: async ({ where }: { where: Where }) =>
        [...papers.values()].find((row) => matches(row, where)) ?? null,
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 1 }),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: string };
      }) => {
        statusWrites.push({ id: where.id, status: data.status });
        return { id: where.id };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = papers.get(where.id);
        return row
          ? {
              ...row,
              schoolClassId: "class-1",
              classGroupId: null,
              term: { schoolYearId: row.schoolYearId },
              grades: [{ enrollmentId: "enrol-1" }],
            }
          : null;
      },
    },
    assessmentGrade: {
      count: async () => 0,
      upsert: async (args: unknown) => {
        marksWritten.push(args);
        return {};
      },
    },
    enrollment: {
      findMany: async () => [{ id: "enrol-1" }],
      count: async () => 1,
    },
    $transaction: async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
  },
  auditClient: {},
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

// Authorization itself is `lib/dal.ts`'s job and is tested there. What matters
// here is only *that* the actions ask, and with which code.
const granted = new Set<string>();
const asked: string[] = [];
let actor = TEACHER;

class ForbiddenError extends Error {
  readonly permission?: string;
  constructor(permission?: string) {
    super(permission ? `Missing permission: ${permission}` : "Forbidden");
    this.permission = permission;
    this.name = "ForbiddenError";
  }
}

vi.mock("@/lib/dal", () => ({
  ForbiddenError,
  requireAuth: async () => ({
    organization: { id: "org-1" },
    currentSchool: { id: SCHOOL },
    currentSchoolYear: { id: YEAR },
    user: { id: actor },
    can: (code: string) => granted.has(code),
    canOrg: (code: string) => granted.has(code),
    canInSchool: (_school: string, code: string) => granted.has(code),
  }),
  authorizeSchool: async (_schoolId: string, permission: string) => {
    asked.push(permission);
    if (!granted.has(permission)) throw new ForbiddenError(permission);
    return { currentSchool: { id: SCHOOL } };
  },
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/server")>()),
  getDictionary: async () => t,
}));

vi.mock("next/cache", () => ({ refresh: () => {} }));

const {
  deleteAssessmentAction,
  saveMarksAction,
  setAssessmentStatusAction,
} = await import("@/modules/assessments/actions");

const IDLE = { status: "idle" } as never;

/** A mark sheet posted for one pupil. */
function marksForm(assessmentId: string, score = "13.5") {
  const form = new FormData();
  form.set("assessmentId", assessmentId);
  form.append("enrollmentId", "enrol-1");
  form.append("score", score);
  form.append("absent", "0");
  form.append("excused", "0");
  form.append("comment", "");
  return form;
}

function statusForm(id: string, status: string) {
  const form = new FormData();
  form.set("id", id);
  form.set("status", status);
  return form;
}

/** A teacher: marks their classes, sets nothing, publishes nothing. */
function asTeacher(id = TEACHER) {
  granted.clear();
  granted.add(PERMISSIONS.ASSESSMENT_VIEW);
  granted.add(PERMISSIONS.ASSESSMENT_GRADE);
  actor = id;
}

/** The office: plans the round and validates the marking. */
function asOffice() {
  granted.clear();
  granted.add(PERMISSIONS.ASSESSMENT_VIEW);
  granted.add(PERMISSIONS.ASSESSMENT_MANAGE);
  granted.add(PERMISSIONS.ASSESSMENT_GRADE);
  granted.add(PERMISSIONS.ASSESSMENT_PUBLISH);
  granted.add(PERMISSIONS.ASSESSMENT_DELETE);
  actor = "office-1";
}

beforeEach(() => {
  seed();
  asked.length = 0;
  asTeacher();
});

// ── Marking ──────────────────────────────────────────────────────────────────

describe("saveMarksAction", () => {
  it("asks for assessment.grade before reading anything", async () => {
    granted.clear();
    const state = await saveMarksAction(IDLE, marksForm("controle"));

    expect(asked).toEqual([PERMISSIONS.ASSESSMENT_GRADE]);
    expect(state.status).toBe("error");
    expect(marksWritten).toEqual([]);
  });

  it("lets any teacher mark a contrôle the office planned", async () => {
    // Deliberate: covering for an absent colleague is the ordinary case, and a
    // contrôle is the school's paper rather than one person's.
    asTeacher(COLLEAGUE);
    const state = await saveMarksAction(IDLE, marksForm("controle"));

    expect(state.status).toBe("success");
    expect(marksWritten).toHaveLength(1);
  });

  it("lets a teacher mark their own devoir", async () => {
    const state = await saveMarksAction(IDLE, marksForm("devoir-mine"));
    expect(state.status).toBe("success");
    expect(marksWritten).toHaveLength(1);
  });

  it("refuses to write a mark onto a colleague's devoir", async () => {
    // The regression. `findMarkSheet` has always refused to show this sheet;
    // the write path used to ask only for the school and the year, so the mark
    // went through on a paper the poster could not open.
    const state = await saveMarksAction(IDLE, marksForm("devoir-colleague"));

    expect(state.status).toBe("error");
    expect(marksWritten).toEqual([]);
  });

  it("says not-found rather than forbidden for a colleague's devoir", async () => {
    // So a teacher cannot probe which devoirs their colleagues have set.
    const state = await saveMarksAction(IDLE, marksForm("devoir-colleague"));
    expect(state.message).toBe(t.errors.notFound);
  });

  it("refuses a paper belonging to another school", async () => {
    const state = await saveMarksAction(IDLE, marksForm("foreign"));
    expect(state.status).toBe("error");
    expect(marksWritten).toEqual([]);
  });

  it("refuses a paper from a year that is not in context", async () => {
    // Last year's contrôles are not this year's to remark, and the year comes
    // from the working context rather than from the request.
    const state = await saveMarksAction(IDLE, marksForm("last-year"));
    expect(state.status).toBe("error");
    expect(marksWritten).toEqual([]);
  });

  it("refuses an id nobody declared", async () => {
    const state = await saveMarksAction(IDLE, marksForm("no-such-paper"));
    expect(state.status).toBe("error");
    expect(marksWritten).toEqual([]);
  });

  it("refuses a sheet whose columns do not line up", async () => {
    // The rows travel as parallel arrays indexed by pupil. A short column would
    // shift every mark below it onto the wrong child.
    const form = marksForm("controle");
    form.append("enrollmentId", "enrol-2");
    const state = await saveMarksAction(IDLE, form);

    expect(state.status).toBe("error");
    expect(marksWritten).toEqual([]);
  });

  it("reports the paper's own maximum when a mark is out of range", async () => {
    const state = await saveMarksAction(IDLE, marksForm("controle", "99"));
    expect(state.status).toBe("error");
    expect(state.message).toContain("20");
    expect(marksWritten).toEqual([]);
  });

  it("stamps the marks with whoever typed them", async () => {
    await saveMarksAction(IDLE, marksForm("controle"));
    const write = marksWritten[0] as { create: { gradedById: string } };
    expect(write.create.gradedById).toBe(TEACHER);
  });
});

// ── Handing a paper back, and taking it ──────────────────────────────────────

describe("setAssessmentStatusAction", () => {
  it("lets a teacher hand back their own paper", async () => {
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "SUBMITTED"),
    );

    expect(asked).toEqual([PERMISSIONS.ASSESSMENT_GRADE]);
    expect(state.status).toBe("success");
    expect(statusWrites).toEqual([{ id: "controle", status: "SUBMITTED" }]);
  });

  it("refuses a teacher the paper of a colleague", async () => {
    // Confined by a `where`, so asking after somebody else's paper is
    // indistinguishable from asking after one that does not exist.
    asTeacher(COLLEAGUE);
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "SUBMITTED"),
    );

    expect(state.status).toBe("error");
    expect(statusWrites).toEqual([]);
  });

  it("refuses a teacher every move that is the office's", async () => {
    // Announcing a paper, accepting the marks and cancelling one are decisions
    // about when marks are released, which is not what mark entry buys.
    for (const status of ["GRADED", "CANCELLED", "DRAFT"]) {
      statusWrites.length = 0;
      const state = await setAssessmentStatusAction(
        IDLE,
        statusForm("controle", status),
      );
      expect(state.status, status).toBe("error");
      expect(statusWrites, status).toEqual([]);
    }
  });

  it("refuses a teacher a paper the office has already accepted", async () => {
    // A GRADED paper is finished; reopening it is the office's decision.
    papers.get("controle")!.status = "GRADED";
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "SUBMITTED"),
    );

    expect(state.status).toBe("error");
    expect(statusWrites).toEqual([]);
  });

  it("refuses a teacher a paper that has not been announced", async () => {
    // Opening a DRAFT for marking is publishing it, which is the office's own
    // permission.
    papers.get("controle")!.status = "DRAFT";
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "PUBLISHED"),
    );

    expect(state.status).toBe("error");
    expect(statusWrites).toEqual([]);
  });

  it("lets a teacher take back a paper they handed in", async () => {
    papers.get("controle")!.status = "SUBMITTED";
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "PUBLISHED"),
    );
    expect(state.status).toBe("success");
  });

  it("lets the office move any of its own school's papers", async () => {
    asOffice();
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "GRADED"),
    );

    expect(asked).toEqual([PERMISSIONS.ASSESSMENT_PUBLISH]);
    expect(state.status).toBe("success");
  });

  it("refuses the office a paper of another school", async () => {
    asOffice();
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("foreign", "GRADED"),
    );
    expect(state.status).toBe("error");
    expect(statusWrites).toEqual([]);
  });

  it("refuses a status nothing recognises", async () => {
    asOffice();
    for (const status of ["", "DONE", "graded", "__proto__"]) {
      statusWrites.length = 0;
      const state = await setAssessmentStatusAction(
        IDLE,
        statusForm("controle", status),
      );
      expect(state.status, status).toBe("error");
      expect(statusWrites, status).toEqual([]);
    }
  });

  it("refuses somebody holding neither code", async () => {
    granted.clear();
    granted.add(PERMISSIONS.ASSESSMENT_VIEW);
    const state = await setAssessmentStatusAction(
      IDLE,
      statusForm("controle", "SUBMITTED"),
    );

    expect(state.status).toBe("error");
    expect(statusWrites).toEqual([]);
  });
});

// ── Deleting ─────────────────────────────────────────────────────────────────

describe("deleteAssessmentAction", () => {
  it("refuses a teacher, who holds no delete code", async () => {
    const state = await deleteAssessmentAction("controle");
    expect(asked).toEqual([PERMISSIONS.ASSESSMENT_DELETE]);
    expect(state.status).toBe("error");
  });

  it("lets the office delete a paper nobody has marked", async () => {
    asOffice();
    const state = await deleteAssessmentAction("controle");
    expect(state.status).toBe("success");
  });

  it("refuses to delete a paper that has been marked", async () => {
    // Marks are the point of the paper, and deleting one would destroy work
    // somebody did. Cancelling keeps the row and the history.
    asOffice();
    const { db } = (await import("@/lib/db")) as unknown as {
      db: { assessmentGrade: { count: () => Promise<number> } };
    };
    db.assessmentGrade.count = async () => 12;

    const state = await deleteAssessmentAction("controle");
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.assessment.cannotDeleteMarked);

    db.assessmentGrade.count = async () => 0;
  });

  it("refuses a paper of another school", async () => {
    asOffice();
    const state = await deleteAssessmentAction("foreign");
    expect(state.status).toBe("error");
  });
});
