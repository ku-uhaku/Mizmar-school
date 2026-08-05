import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolId, schoolScope, yearScope } from "@/lib/scope";
import {
  MISSING_STATUSES,
  startOfDay,
  tallyAttendance,
  type AttendanceTally,
} from "@/modules/classroom/enums";

/**
 * Reads for the espace enseignant.
 *
 * ── The rule the whole file turns on ─────────────────────────────────────────
 * Every read here is confined to the signed-in teacher's own
 * `TeachingAssignment` rows, and never to a class id from the request. A teacher
 * opening this workspace may reach the classes they teach and nothing else —
 * not another teacher's roster, not another class's remarks — and because that
 * confinement is in the `where` rather than in a check on the page, a crafted id
 * simply matches nothing.
 *
 * A user with a school-wide grant still only sees their own assignments here.
 * The whole-school view of the same data belongs on the vie scolaire screens,
 * where it is scoped by permission instead.
 */

export type TeachingSlot = {
  assignmentId: string;
  schoolClassId: string;
  classCode: string;
  className: string | null;
  levelLabel: string;
  classGroupId: string | null;
  groupLabel: string | null;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectColorHex: string | null;
  /** Pupils on this assignment's roster — the class, or the group. */
  rosterCount: number;
};

/** A group is named by its own name when it has one, else by its code. */
function groupLabel(
  group: { code: string; name: string | null } | null | undefined,
): string | null {
  if (!group) return null;
  return group.name ?? group.code;
}

/**
 * What the signed-in teacher teaches this year: one row per class and subject.
 *
 * This is the spine of the workspace — every other read starts from it, and it
 * is what makes "their own classes" enforceable rather than aspirational.
 */
export async function listMyTeaching(
  context: AuthContext,
): Promise<TeachingSlot[]> {
  const assignments = await db.teachingAssignment.findMany({
    where: {
      teacherId: context.user.id,
      schoolClass: {
        schoolId: currentSchoolId(context),
        levelOffering: yearScope(context),
      },
    },
    orderBy: [{ schoolClass: { code: "asc" } }, { subject: { code: "asc" } }],
    select: {
      id: true,
      classGroupId: true,
      schoolClass: {
        select: {
          id: true,
          code: true,
          name: true,
          levelOffering: { select: { level: { select: { code: true } } } },
          _count: { select: { enrollments: true } },
        },
      },
      classGroup: {
        select: {
          code: true,
          name: true,
          _count: { select: { enrollments: true } },
        },
      },
      subject: { select: { id: true, code: true, name: true, colorHex: true } },
    },
  });

  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    schoolClassId: assignment.schoolClass.id,
    classCode: assignment.schoolClass.code,
    className: assignment.schoolClass.name,
    levelLabel: assignment.schoolClass.levelOffering.level.code,
    classGroupId: assignment.classGroupId,
    groupLabel: groupLabel(assignment.classGroup),
    subjectId: assignment.subject.id,
    subjectCode: assignment.subject.code,
    subjectName: assignment.subject.name,
    subjectColorHex: assignment.subject.colorHex,
    // A group assignment is sat by the group; a whole-class one by everybody.
    rosterCount:
      assignment.classGroup?._count.enrollments ??
      assignment.schoolClass._count.enrollments,
  }));
}

export type LessonSlot = {
  timetableEntryId: string;
  timeSlotId: string;
  startTime: string;
  endTime: string;
  schoolClassId: string;
  classCode: string;
  classGroupId: string | null;
  groupLabel: string | null;
  subjectId: string;
  subjectName: string;
  subjectColorHex: string | null;
  roomCode: string | null;
  /** True once every pupil on that roster has a mark for this period. */
  isMarked: boolean;
};

/**
 * The teacher's lessons on one day, in order, each saying whether its register
 * has been taken.
 *
 * The "taken" flag is what makes the workspace home useful at 8am: the question
 * a teacher has is not "what is my timetable" — they know that — it is "which
 * of today's registers have I not done yet".
 */
export async function listMyLessons(
  context: AuthContext,
  date: Date,
): Promise<LessonSlot[]> {
  const day = startOfDay(date);
  // JavaScript numbers Sunday 0; the schema numbers Monday 1 through Saturday 6.
  const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();

  const entries = await db.timetableEntry.findMany({
    where: {
      teacherId: context.user.id,
      timeSlot: { ...yearScope(context), dayOfWeek, isBreak: false },
      schoolClass: { schoolId: currentSchoolId(context) },
    },
    orderBy: [{ timeSlot: { position: "asc" } }],
    select: {
      id: true,
      classGroupId: true,
      timeSlot: {
        select: { id: true, startTime: true, endTime: true },
      },
      schoolClass: { select: { id: true, code: true } },
      classGroup: { select: { code: true, name: true } },
      subject: { select: { id: true, name: true, colorHex: true } },
      room: { select: { code: true } },
    },
  });

  if (entries.length === 0) return [];

  // One query for the whole day's marks rather than one per lesson.
  const marks = await db.studentAttendance.findMany({
    where: {
      date: day,
      timeSlotId: { in: entries.map((entry) => entry.timeSlot.id) },
      enrollment: { ...yearScope(context) },
    },
    select: { timeSlotId: true, enrollmentId: true },
  });

  const rosterCounts = await db.enrollment.groupBy({
    by: ["schoolClassId"],
    where: {
      ...yearScope(context),
      schoolClassId: { in: entries.map((entry) => entry.schoolClass.id) },
    },
    _count: { _all: true },
  });
  const rosterByClass = new Map(
    rosterCounts.map((row) => [row.schoolClassId, row._count._all]),
  );

  return entries.map((entry) => {
    const marked = marks.filter(
      (mark) => mark.timeSlotId === entry.timeSlot.id,
    ).length;
    const roster = rosterByClass.get(entry.schoolClass.id) ?? 0;

    return {
      timetableEntryId: entry.id,
      timeSlotId: entry.timeSlot.id,
      startTime: entry.timeSlot.startTime,
      endTime: entry.timeSlot.endTime,
      schoolClassId: entry.schoolClass.id,
      classCode: entry.schoolClass.code,
      classGroupId: entry.classGroupId,
      groupLabel: groupLabel(entry.classGroup),
      subjectId: entry.subject.id,
      subjectName: entry.subject.name,
      subjectColorHex: entry.subject.colorHex,
      roomCode: entry.room?.code ?? null,
      isMarked: roster > 0 && marked >= roster,
    };
  });
}

export type RegisterPupil = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  status: string | null;
  minutesLate: number | null;
  reason: string | null;
  isJustified: boolean;
  /** Unjustified absences this pupil already has this year, across all subjects. */
  absencesThisYear: number;
  latesThisYear: number;
};

export type Register = {
  schoolClassId: string;
  classCode: string;
  classGroupId: string | null;
  groupLabel: string | null;
  subjectId: string | null;
  subjectName: string | null;
  timeSlotId: string | null;
  slotLabel: string | null;
  /** `YYYY-MM-DD`. */
  date: string;
  pupils: RegisterPupil[];
  tally: AttendanceTally;
};

/**
 * One lesson's register: the roster, whatever is already marked, and each
 * pupil's running count for the year.
 *
 * The running counts are the point of showing them here rather than on a report
 * somewhere: a teacher deciding whether this retard matters needs to know it is
 * the child's fourth, and they will not go looking.
 *
 * Returns null when the signed-in teacher does not teach this class — the
 * confinement described at the top of the file.
 */
export async function findRegister(
  context: AuthContext,
  input: {
    schoolClassId: string;
    subjectId: string | null;
    timeSlotId: string | null;
    date: Date;
  },
): Promise<Register | null> {
  const day = startOfDay(input.date);

  // The teacher's own assignment is the authority — never the id in the URL.
  const assignment = await db.teachingAssignment.findFirst({
    where: {
      teacherId: context.user.id,
      schoolClassId: input.schoolClassId,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      schoolClass: {
        schoolId: currentSchoolId(context),
        levelOffering: yearScope(context),
      },
    },
    select: {
      classGroupId: true,
      schoolClass: { select: { id: true, code: true } },
      classGroup: { select: { code: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  if (!assignment) return null;

  const [roster, slot] = await Promise.all([
    db.enrollment.findMany({
      where: {
        ...yearScope(context),
        schoolClassId: assignment.schoolClass.id,
        ...(assignment.classGroupId
          ? { classGroupId: assignment.classGroupId }
          : {}),
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
      select: {
        id: true,
        student: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        attendance: {
          select: {
            date: true,
            scopeKey: true,
            status: true,
            minutesLate: true,
            reason: true,
            isJustified: true,
          },
        },
      },
    }),
    input.timeSlotId
      ? db.timeSlot.findFirst({
          where: { id: input.timeSlotId, ...yearScope(context) },
          select: { id: true, startTime: true, endTime: true },
        })
      : null,
  ]);

  const scopeKey = input.timeSlotId ?? "__day__";

  const pupils: RegisterPupil[] = roster.map((enrollment) => {
    const forThisLesson = enrollment.attendance.find(
      (mark) =>
        mark.scopeKey === scopeKey && mark.date.getTime() === day.getTime(),
    );

    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.student.id,
      studentCode: enrollment.student.code,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      photoUrl: enrollment.student.photoUrl,
      status: forThisLesson?.status ?? null,
      minutesLate: forThisLesson?.minutesLate ?? null,
      reason: forThisLesson?.reason ?? null,
      isJustified: forThisLesson?.isJustified ?? false,
      // Across every subject, not just this one: the family is written to about
      // the total, so that is the figure a teacher should see.
      absencesThisYear: enrollment.attendance.filter(
        (mark) => mark.status === "ABSENT" && !mark.isJustified,
      ).length,
      latesThisYear: enrollment.attendance.filter(
        (mark) => mark.status === "LATE",
      ).length,
    };
  });

  return {
    schoolClassId: assignment.schoolClass.id,
    classCode: assignment.schoolClass.code,
    classGroupId: assignment.classGroupId,
    groupLabel: groupLabel(assignment.classGroup),
    subjectId: assignment.subject.id,
    subjectName: assignment.subject.name,
    timeSlotId: slot?.id ?? null,
    slotLabel: slot ? `${slot.startTime} — ${slot.endTime}` : null,
    date: toDateInputValue(day),
    pupils,
    tally: tallyAttendance(pupils),
  };
}

export type RemarkRow = {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classCode: string;
  subjectName: string | null;
  kind: string;
  tone: string;
  body: string;
  occurredOn: string;
  isVisibleToFamily: boolean;
  authorName: string | null;
  isMine: boolean;
};

/**
 * Remarks the signed-in teacher may read.
 *
 * Confined to their own classes, and — unless they hold the school-wide view —
 * to the ones they wrote. A remark is a colleague's private note until the
 * school decides otherwise, so seeing everybody's is a grant, not a default.
 */
export async function listRemarks(
  context: AuthContext,
  options: { mineOnly?: boolean; studentId?: string } = {},
): Promise<RemarkRow[]> {
  const myClassIds = await db.teachingAssignment.findMany({
    where: {
      teacherId: context.user.id,
      schoolClass: { levelOffering: yearScope(context) },
    },
    select: { schoolClassId: true },
  });

  const remarks = await db.studentRemark.findMany({
    where: {
      enrollment: {
        ...yearScope(context),
        student: schoolScope(context),
        schoolClassId: { in: myClassIds.map((row) => row.schoolClassId) },
        ...(options.studentId ? { studentId: options.studentId } : {}),
      },
      ...(options.mineOnly ? { authorId: context.user.id } : {}),
    },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      kind: true,
      tone: true,
      body: true,
      occurredOn: true,
      isVisibleToFamily: true,
      authorId: true,
      author: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      subject: { select: { name: true } },
      enrollment: {
        select: {
          id: true,
          schoolClass: { select: { code: true } },
          student: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  return remarks.map((remark) => ({
    id: remark.id,
    enrollmentId: remark.enrollment.id,
    studentId: remark.enrollment.student.id,
    studentName: `${remark.enrollment.student.firstName} ${remark.enrollment.student.lastName}`,
    studentCode: remark.enrollment.student.code,
    classCode: remark.enrollment.schoolClass?.code ?? "—",
    subjectName: remark.subject?.name ?? null,
    kind: remark.kind,
    tone: remark.tone,
    body: remark.body,
    occurredOn: toDateInputValue(remark.occurredOn),
    isVisibleToFamily: remark.isVisibleToFamily,
    authorName: remark.author ? displayName(remark.author) : null,
    isMine: remark.authorId === context.user.id,
  }));
}

export type PupilOption = {
  enrollmentId: string;
  label: string;
  classCode: string;
};

/** Every pupil the signed-in teacher teaches, for the remark picker. */
export async function listMyPupils(
  context: AuthContext,
): Promise<PupilOption[]> {
  const myClassIds = await db.teachingAssignment.findMany({
    where: {
      teacherId: context.user.id,
      schoolClass: { levelOffering: yearScope(context) },
    },
    select: { schoolClassId: true },
  });

  const enrollments = await db.enrollment.findMany({
    where: {
      ...yearScope(context),
      student: schoolScope(context),
      schoolClassId: {
        in: [...new Set(myClassIds.map((row) => row.schoolClassId))],
      },
    },
    orderBy: [
      { schoolClass: { code: "asc" } },
      { student: { lastName: "asc" } },
    ],
    select: {
      id: true,
      schoolClass: { select: { code: true } },
      student: { select: { firstName: true, lastName: true, code: true } },
    },
  });

  return enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    label: `${enrollment.student.lastName} ${enrollment.student.firstName} · ${enrollment.student.code}`,
    classCode: enrollment.schoolClass?.code ?? "—",
  }));
}

export type TeacherSummary = {
  classCount: number;
  pupilCount: number;
  lessonsToday: number;
  registersLeftToday: number;
  /** Papers of theirs that are published and not fully marked. */
  papersToMark: number;
  remarksThisMonth: number;
};

/** The figures on the workspace home. */
export async function teacherSummary(
  context: AuthContext,
  date: Date,
): Promise<TeacherSummary> {
  const [teaching, lessons, papers, remarks] = await Promise.all([
    listMyTeaching(context),
    listMyLessons(context, date),
    db.assessment.findMany({
      where: {
        teacherId: context.user.id,
        status: "PUBLISHED",
        term: yearScope(context),
      },
      select: {
        schoolClassId: true,
        grades: { select: { score: true, isAbsent: true } },
      },
    }),
    db.studentRemark.count({
      where: {
        authorId: context.user.id,
        occurredOn: {
          gte: new Date(date.getFullYear(), date.getMonth(), 1),
        },
      },
    }),
  ]);

  const rosterByClass = new Map(
    teaching.map((slot) => [slot.schoolClassId, slot.rosterCount]),
  );

  const papersToMark = papers.filter((paper) => {
    const accounted = paper.grades.filter(
      (grade) => grade.score !== null || grade.isAbsent,
    ).length;
    return accounted < (rosterByClass.get(paper.schoolClassId) ?? 0);
  }).length;

  return {
    classCount: new Set(teaching.map((slot) => slot.schoolClassId)).size,
    pupilCount: [...rosterByClass.values()].reduce(
      (total, count) => total + count,
      0,
    ),
    lessonsToday: lessons.length,
    registersLeftToday: lessons.filter((lesson) => !lesson.isMarked).length,
    papersToMark,
    remarksThisMonth: remarks,
  };
}

// ── One pupil's file ─────────────────────────────────────────────────────────
/*
  The reads above are the espace enseignant's, confined to the signed-in
  teacher's own assignments. The two below are the office's view of the same
  data, reached from a pupil's file and scoped by permission instead — see the
  note at the top of this file about that split.
*/

export type PupilAttendanceRow = {
  id: string;
  date: string;
  status: string;
  minutesLate: number | null;
  isJustified: boolean;
  reason: string | null;
  /** Null for a whole-day register rather than one lesson. */
  subjectName: string | null;
  recordedByName: string | null;
};

export type PupilAttendance = {
  rows: PupilAttendanceRow[];
  tally: AttendanceTally;
  /** Absences and lateness nobody has justified — what a school chases. */
  unjustifiedAbsences: number;
  unjustifiedLates: number;
  /** Present or late, over everything marked. Null when nothing is marked. */
  attendanceRate: number | null;
};

/**
 * A pupil's whole year of registers, newest first.
 *
 * Keyed on the enrolment, not the pupil: a child who repeats has two years of
 * marks and the file shows the year in context, exactly as the fee grid does.
 *
 * The rate deliberately excludes days nobody marked. A register that was never
 * taken is not an absence, and counting it as one would make a class whose
 * teacher forgets look like a class that truants.
 */
export async function loadPupilAttendance(
  context: AuthContext,
  enrollmentId: string,
): Promise<PupilAttendance> {
  const marks = await db.studentAttendance.findMany({
    where: {
      enrollmentId,
      // Re-derived from the working context rather than trusted: the
      // enrolment id comes from the URL.
      enrollment: { schoolYear: schoolScope(context) },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      subject: { select: { name: true } },
      recordedBy: { select: { email: true, profile: true } },
    },
  });

  const rows = marks.map((mark) => ({
    id: mark.id,
    date: mark.date.toISOString(),
    status: mark.status,
    minutesLate: mark.minutesLate,
    isJustified: mark.isJustified,
    reason: mark.reason,
    subjectName: mark.subject?.name ?? null,
    recordedByName: mark.recordedBy ? displayName(mark.recordedBy) : null,
  }));

  const tally = tallyAttendance(marks);
  const attended = tally.present + tally.late;
  const marked = attended + tally.absent + tally.excused;

  return {
    rows,
    tally,
    unjustifiedAbsences: marks.filter(
      (mark) => mark.status === "ABSENT" && !mark.isJustified,
    ).length,
    unjustifiedLates: marks.filter(
      (mark) => mark.status === "LATE" && !mark.isJustified,
    ).length,
    attendanceRate: marked === 0 ? null : Math.round((attended / marked) * 100),
  };
}

export type PupilRemarkRow = {
  id: string;
  kind: string;
  tone: string;
  body: string;
  occurredOn: string;
  subjectName: string | null;
  authorName: string | null;
  isVisibleToFamily: boolean;
};

/**
 * What this pupil's teachers have written about them, newest first.
 *
 * Unlike `listRemarks`, this is not filtered to one author: on the pupil's own
 * file the reader is the office, and the point of the carnet is that it is the
 * whole picture. The permission to open this screen at all is the gate.
 */
export async function loadPupilRemarks(
  context: AuthContext,
  enrollmentId: string,
): Promise<PupilRemarkRow[]> {
  const remarks = await db.studentRemark.findMany({
    where: { enrollmentId, enrollment: { schoolYear: schoolScope(context) } },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    include: {
      subject: { select: { name: true } },
      author: { select: { email: true, profile: true } },
    },
  });

  return remarks.map((remark) => ({
    id: remark.id,
    kind: remark.kind,
    tone: remark.tone,
    body: remark.body,
    occurredOn: remark.occurredOn.toISOString(),
    subjectName: remark.subject?.name ?? null,
    authorName: remark.author ? displayName(remark.author) : null,
    isVisibleToFamily: remark.isVisibleToFamily,
  }));
}

// ── What the teachers have recorded, seen from the office ────────────────────

export type ClassroomActivityMark = {
  id: string;
  status: string;
  minutesLate: number | null;
  isJustified: boolean;
  /** The teacher's own note — the reason typed on the register. */
  reason: string | null;
  studentId: string;
  studentName: string;
  classCode: string;
  /** Null for a whole-day register rather than one lesson. */
  subjectName: string | null;
  /** `HH:MM`, null for a whole-day register. */
  startTime: string | null;
  recordedByName: string | null;
};

export type ClassroomActivityRemark = {
  id: string;
  studentId: string;
  studentName: string;
  classCode: string;
  kind: string;
  tone: string;
  body: string;
  occurredOn: string;
  isVisibleToFamily: boolean;
  authorName: string | null;
};

export type ClassroomActivity = {
  /** Absences and lateness marked on the chosen day, newest first. Capped. */
  marks: ClassroomActivityMark[];
  /**
   * Marks beyond the ones in `marks` — 0 when the list is the whole day.
   *
   * Carried so a screen can say "and 40 more" instead of implying the capped
   * list is everything.
   */
  moreMarks: number;
  /**
   * Of the day's absences and lates, the ones with no justification on file —
   * what a school chases.
   *
   * Counted in the database, not by filtering `marks`: that list is capped, so
   * on a day past the cap the badge would silently stop rising exactly when it
   * mattered most.
   */
  unjustifiedToday: number;
  /** How many registers were taken that day at all. */
  registersTaken: number;
  remarks: ClassroomActivityRemark[];
};

const MARK_LIMIT = 100;

const EMPTY_ACTIVITY: ClassroomActivity = {
  marks: [],
  moreMarks: 0,
  unjustifiedToday: 0,
  registersTaken: 0,
  remarks: [],
};

/**
 * The day's registers and the latest remarks, across the whole school.
 *
 * ── Why this is not `listRemarks` with a wider scope ─────────────────────────
 * Everything else in this file answers "what may *this teacher* reach", and is
 * confined to their own assignments. This one answers the opposite question —
 * "what have the teachers recorded" — and is confined by *permission* instead,
 * which is the rule stated at the top of the file. A director holds no teaching
 * assignments, so the teacher-scoped reads would return them nothing at all.
 *
 * The two halves are gated separately because they are separately grantable: an
 * office that may chase absences is not automatically one that may read a
 * colleague's carnet. Each comes back empty rather than throwing, so the caller
 * composes one object and the screen simply shows less.
 */
export async function loadClassroomActivity(
  context: AuthContext,
  date: Date,
  options: { remarkLimit?: number } = {},
): Promise<ClassroomActivity> {
  const canSeeAttendance = context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW);
  const canSeeRemarks = context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW);
  if (!canSeeAttendance && !canSeeRemarks) return EMPTY_ACTIVITY;

  const day = startOfDay(date);

  // The day's absences and lates, as a `where` the list and both counts share —
  // three spellings of it is how the badge and the list come to disagree.
  const missingToday = {
    date: day,
    // Absences and lateness only: a dashboard listing every pupil who turned up
    // is a list nobody reads.
    status: { in: [...MISSING_STATUSES, "LATE"] },
    enrollment: { ...yearScope(context), student: schoolScope(context) },
  };

  const [marks, missingCount, unjustifiedToday, registersTaken, remarks] =
    await Promise.all([
      canSeeAttendance
        ? db.studentAttendance.findMany({
            where: missingToday,
            orderBy: [{ createdAt: "desc" }],
            take: MARK_LIMIT,
            select: {
              id: true,
              status: true,
              minutesLate: true,
              isJustified: true,
              reason: true,
              subject: { select: { name: true } },
              timeSlot: { select: { startTime: true } },
              recordedBy: {
                select: {
                  email: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
              enrollment: {
                select: {
                  schoolClass: { select: { code: true } },
                  student: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          })
        : [],
      canSeeAttendance
        ? db.studentAttendance.count({ where: missingToday })
        : 0,
      canSeeAttendance
        ? db.studentAttendance.count({
            where: { ...missingToday, isJustified: false },
          })
        : 0,
      canSeeAttendance
        ? db.studentAttendance.count({
            where: {
              date: day,
              enrollment: {
                ...yearScope(context),
                student: schoolScope(context),
              },
            },
          })
        : 0,
      canSeeRemarks
        ? db.studentRemark.findMany({
            where: {
              enrollment: {
                ...yearScope(context),
                student: schoolScope(context),
              },
            },
            orderBy: [{ createdAt: "desc" }],
            take: options.remarkLimit ?? 8,
            select: {
              id: true,
              kind: true,
              tone: true,
              body: true,
              occurredOn: true,
              isVisibleToFamily: true,
              author: {
                select: {
                  email: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
              enrollment: {
                select: {
                  schoolClass: { select: { code: true } },
                  student: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          })
        : [],
    ]);

  return {
    marks: marks.map((mark) => ({
      id: mark.id,
      status: mark.status,
      minutesLate: mark.minutesLate,
      isJustified: mark.isJustified,
      reason: mark.reason,
      studentId: mark.enrollment.student.id,
      studentName: `${mark.enrollment.student.firstName} ${mark.enrollment.student.lastName}`,
      classCode: mark.enrollment.schoolClass?.code ?? "—",
      subjectName: mark.subject?.name ?? null,
      startTime: mark.timeSlot?.startTime ?? null,
      recordedByName: mark.recordedBy ? displayName(mark.recordedBy) : null,
    })),
    moreMarks: Math.max(0, missingCount - marks.length),
    unjustifiedToday,
    registersTaken,
    remarks: remarks.map((remark) => ({
      id: remark.id,
      studentId: remark.enrollment.student.id,
      studentName: `${remark.enrollment.student.firstName} ${remark.enrollment.student.lastName}`,
      classCode: remark.enrollment.schoolClass?.code ?? "—",
      kind: remark.kind,
      tone: remark.tone,
      body: remark.body,
      occurredOn: toDateInputValue(remark.occurredOn),
      isVisibleToFamily: remark.isVisibleToFamily,
      authorName: remark.author ? displayName(remark.author) : null,
    })),
  };
}
