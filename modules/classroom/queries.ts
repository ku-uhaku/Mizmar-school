import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import {
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

function yearScope(context: AuthContext) {
  return { schoolYearId: context.currentSchoolYear?.id ?? "__none__" };
}

function schoolScope(context: AuthContext) {
  return { schoolId: context.currentSchool?.id ?? "__none__" };
}

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
        schoolId: context.currentSchool?.id ?? "__none__",
        levelOffering: yearScope(context),
      },
    },
    orderBy: [
      { schoolClass: { code: "asc" } },
      { subject: { code: "asc" } },
    ],
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
      schoolClass: { schoolId: context.currentSchool?.id ?? "__none__" },
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
        schoolId: context.currentSchool?.id ?? "__none__",
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
