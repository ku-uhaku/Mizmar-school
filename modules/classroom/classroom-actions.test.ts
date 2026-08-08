import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/lib/permissions";
import { getDictionaryFor } from "@/lib/i18n/server";

/**
 * The espace enseignant's four actions, against a faked database.
 *
 * Each one draws a line the queries cannot: a permission says *what* somebody
 * may do, and nothing in the catalogue can say "to their own classes only". So
 * the actions carry the other half —
 *
 *   * the teacher comes from the session, never from the form;
 *   * `actsForSchool` is read off the **office-side** code of each pair
 *     (`attendanceJustify` for the register, `remarkPublish` for the carnet), so
 *     standing in for a colleague is a grant somebody made rather than a hole;
 *   * releasing a remark to the family is checked again here, whatever the form
 *     said, because the checkbox is drawn by a client component;
 *   * a justification applies to an absence or a retard, and to nothing else.
 */

const t = getDictionaryFor("en");

const SCHOOL = "school-1";
const TEACHER = "teacher-1";

type AttendanceRow = {
  id: string;
  schoolId: string;
  status: string;
};

const attendance = new Map<string, AttendanceRow>();
const remarksWritten: Record<string, unknown>[] = [];
const remarkDeletes: Record<string, unknown>[] = [];
const attendanceUpdates: { id: string; data: Record<string, unknown> }[] = [];
const registerWrites: Record<string, unknown>[] = [];

function seed() {
  attendance.clear();
  remarksWritten.length = 0;
  remarkDeletes.length = 0;
  attendanceUpdates.length = 0;
  registerWrites.length = 0;

  attendance.set("absent", { id: "absent", schoolId: SCHOOL, status: "ABSENT" });
  attendance.set("late", { id: "late", schoolId: SCHOOL, status: "LATE" });
  attendance.set("present", {
    id: "present",
    schoolId: SCHOOL,
    status: "PRESENT",
  });
  // Another school's mark, present so a crafted id has something to reach.
  attendance.set("foreign", {
    id: "foreign",
    schoolId: "school-2",
    status: "ABSENT",
  });
}

type AttendanceWhere = {
  id?: string;
  enrollment?: { student?: { schoolId?: string } };
  status?: { in?: string[] };
};

vi.mock("@/lib/db", () => ({
  db: {
    studentAttendance: {
      findFirst: async ({ where }: { where: AttendanceWhere }) => {
        const row = where.id ? attendance.get(where.id) : undefined;
        if (!row) return null;
        const school = where.enrollment?.student?.schoolId;
        if (school !== undefined && school !== row.schoolId) return null;
        if (where.status?.in && !where.status.in.includes(row.status)) {
          return null;
        }
        return { id: row.id, status: row.status };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        attendanceUpdates.push({ id: where.id, data });
        return { id: where.id };
      },
      upsert: async (args: { create: Record<string, unknown> }) => {
        registerWrites.push(args.create);
        return {};
      },
    },
    studentRemark: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        remarksWritten.push(data);
        return { id: "remark-1" };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        remarkDeletes.push(where);
        // Only the teacher's own remark, or any of the school's for the office.
        const own = where["authorId"];
        return { count: own === undefined || own === TEACHER ? 1 : 0 };
      },
    },
    teachingAssignment: {
      findFirst: async ({
        where,
      }: {
        where: { teacherId?: string; schoolClassId?: string };
      }) =>
        where.teacherId === TEACHER && where.schoolClassId === "class-1"
          ? { classGroupId: null }
          : null,
    },
    schoolClass: {
      findFirst: async ({
        where,
      }: {
        where: { id?: string; schoolId?: string };
      }) =>
        where.id === "class-1" && where.schoolId === SCHOOL
          ? { id: "class-1" }
          : null,
    },
    enrollment: {
      findMany: async () => [{ id: "enrol-1" }],
      findFirst: async ({
        where,
      }: {
        where: {
          id?: string;
          schoolClass?: {
            schoolId?: string;
            assignments?: { some: { teacherId: string } };
          };
        };
      }) => {
        if (where.id !== "enrol-1") return null;
        if (where.schoolClass?.schoolId !== SCHOOL) return null;
        // Only the teacher's own pupils, unless the clause was dropped.
        const some = where.schoolClass.assignments?.some;
        if (some && some.teacherId !== TEACHER) return null;
        return { id: "enrol-1" };
      },
    },
    $transaction: async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
  },
  auditClient: {},
}));

vi.mock("@/lib/audit", () => ({ recordEvent: async () => {} }));

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
    currentSchoolYear: { id: "year-1" },
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
  deleteRemarkAction,
  justifyAbsenceAction,
  saveRegisterAction,
  saveRemarkAction,
} = await import("@/modules/classroom/actions");

const IDLE = { status: "idle" } as never;

/** A teacher: marks their own registers and writes internal notes. */
function asTeacher(id = TEACHER) {
  granted.clear();
  granted.add(PERMISSIONS.CLASSROOM_WORKSPACE);
  granted.add(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK);
  granted.add(PERMISSIONS.CLASSROOM_REMARK_WRITE);
  actor = id;
}

/** The vie scolaire: accepts justifications and releases remarks. */
function asOffice() {
  asTeacher("office-1");
  granted.add(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW);
  granted.add(PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY);
  granted.add(PERMISSIONS.CLASSROOM_REMARK_PUBLISH);
}

function registerForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("schoolClassId", "class-1");
  form.set("subjectId", "maths");
  form.set("timeSlotId", "slot-1");
  form.set("date", "2026-01-15");
  form.append("enrollmentId", "enrol-1");
  form.append("status", "PRESENT");
  form.append("minutesLate", "");
  form.append("reason", "");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

function remarkForm(extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("enrollmentId", "enrol-1");
  form.set("subjectId", "maths");
  form.set("kind", "WORK");
  form.set("tone", "CONCERN");
  form.set("body", "N'apporte pas son livre.");
  form.set("occurredOn", "2026-01-15");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

function justifyForm(attendanceId: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("attendanceId", attendanceId);
  form.set("isJustified", "on");
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

beforeEach(() => {
  seed();
  asked.length = 0;
  asTeacher();
});

// ── The register ─────────────────────────────────────────────────────────────

describe("saveRegisterAction", () => {
  it("asks for the marking code before reading anything", async () => {
    granted.clear();
    const state = await saveRegisterAction(IDLE, registerForm());

    expect(asked).toEqual([PERMISSIONS.CLASSROOM_ATTENDANCE_MARK]);
    expect(state.status).toBe("error");
    expect(registerWrites).toEqual([]);
  });

  it("takes the register for the teacher's own class", async () => {
    const state = await saveRegisterAction(IDLE, registerForm());
    expect(state.status).toBe("success");
    expect(registerWrites).toHaveLength(1);
  });

  it("refuses a class the teacher does not teach", async () => {
    const state = await saveRegisterAction(
      IDLE,
      registerForm({ schoolClassId: "class-2" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toBe(t.classroom.notYourClass);
    expect(registerWrites).toEqual([]);
  });

  it("lets the office stand in, on the office half of the pair", async () => {
    // `classroom.attendanceJustify` is what unlocks taking a register for a
    // class the actor does not teach — a code whose own doc comment already
    // says it is an office decision.
    asOffice();
    const state = await saveRegisterAction(
      IDLE,
      registerForm({ schoolClassId: "class-1" }),
    );
    expect(state.status).toBe("success");
  });

  it("does not let the marking code alone stand in for a colleague", async () => {
    // Which is the difference between a teacher and the office: holding
    // `attendanceMark` marks your own classes and nobody else's.
    const state = await saveRegisterAction(
      IDLE,
      registerForm({ schoolClassId: "class-2" }),
    );
    expect(state.status).toBe("error");
  });

  it("records the teacher from the session, never from the form", async () => {
    const form = registerForm();
    form.set("teacherId", "somebody-else");
    await saveRegisterAction(IDLE, form);

    expect(registerWrites[0]!["recordedById"]).toBe(TEACHER);
  });

  it("falls back to PRESENT for a status the client invented", async () => {
    // The column is an enum by convention only, so anything unrecognised is
    // written as present rather than through.
    const form = registerForm();
    form.delete("status");
    form.append("status", "TRUANT");
    await saveRegisterAction(IDLE, form);

    expect(registerWrites[0]!["status"]).toBe("PRESENT");
  });

  it("refuses a register whose columns do not line up", async () => {
    // The rows travel as parallel arrays indexed by pupil. A short column would
    // shift every status below it onto the wrong child.
    const form = registerForm();
    form.append("enrollmentId", "enrol-2");
    const state = await saveRegisterAction(IDLE, form);

    expect(state.status).toBe("error");
    expect(registerWrites).toEqual([]);
  });

  it("refuses a date it cannot read", async () => {
    const state = await saveRegisterAction(
      IDLE,
      registerForm({ date: "not-a-date" }),
    );
    expect(state.status).toBe("error");
    expect(registerWrites).toEqual([]);
  });

  it("reads the whole-day sentinel as no period at all", async () => {
    const form = registerForm({ timeSlotId: "__none__", subjectId: "" });
    await saveRegisterAction(IDLE, form);
    expect(registerWrites[0]).toMatchObject({
      timeSlotId: null,
      subjectId: null,
      scopeKey: "__day__",
    });
  });
});

// ── The carnet ───────────────────────────────────────────────────────────────

describe("saveRemarkAction", () => {
  it("asks for the writing code before reading anything", async () => {
    granted.clear();
    const state = await saveRemarkAction(IDLE, remarkForm());

    expect(asked).toEqual([PERMISSIONS.CLASSROOM_REMARK_WRITE]);
    expect(state.status).toBe("error");
    expect(remarksWritten).toEqual([]);
  });

  it("writes an internal note by default", async () => {
    const state = await saveRemarkAction(IDLE, remarkForm());
    expect(state.status).toBe("success");
    expect(remarksWritten[0]!["isVisibleToFamily"]).toBe(false);
  });

  it("refuses to release a remark for a teacher without the publish code", async () => {
    // The checkbox is drawn by a client component, so it is checked again here:
    // a teacher without the grant writes an internal note whatever the form
    // said.
    const form = remarkForm();
    form.set("isVisibleToFamily", "on");
    const state = await saveRemarkAction(IDLE, form);

    expect(state.status).toBe("success");
    expect(remarksWritten[0]!["isVisibleToFamily"]).toBe(false);
  });

  it("releases one for somebody who holds the publish code", async () => {
    asOffice();
    const form = remarkForm();
    form.set("isVisibleToFamily", "on");
    await saveRemarkAction(IDLE, form);

    expect(remarksWritten[0]!["isVisibleToFamily"]).toBe(true);
  });

  it("keeps a remark internal when the publisher did not ask", async () => {
    asOffice();
    await saveRemarkAction(IDLE, remarkForm());
    expect(remarksWritten[0]!["isVisibleToFamily"]).toBe(false);
  });

  it("signs the remark with the session's user, never the form's", async () => {
    const form = remarkForm();
    form.set("authorId", "somebody-else");
    await saveRemarkAction(IDLE, form);

    expect(remarksWritten[0]!["authorId"]).toBe(TEACHER);
  });

  it("refuses a pupil the teacher does not teach", async () => {
    asTeacher("teacher-2");
    const state = await saveRemarkAction(IDLE, remarkForm());

    expect(state.status).toBe("error");
    expect(state.message).toBe(t.classroom.notYourPupil);
    expect(remarksWritten).toEqual([]);
  });

  it("lets the office write about any pupil of the school", async () => {
    asOffice();
    const state = await saveRemarkAction(IDLE, remarkForm());
    expect(state.status).toBe("success");
  });

  it("refuses a remark with nothing in it", async () => {
    const state = await saveRemarkAction(IDLE, remarkForm({ body: "  " }));
    expect(state.status).toBe("error");
    expect(remarksWritten).toEqual([]);
  });

  it("reads the no-subject sentinel as a general remark", async () => {
    await saveRemarkAction(IDLE, remarkForm({ subjectId: "__none__" }));
    expect(remarksWritten[0]!["subjectId"]).toBeNull();
  });
});

describe("deleteRemarkAction", () => {
  it("scopes a teacher's deletion to their own remarks", async () => {
    // A colleague's note is not theirs to remove.
    await deleteRemarkAction("remark-1");
    expect(remarkDeletes[0]).toMatchObject({
      id: "remark-1",
      authorId: TEACHER,
    });
  });

  it("scopes the office's deletion to the school instead", async () => {
    // Somebody has to be able to take down a remark written in anger or about
    // the wrong child — and `remarkPublish`, which decides what a family sees,
    // is the right code to also decide what is retracted.
    asOffice();
    await deleteRemarkAction("remark-1");

    const where = remarkDeletes[0]!;
    expect(where).not.toHaveProperty("authorId");
    expect(where).toMatchObject({
      id: "remark-1",
      enrollment: { student: { schoolId: SCHOOL } },
    });
  });

  it("reports not-yours when nothing matched", async () => {
    asTeacher("teacher-2");
    const state = await deleteRemarkAction("remark-1");
    expect(state.status).toBe("error");
    expect(state.message).toBe(t.classroom.notYourRemark);
  });

  it("asks for the writing code first", async () => {
    granted.clear();
    const state = await deleteRemarkAction("remark-1");
    expect(asked).toEqual([PERMISSIONS.CLASSROOM_REMARK_WRITE]);
    expect(state.status).toBe("error");
    expect(remarkDeletes).toEqual([]);
  });
});

// ── The justification ────────────────────────────────────────────────────────

describe("justifyAbsenceAction", () => {
  it("is the office's decision, not the teacher's", async () => {
    // A teacher records that a child was not there; somebody else decides
    // whether the note the family sent excuses it.
    const state = await justifyAbsenceAction(IDLE, justifyForm("absent"));

    expect(asked).toEqual([PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY]);
    expect(state.status).toBe("error");
    expect(attendanceUpdates).toEqual([]);
  });

  it("accepts a justification for an absence", async () => {
    asOffice();
    const state = await justifyAbsenceAction(IDLE, justifyForm("absent"));

    expect(state.status).toBe("success");
    expect(attendanceUpdates[0]!.data).toMatchObject({
      isJustified: true,
      status: "EXCUSED",
    });
  });

  it("accepts one for a retard without turning it into an absence", async () => {
    // The regression. This used to rewrite every row it touched as EXCUSED, so
    // justifying a late erased the lateness — and a school writes to the family
    // on the third retard.
    asOffice();
    const state = await justifyAbsenceAction(IDLE, justifyForm("late"));

    expect(state.status).toBe("success");
    expect(attendanceUpdates[0]!.data).toMatchObject({ isJustified: true });
    expect(attendanceUpdates[0]!.data).not.toHaveProperty("status");
  });

  it("refuses a pupil who was in the room on time", async () => {
    // There is nothing to excuse, and writing one would turn a present pupil
    // into an absentee.
    asOffice();
    const state = await justifyAbsenceAction(IDLE, justifyForm("present"));

    expect(state.status).toBe("error");
    expect(state.message).toBe(t.errors.notFound);
    expect(attendanceUpdates).toEqual([]);
  });

  it("refuses a mark belonging to another school", async () => {
    asOffice();
    const state = await justifyAbsenceAction(IDLE, justifyForm("foreign"));

    expect(state.status).toBe("error");
    expect(attendanceUpdates).toEqual([]);
  });

  it("refuses an id nobody declared", async () => {
    asOffice();
    const state = await justifyAbsenceAction(IDLE, justifyForm("no-such-mark"));
    expect(state.status).toBe("error");
    expect(attendanceUpdates).toEqual([]);
  });

  it("withdraws a justification and puts the absence back", async () => {
    asOffice();
    const form = justifyForm("absent");
    form.delete("isJustified");
    await justifyAbsenceAction(IDLE, form);

    expect(attendanceUpdates[0]!.data).toMatchObject({
      isJustified: false,
      status: "ABSENT",
    });
  });

  it("leaves the note alone when none was sent", async () => {
    asOffice();
    await justifyAbsenceAction(IDLE, justifyForm("absent"));
    expect(attendanceUpdates[0]!.data).not.toHaveProperty("reason");
  });

  it("records the note when one was", async () => {
    asOffice();
    await justifyAbsenceAction(
      IDLE,
      justifyForm("absent", { reason: "Certificat médical." }),
    );
    expect(attendanceUpdates[0]!.data["reason"]).toBe("Certificat médical.");
  });
});
