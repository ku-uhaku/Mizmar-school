import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  currentSchoolId,
  currentSchoolYearId,
  schoolScope,
  yearScope,
} from "@/lib/scope";
import { cycleChoiceLabel, levelNameLabel } from "@/modules/academics/labels";
import {
  attendanceScopeKey,
  MISSING_STATUSES,
  wasMissing,
  REMARK_PAGE_SIZE,
  sessionScopeKey,
  startOfDay,
  tallyAttendance,
  type AttendanceTally,
} from "@/modules/classroom/enums";
import { runsInWeek, runsInWeekNumber } from "@/modules/timetable/enums";
import {
  activeVersionScope,
  findSchoolDay,
  loadWeekOverlay,
} from "@/modules/timetable/queries";
import { startOfWeek, toDateKey } from "@/modules/timetable/weeks";

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

/**
 * The bell schedule a register is read against.
 *
 * The timetable keeps a separate grid per `scheduleKind` — the ordinary one and
 * the Ramadan one — and nothing in the app resolves which is in force on a
 * given date: the kind is an explicit choice on the timetable screen. Two
 * schedules hold slots at overlapping clock times, so a register that did not
 * pick one would offer the same period twice. It reads the ordinary schedule,
 * exactly as the parent portal and the teacher's own timetable already do; a
 * Ramadan register needs that resolver first, and it does not exist yet.
 */
const REGISTER_SCHEDULE_KIND = "STANDARD";

export type TeachingSlot = {
  assignmentId: string;
  schoolClassId: string;
  classCode: string;
  className: string | null;
  levelLabel: string;
  /** The niveau, for resolving a kind's barème — see `gradingDefaults`. */
  levelId: string;
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
          levelOffering: {
            select: { level: { select: { id: true, code: true } } },
          },
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
    levelId: assignment.schoolClass.levelOffering.level.id,
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

  // Only the grid in force. An entry belongs to the TimetableVersion that
  // generated it, and an untouched class's rows are copied forward into every
  // new version — so a read that does not say which version it means offers the
  // same lesson once per generation the school has ever run.
  const versionScope = await activeVersionScope(
    currentSchoolYearId(context),
    REGISTER_SCHEDULE_KIND,
  );

  const entries = await db.timetableEntry.findMany({
    where: {
      teacherId: context.user.id,
      ...versionScope,
      timeSlot: {
        ...yearScope(context),
        scheduleKind: REGISTER_SCHEDULE_KIND,
        dayOfWeek,
        isBreak: false,
      },
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

  /*
    Whether the appel is done is the séance's own answer, not a count of rows.

    It used to be "every pupil has a mark", which stopped being answerable the
    moment presence became the absence of a row: a finished register of a class
    where nobody was away writes nothing at all. The séance closing is the
    teacher saying they are finished, which is the question this flag asks.
  */
  const sessions = await db.classSession.findMany({
    where: {
      date: day,
      closedAt: { not: null },
      schoolClassId: { in: entries.map((entry) => entry.schoolClass.id) },
    },
    select: { scopeKey: true, schoolClassId: true },
  });
  const closed = new Set(
    sessions.map((session) => `${session.schoolClassId}:${session.scopeKey}`),
  );

  return entries.map((entry) => {
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
      isMarked: closed.has(
        `${entry.schoolClass.id}:${sessionScopeKey(
          entry.timeSlot.id,
          entry.classGroupId,
        )}`,
      ),
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
  /** The séance this register belongs to, once one has been saved. */
  sessionId: string | null;
  /** The cahier de textes for it — what was covered, and the work set. */
  theme: string | null;
  homework: string | null;
  /** A séance nobody assured: there is no register to take. */
  isCancelled: boolean;
  /** True once the séance is closed and its marks are final. */
  isClosed: boolean;
  pupils: RegisterPupil[];
  tally: AttendanceTally;
};

/**
 * The roster of one lesson with everything already marked against it.
 *
 * Split out because two screens ask for the same thing by two different routes:
 * a teacher reaching their own class (`findRegister`) and the office reaching
 * any class in the school (`findClassRegister`). Only *who may ask* differs, and
 * keeping the answer in one function is what stops the appel a director takes
 * from showing a different list to the one the teacher would have seen.
 *
 * The caller has already decided the roster is reachable; nothing here checks.
 */
async function rosterRegister(
  context: AuthContext,
  input: {
    schoolClassId: string;
    /** Null for the whole class — see `saveSession` on standing in. */
    classGroupId: string | null;
    timeSlotId: string | null;
    day: Date;
  },
): Promise<{
  pupils: RegisterPupil[];
  /** The slot as it resolved against this year — null when it did not. */
  timeSlotId: string | null;
  slotLabel: string | null;
}> {
  const [roster, slot] = await Promise.all([
    db.enrollment.findMany({
      where: {
        ...yearScope(context),
        schoolClassId: input.schoolClassId,
        ...(input.classGroupId ? { classGroupId: input.classGroupId } : {}),
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

  const scopeKey = attendanceScopeKey(input.timeSlotId);

  const pupils: RegisterPupil[] = roster.map((enrollment) => {
    const forThisLesson = enrollment.attendance.find(
      (mark) =>
        mark.scopeKey === scopeKey &&
        mark.date.getTime() === input.day.getTime(),
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
    pupils,
    timeSlotId: slot?.id ?? null,
    slotLabel: slot ? `${slot.startTime} — ${slot.endTime}` : null,
  };
}

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

  const [{ pupils, timeSlotId, slotLabel }, session] = await Promise.all([
    rosterRegister(context, {
      schoolClassId: assignment.schoolClass.id,
      classGroupId: assignment.classGroupId,
      timeSlotId: input.timeSlotId,
      day,
    }),
    // The séance this register belongs to, if one has been started. Looked up
    // on the same key the write uses, so the teacher's view and the office's
    // agree about whether the appel is finished.
    db.classSession.findUnique({
      where: {
        schoolClassId_date_scopeKey: {
          schoolClassId: assignment.schoolClass.id,
          date: day,
          scopeKey: sessionScopeKey(
            input.timeSlotId,
            assignment.classGroupId,
          ),
        },
      },
      select: {
        id: true,
        theme: true,
        homework: true,
        status: true,
        closedAt: true,
      },
    }),
  ]);

  return {
    schoolClassId: assignment.schoolClass.id,
    classCode: assignment.schoolClass.code,
    classGroupId: assignment.classGroupId,
    groupLabel: groupLabel(assignment.classGroup),
    subjectId: assignment.subject.id,
    subjectName: assignment.subject.name,
    timeSlotId,
    slotLabel,
    date: toDateInputValue(day),
    sessionId: session?.id ?? null,
    theme: session?.theme ?? null,
    homework: session?.homework ?? null,
    isCancelled: session?.status === "CANCELLED",
    isClosed: session?.closedAt != null,
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
 * Remarks the signed-in user may read.
 *
 * Confined to their own classes, and — unless they hold the school-wide view —
 * to the ones they wrote. A remark is a colleague's private note until the
 * school decides otherwise, so seeing everybody's is a grant, not a default.
 *
 * ── Except for whoever has to decide on them ────────────────────────────────
 * `classroom.remarkPublish` is the code that releases a teacher's observation
 * to a family, and this read is the only place those observations are listed.
 * Scoped to the reader's own teaching assignments, a directrice who teaches
 * nothing resolved to an empty class list and therefore an empty screen — so
 * the one screen in the app that can publish a remark showed the one group of
 * people allowed to publish them nothing at all. On the seeded school that was
 * 216 remarks awaiting release and a page that said there were none.
 *
 * So the office sees the school. It is the same `actsForSchool` rule the writes
 * in this module already follow — see the note at the top of service.ts — and
 * it relaxes *which classes*, never which school: `schoolScope` still applies,
 * so another tenant's remarks remain unreachable.
 */
export type RemarkFilters = {
  mineOnly?: boolean;
  studentId?: string;
  /** Who wrote it. */
  authorId?: string;
  schoolClassId?: string;
  tone?: string;
  kind?: string;
  /** Only the ones still waiting on the office's decision. */
  pendingOnly?: boolean;
  /** Matches the pupil's name or code, or the words of the remark itself. */
  search?: string;
};

export async function listRemarks(
  context: AuthContext,
  options: RemarkFilters = {},
): Promise<RemarkRow[]> {
  const actsForSchool = context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH);

  // Skipped entirely for the office: their scope is the school, so the answer
  // would be read and then thrown away.
  const myClassIds = actsForSchool
    ? []
    : await db.teachingAssignment.findMany({
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
        ...(actsForSchool
          ? {}
          : {
              schoolClassId: { in: myClassIds.map((row) => row.schoolClassId) },
            }),
        ...(options.studentId ? { studentId: options.studentId } : {}),
        // Narrowing *within* the scope above, never widening it: a class id
        // from a query string is intersected with what the reader may already
        // reach, so a crafted one matches nothing rather than reaching another
        // school's class.
        ...(options.schoolClassId
          ? { schoolClassId: options.schoolClassId }
          : {}),
        ...(options.search
          ? {
              student: {
                ...schoolScope(context),
                OR: [
                  { firstName: { contains: options.search } },
                  { lastName: { contains: options.search } },
                  { code: { contains: options.search } },
                ],
              },
            }
          : {}),
      },
      ...(options.mineOnly ? { authorId: context.user.id } : {}),
      ...(options.authorId ? { authorId: options.authorId } : {}),
      ...(options.tone ? { tone: options.tone } : {}),
      ...(options.kind ? { kind: options.kind } : {}),
      ...(options.pendingOnly ? { isVisibleToFamily: false } : {}),
    },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: REMARK_PAGE_SIZE,
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
          username: true,
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

export type RemarkFilterChoices = {
  teachers: { id: string; label: string }[];
  /**
   * The school's classes, headed by their cycle.
   *
   * `group` is the heading the picker clusters on, and the rows arrive already
   * sorted by it — `clusterByGroup` walks the list rather than bucketing it, so
   * a heading only holds while its classes stay contiguous.
   */
  classes: { id: string; label: string; group: string }[];
  /** How many are still waiting on a decision, before any filter is applied. */
  pendingCount: number;
};

/**
 * What the review screen's pickers may offer, and how much is waiting.
 *
 * ── Read straight, not derived from the list ────────────────────────────────
 * The obvious implementation builds these out of `listRemarks` and counts what
 * comes back. It would be wrong twice over: that list is capped at 200 rows, so
 * both the pickers and the "awaiting" badge would silently describe the newest
 * page rather than the school — a director working through a backlog would
 * watch the count stop falling. And it would key the pickers on *names*, which
 * the filters cannot use: they take ids.
 *
 * ── Only the teachers who have actually written something ───────────────────
 * A `distinct` over the remarks rather than a roll of the staff. A picker of
 * every employee would be mostly names that select nothing, and the question
 * this screen asks is "whose observations am I looking at" — which only has
 * answers among the people who wrote one.
 *
 * For the office, whose scope is the school. See `listRemarks` on why that is
 * the right scope for anyone holding the publish code.
 */
export async function listRemarkFilterChoices(
  context: AuthContext,
): Promise<RemarkFilterChoices> {
  const inScope = {
    enrollment: { ...yearScope(context), student: schoolScope(context) },
  } as const;

  const [authored, classes, pendingCount] = await Promise.all([
    db.studentRemark.findMany({
      where: { ...inScope, authorId: { not: null } },
      distinct: ["authorId"],
      select: {
        authorId: true,
        author: {
          select: {
            username: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.schoolClass.findMany({
      where: { levelOffering: yearScope(context), ...schoolScope(context) },
      // Cycle, then year, then the code — the same order the papers' pickers
      // use, and the order the cycle headings depend on: a heading holds only
      // while the classes under it are contiguous.
      orderBy: [
        { levelOffering: { level: { educationLevel: { position: "asc" } } } },
        { levelOffering: { level: { gradeYear: "asc" } } },
        { code: "asc" },
      ],
      select: {
        id: true,
        code: true,
        levelOffering: {
          select: {
            level: {
              select: {
                code: true,
                name: true,
                nameAr: true,
                educationLevel: { select: { name: true, nameAr: true } },
              },
            },
            track: { select: { name: true, nameAr: true } },
          },
        },
      },
    }),
    db.studentRemark.count({ where: { ...inScope, isVisibleToFamily: false } }),
  ]);

  return {
    teachers: authored
      .filter((row) => row.authorId !== null && row.author !== null)
      .map((row) => ({
        id: row.authorId as string,
        label: displayName(row.author!),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    /*
      The niveau beside the code, not the code alone.

      A school runs forty classes and their codes are near-identical strings —
      1AP-A, 1AS-A, 1BAC-A — so a flat list of them is picked from by squinting.
      The same label and the same cycle headings the papers' review already
      uses, so the two vie scolaire screens read as one.
    */
    classes: classes.map((row) => ({
      id: row.id,
      label: `${row.code} · ${levelNameLabel(row.levelOffering.level, row.levelOffering.track)}`,
      group: cycleChoiceLabel(row.levelOffering.level.educationLevel),
    })),
    pendingCount,
  };
}

export type PupilOption = {
  enrollmentId: string;
  label: string;
  classCode: string;
};

/** A pupil the office may write about, and the class they sit in. */
export type ClassPupilOption = PupilOption & { schoolClassId: string };

/**
 * Every seated pupil of the school this year, for the office's remark picker.
 *
 * ── Why the whole school in one read ────────────────────────────────────────
 * The picker is a class and then a pupil in it, and a school is a few hundred
 * enrolments — small enough to send once with the page and filter in the
 * browser. The alternative, fetching the pupils when a class is chosen, buys
 * nothing here and puts a round trip in the middle of a form somebody is
 * filling in.
 *
 * Pupils with no class are left out rather than listed under a blank heading:
 * `writeRemark` resolves the enrolment through its `schoolClass`, so a remark
 * against an unseated one would be refused after the fact.
 *
 * Scoped like every other read in this file — the year and the school come from
 * the context, never from the request.
 */
export async function listSchoolPupils(
  context: AuthContext,
): Promise<ClassPupilOption[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      ...yearScope(context),
      student: schoolScope(context),
      schoolClassId: { not: null },
    },
    orderBy: [
      { schoolClass: { code: "asc" } },
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      schoolClassId: true,
      schoolClass: { select: { code: true } },
      student: { select: { firstName: true, lastName: true, code: true } },
    },
  });

  return enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    schoolClassId: enrollment.schoolClassId as string,
    label: `${enrollment.student.lastName} ${enrollment.student.firstName} · ${enrollment.student.code}`,
    classCode: enrollment.schoolClass?.code ?? "—",
  }));
}

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
 * Séances a pupil was expected at, over a class's closed registers.
 *
 * ── Why this is not a count of marks ────────────────────────────────────────
 * Presence is the absence of a row, so the register itself can no longer say
 * how many lessons a child sat: an empty file means a perfect year, and it also
 * means a year nobody recorded. The séance is what distinguishes them. Only
 * closed ones count — a register still being taken is not yet a lesson anybody
 * was marked absent from.
 *
 * A séance belonging to one half of a split class is counted only for the
 * pupils in that half; a whole-class one, for everybody.
 */
async function sessionsExpected(
  schoolClassId: string,
  classGroupId: string | null,
  window: { from?: Date; to?: Date } = {},
): Promise<number> {
  return db.classSession.count({
    where: {
      schoolClassId,
      closedAt: { not: null },
      status: "HELD",
      OR: [{ classGroupId: null }, { classGroupId }],
      ...(window.from || window.to
        ? {
            date: {
              ...(window.from ? { gte: startOfDay(window.from) } : {}),
              ...(window.to ? { lte: startOfDay(window.to) } : {}),
            },
          }
        : {}),
    },
  });
}

/**
 * A pupil's whole year of registers, newest first.
 *
 * Keyed on the enrolment, not the pupil: a child who repeats has two years of
 * marks and the file shows the year in context, exactly as the fee grid does.
 *
 * The rate counts the séances the class actually held — see `sessionsExpected`
 * — and not the days somebody happened to mark. A register nobody took is not
 * an absence, and counting it as one would make a class whose teacher forgets
 * look like a class that truants.
 */
export async function loadPupilAttendance(
  context: AuthContext,
  enrollmentId: string,
): Promise<PupilAttendance> {
  const [marks, enrolment] = await Promise.all([
    db.studentAttendance.findMany({
      where: {
        enrollmentId,
        // Re-derived from the working context rather than trusted: the
        // enrolment id comes from the URL.
        enrollment: { schoolYear: schoolScope(context) },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        subject: { select: { name: true } },
        recordedBy: { select: { username: true, profile: true } },
      },
    }),
    db.enrollment.findFirst({
      where: { id: enrollmentId, schoolYear: schoolScope(context) },
      select: { schoolClassId: true, classGroupId: true },
    }),
  ]);

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

  const expected = enrolment?.schoolClassId
    ? await sessionsExpected(enrolment.schoolClassId, enrolment.classGroupId)
    : 0;

  const missed = marks.filter((mark) =>
    wasMissing(mark.status),
  ).length;
  const late = marks.filter((mark) => mark.status === "LATE").length;

  return {
    rows,
    // Present is what is left of the séances held once the misses are taken
    // off. A retard is not one of them: the child turned up.
    tally: {
      present: Math.max(0, expected - missed - late),
      late,
      absent: marks.filter((mark) => mark.status === "ABSENT").length,
      excused: marks.filter((mark) => mark.status === "EXCUSED").length,
      unmarked: 0,
      total: expected,
    },
    unjustifiedAbsences: marks.filter(
      (mark) => mark.status === "ABSENT" && !mark.isJustified,
    ).length,
    unjustifiedLates: marks.filter(
      (mark) => mark.status === "LATE" && !mark.isJustified,
    ).length,
    attendanceRate:
      expected === 0
        ? null
        : Math.round(((expected - missed) / expected) * 100),
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
      author: { select: { username: true, profile: true } },
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
                  username: true,
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
        ? // Séances closed today, not rows written today: a register of a class
          // where everybody turned up writes nothing, and counting rows would
          // tell the direction that the mornings nobody missed never happened.
          db.classSession.count({
            where: {
              date: day,
              closedAt: { not: null },
              schoolClass: schoolScope(context),
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
                  username: true,
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

// ── A whole class, one term ──────────────────────────────────────────────────

export type TermAttendanceTally = {
  absenceCount: number;
  unjustifiedAbsenceCount: number;
  lateCount: number;
};

/**
 * The term's register for a whole class, tallied per pupil.
 *
 * The one read in this file that is *not* confined to the signed-in teacher's
 * own assignments — see the note at the top. It is scoped by school and by the
 * class asked for, because its caller is the vie scolaire computing bulletins
 * for a class rather than a teacher opening their own workspace, and the
 * permission for that is checked in the action. The confinement that still
 * holds is the one that matters: the enrolment must belong to a year of the
 * school in context, so a crafted class id reaches nothing.
 *
 * Counted in lessons rather than days, which is what the table records: a
 * morning missed by a secondary pupil is several rows. `EXCUSED` is not counted
 * as an absence at all — the school accepted the reason in advance, and putting
 * it on a bulletin beside the unexcused ones would misrepresent both.
 *
 * Keyed by enrolment id. Pupils with a clean term are simply absent from the
 * map; the caller reads a missing entry as zero, which is what it means.
 */
export async function loadClassTermAttendance(
  context: AuthContext,
  schoolClassId: string,
  from: Date,
  to: Date,
): Promise<Map<string, TermAttendanceTally>> {
  const marks = await db.studentAttendance.findMany({
    where: {
      date: { gte: startOfDay(from), lte: startOfDay(to) },
      status: { in: ["ABSENT", "LATE"] },
      enrollment: {
        schoolClassId,
        // Re-derived from the working context rather than trusted.
        schoolYear: schoolScope(context),
      },
    },
    select: { enrollmentId: true, status: true, isJustified: true },
  });

  const tallies = new Map<string, TermAttendanceTally>();

  for (const mark of marks) {
    let tally = tallies.get(mark.enrollmentId);
    if (!tally) {
      tally = {
        absenceCount: 0,
        unjustifiedAbsenceCount: 0,
        lateCount: 0,
      };
      tallies.set(mark.enrollmentId, tally);
    }

    if (mark.status === "LATE") {
      tally.lateCount += 1;
      continue;
    }

    tally.absenceCount += 1;
    if (!mark.isJustified) tally.unjustifiedAbsenceCount += 1;
  }

  return tallies;
}

// ── A whole class's register, for the class's own dashboard ──────────────────

export type ClassAttendance = {
  /** Marks recorded across the whole roll this year, whatever their status. */
  marked: number;
  tally: { present: number; late: number; absent: number; excused: number };
  /** Present or late over everything marked, 0–100. Null when nothing is marked. */
  attendanceRate: number | null;
  /** What the office chases: absences with no justification on file. */
  unjustifiedAbsences: number;
  /**
   * The same rate month by month, `YYYY-MM` ascending, with the marks it rests
   * on. The count is carried rather than dropped so the caller can refuse to
   * plot a month nobody really marked — see the note in `ClassOverview`.
   */
  byMonth: { month: string; here: number; marked: number }[];
};

/**
 * The class's year of registers, tallied.
 *
 * Like `loadClassTermAttendance` above, this is the office's read rather than a
 * teacher's: it is scoped by the class asked for and by the school in context,
 * and the permission for it (`CLASSROOM_ATTENDANCE_VIEW`) is checked by the
 * caller. The confinement that still holds is the one that matters — the
 * enrolment must belong to a year of the school in context, so a crafted class
 * id reaches nothing.
 *
 * ── Why it groups in the database ───────────────────────────────────────────
 * A secondary class is marked once per lesson per pupil, so even a register of
 * absences alone runs to thousands of rows over a year. Grouping by day and
 * status leaves at most a few hundred — small enough to fold in memory, and
 * still fine-grained enough to roll into months.
 *
 * ── Where the denominator comes from ────────────────────────────────────────
 * The séances the class actually closed, multiplied by the roster: presence is
 * the absence of a row, so the marks can only ever say what went wrong. A month
 * with no séances is left out of the trend entirely rather than plotted as nil,
 * for the same reason as before — a register nobody took is not a class that
 * truanted.
 */
export async function loadClassAttendance(
  context: AuthContext,
  schoolClassId: string,
): Promise<ClassAttendance> {
  const scope = {
    // Re-derived from the working context rather than trusted: the class id
    // comes from the URL.
    enrollment: { schoolClassId, schoolYear: schoolScope(context) },
  };

  const [byDay, unjustifiedAbsences, sessions, roster] = await Promise.all([
    db.studentAttendance.groupBy({
      by: ["date", "status"],
      where: scope,
      _count: { _all: true },
    }),
    db.studentAttendance.count({
      where: { ...scope, status: "ABSENT", isJustified: false },
    }),
    db.classSession.findMany({
      where: {
        schoolClass: { id: schoolClassId, ...schoolScope(context) },
        closedAt: { not: null },
        status: "HELD",
      },
      select: { date: true },
    }),
    db.enrollment.count({ where: { ...yearScope(context), schoolClassId } }),
  ]);

  /*
    Local getters rather than `toISOString`: `date` is written as local midnight
    (see `startOfDay`), so east of Greenwich the first of the month is stored as
    the last instant of the previous one in UTC and a slice of the ISO string
    would file September's registers under August.
  */
  const monthOf = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const tally = { present: 0, late: 0, absent: 0, excused: 0 };
  const missedByMonth = new Map<string, number>();

  for (const row of byDay) {
    const count = row._count._all;

    if (row.status === "LATE") tally.late += count;
    else if (row.status === "ABSENT") tally.absent += count;
    else if (row.status === "EXCUSED") tally.excused += count;

    if (wasMissing(row.status)) {
      const key = monthOf(row.date);
      missedByMonth.set(key, (missedByMonth.get(key) ?? 0) + count);
    }
  }

  const heldByMonth = new Map<string, number>();
  for (const session of sessions) {
    const key = monthOf(session.date);
    heldByMonth.set(key, (heldByMonth.get(key) ?? 0) + 1);
  }

  // One expected attendance per pupil per séance held.
  const expected = sessions.length * roster;
  const missed = tally.absent + tally.excused;
  tally.present = Math.max(0, expected - missed - tally.late);

  const months = new Map<string, { here: number; marked: number }>();
  for (const [key, held] of heldByMonth) {
    const marked = held * roster;
    months.set(key, {
      marked,
      here: Math.max(0, marked - (missedByMonth.get(key) ?? 0)),
    });
  }

  return {
    marked: expected,
    tally,
    attendanceRate:
      expected === 0
        ? null
        : Math.round(((expected - missed) / expected) * 100),
    unjustifiedAbsences,
    byMonth: [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts })),
  };
}

// ── The class's own day, for whoever is standing in ──────────────────────────
/*
  The two reads below answer "what is this class doing today, and has anybody
  taken the register" from the *class*, not from the signed-in teacher. They are
  the office's half of the pair described at the top of this file, and they are
  scoped the way the rest of the vie scolaire is: by the school in context and
  by permission, never by a teaching assignment.

  They exist because the appel is not only a teacher's job. A surveillant
  general covering an absent colleague, a directrice ringing round the families
  of the pupils missing this morning — both work from a class and a day, and
  neither has an assignment to be confined to. The write side already allows it
  (`actsForSchool` in service.ts); without these reads there was simply no way
  in from the web app.
*/

export type ClassLesson = {
  timetableEntryId: string;
  /**
   * The first period of the block, and the one the séance is keyed on.
   *
   * A double period is two rows on the grid and one lesson in the room — see
   * the merge in `listClassLessons` — so the séance, its theme and its appel
   * all hang off the period it started in.
   */
  timeSlotId: string;
  startTime: string;
  /** The end of the *last* period of the block. */
  endTime: string;
  /** How many periods the block runs for. 1 for an ordinary lesson. */
  periods: number;
  /** "MORNING" | "AFTERNOON" — see modules/timetable/enums.ts. */
  session: string;
  subjectId: string;
  subjectName: string;
  subjectColorHex: string | null;
  teacherName: string | null;
  roomCode: string | null;
  /** Set when only one half of a split class sits this period. */
  classGroupId: string | null;
  groupLabel: string | null;
  /** The séance recorded for this period, once somebody has saved one. */
  sessionId: string | null;
  /** The cahier de textes, as far as it has been written. */
  theme: string | null;
  homework: string | null;
  /** "HELD" | "CANCELLED" — null when no séance has been recorded yet. */
  sessionStatus: string | null;
  /**
   * True once the register has been saved and the marks made final.
   *
   * This is what "taken" means now. It used to be counted — every pupil having
   * a mark — which quietly reported every period of a school seeded with
   * whole-day registers as untaken, and could not tell a finished appel from
   * one abandoned halfway.
   */
  isClosed: boolean;
  /** What the register found, for the period list's own summary. */
  absent: number;
  late: number;
  /**
   * What a one-off change says about this period: CANCELLED means there is no
   * register to take, REPLACED that somebody else is taking it.
   */
  exceptionKind: string | null;
};

/** What one class is doing on one day, and how far its registers have got. */
export type ClassDay = {
  /** `YYYY-MM-DD`. */
  date: string;
  /** The holiday covering the day, when there is one — then there are no lessons. */
  holidayName: string | null;
  /** False when a holiday swallows the whole week — see SchoolWeek.isTeaching. */
  isTeaching: boolean;
  lessons: ClassLesson[];
};

/**
 * One class's lessons on one date, each saying whether its register is done.
 *
 * ── Why it is not `listMyLessons` with a class id ───────────────────────────
 * That read starts from `teacherId` and is confined to it on purpose. This one
 * starts from the class and is confined to the school, which is a different
 * authorization question with a different answer — so it is a different
 * function rather than a flag on that one.
 *
 * The day is narrowed the way the grid is: lessons whose week window does not
 * cover this date are left out, and so is the wrong half of a fortnightly
 * rotation. A register offered for a lesson that is not running is an absence
 * mark waiting to be recorded against a class that was never there.
 */
export async function listClassLessons(
  context: AuthContext,
  schoolClassId: string,
  date: Date,
): Promise<ClassDay> {
  const day = startOfDay(date);
  const calendarDay = await findSchoolDay(context, date);

  const empty: ClassDay = {
    date: toDateInputValue(day),
    holidayName: calendarDay.holidayName,
    isTeaching: calendarDay.isTeaching,
    lessons: [],
  };

  // A holiday has no lessons to mark, and a week the school has closed has
  // none either. Saying so beats drawing six periods nobody sat.
  if (calendarDay.holidayName || !calendarDay.isTeaching) return empty;

  // See the note on `listMyLessons`: without the version the same lesson comes
  // back once per grid the school has ever generated.
  const versionScope = await activeVersionScope(
    currentSchoolYearId(context),
    REGISTER_SCHEDULE_KIND,
  );

  const entries = await db.timetableEntry.findMany({
    where: {
      // Re-derived from the working context rather than trusted: the class id
      // comes from the URL.
      schoolClass: {
        id: schoolClassId,
        schoolId: currentSchoolId(context),
        levelOffering: yearScope(context),
      },
      ...versionScope,
      timeSlot: {
        ...yearScope(context),
        scheduleKind: REGISTER_SCHEDULE_KIND,
        dayOfWeek: calendarDay.dayOfWeek,
        isBreak: false,
      },
    },
    orderBy: [{ timeSlot: { position: "asc" } }],
    select: {
      id: true,
      weekParity: true,
      fromWeek: true,
      toWeek: true,
      classGroupId: true,
      teacherId: true,
      termId: true,
      timeSlot: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          session: true,
        },
      },
      subject: { select: { id: true, name: true, colorHex: true } },
      classGroup: { select: { code: true, name: true } },
      room: { select: { code: true } },
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  // Narrowed here rather than in the `where`, for the reason `loadClassTimetable`
  // gives: the window is two nullable columns and the rule is one pure function
  // shared with the clash check.
  const running = entries.filter(
    (entry) =>
      runsInWeekNumber(
        { fromWeek: entry.fromWeek, toWeek: entry.toWeek },
        calendarDay.weekNumber,
      ) &&
      runsInWeek(
        entry.weekParity,
        calendarDay.parity ? { parity: calendarDay.parity } : null,
      ),
  );

  if (running.length === 0) return empty;

  /*
    One row per period and group, whatever the table holds.

    The version scope above is what makes duplicates impossible in a healthy
    database, and this is the belt to its braces: a grid repaired by hand, or a
    lesson split across two terms — `termId` is deliberately not narrowed here,
    since resolving the term for a date is the timetable's job and not this
    read's — can still put two rows in one period. A period offered twice is a
    register somebody takes twice, against a roster that only sat it once.
  */
  const seen = new Set<string>();
  const distinct = running.filter((entry) => {
    const key = sessionScopeKey(entry.timeSlot.id, entry.classGroupId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  /*
    ── A double period is one séance ───────────────────────────────────────────
    Two hours of maths back to back are two rows on the grid — `TimetableEntry`
    has no span column, deliberately, so that the clash rules can be enforced
    per slot — and one lesson in the room. One theme is written for it and one
    appel is taken, so offering it twice asks the teacher to do the same job
    again against a class that sat down once.

    The run is merged on the same rule the grid itself uses (see
    `loadClassTimetable` and `entriesInBlock`): consecutive periods of the same
    subject, teacher and group, where each starts exactly when the last ended.
    The contiguity test is what keeps a récréation from being swallowed — break
    slots are already out of the query, so the gap they leave ends the run — and
    what keeps the same subject taught again after lunch a separate séance.

    The block is keyed on its first period: that is where the séance, its theme
    and its marks live.
  */
  const lessons: ((typeof distinct)[number] & {
    endTime: string;
    periods: number;
  })[] = [];

  for (const entry of distinct) {
    const previous = lessons[lessons.length - 1];
    const continues =
      previous !== undefined &&
      previous.endTime === entry.timeSlot.startTime &&
      previous.subject.id === entry.subject.id &&
      previous.teacherId === entry.teacherId &&
      previous.classGroupId === entry.classGroupId &&
      previous.termId === entry.termId;

    if (continues) {
      previous.endTime = entry.timeSlot.endTime;
      previous.periods += 1;
      continue;
    }

    lessons.push({
      ...entry,
      endTime: entry.timeSlot.endTime,
      periods: 1,
    });
  }

  const [marks, sessions, overlay] = await Promise.all([
    // One query for the whole day's marks rather than one per lesson.
    db.studentAttendance.findMany({
      where: {
        date: day,
        timeSlotId: { in: lessons.map((entry) => entry.timeSlot.id) },
        enrollment: { ...yearScope(context), schoolClassId },
      },
      select: { timeSlotId: true, status: true },
    }),
    db.classSession.findMany({
      where: { schoolClassId, date: day },
      select: {
        id: true,
        scopeKey: true,
        theme: true,
        homework: true,
        status: true,
        closedAt: true,
      },
    }),
    // The timetable module's own read of the one-off changes — a cancelled
    // period must not ask anybody for a register.
    loadWeekOverlay(context, schoolClassId, toDateKey(startOfWeek(day))),
  ]);

  const sessionByScope = new Map(
    sessions.map((session) => [session.scopeKey, session] as const),
  );

  return {
    ...empty,
    lessons: lessons.map((entry) => {
      const session =
        sessionByScope.get(
          sessionScopeKey(entry.timeSlot.id, entry.classGroupId),
        ) ?? null;

      const forThisPeriod = marks.filter(
        (mark) => mark.timeSlotId === entry.timeSlot.id,
      );

      return {
        timetableEntryId: entry.id,
        timeSlotId: entry.timeSlot.id,
        startTime: entry.timeSlot.startTime,
        endTime: entry.endTime,
        periods: entry.periods,
        session: entry.timeSlot.session,
        subjectId: entry.subject.id,
        subjectName: entry.subject.name,
        subjectColorHex: entry.subject.colorHex,
        teacherName: entry.teacher ? displayName(entry.teacher) : null,
        roomCode: entry.room?.code ?? null,
        classGroupId: entry.classGroupId,
        groupLabel: groupLabel(entry.classGroup),
        sessionId: session?.id ?? null,
        theme: session?.theme ?? null,
        homework: session?.homework ?? null,
        sessionStatus: session?.status ?? null,
        isClosed: session?.closedAt != null,
        absent: forThisPeriod.filter((mark) => mark.status === "ABSENT").length,
        late: forThisPeriod.filter((mark) => mark.status === "LATE").length,
        exceptionKind: overlay.exceptions[entry.timeSlot.id]?.kind ?? null,
      };
    }),
  };
}

export type ClassSessionRow = {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM — HH:MM`, null for a whole-day séance. */
  slotLabel: string | null;
  startTime: string | null;
  subjectName: string | null;
  subjectColorHex: string | null;
  groupLabel: string | null;
  teacherName: string | null;
  theme: string | null;
  homework: string | null;
  status: string;
  isClosed: boolean;
  absent: number;
  late: number;
};

/** How many séances the journal reads at once. A term's worth of teaching. */
const SESSION_PAGE_SIZE = 60;

/**
 * The class's cahier de textes: what was taught, newest first.
 *
 * ── Why the counts come from a groupBy ──────────────────────────────────────
 * A term of séances is a few hundred rows and their registers are tens of
 * thousands of marks. Including the attendance to count two statuses would read
 * every one of them to print two numbers per line, so the marks are grouped in
 * the database and folded onto the séances here.
 *
 * Scoped by the school in context and by the class asked for, like every other
 * office-side read in this file — a crafted class id reaches nothing.
 */
export async function listClassSessions(
  context: AuthContext,
  schoolClassId: string,
  options: { from?: Date; to?: Date; limit?: number } = {},
): Promise<ClassSessionRow[]> {
  const sessions = await db.classSession.findMany({
    where: {
      schoolClass: {
        id: schoolClassId,
        schoolId: currentSchoolId(context),
        levelOffering: yearScope(context),
      },
      ...(options.from || options.to
        ? {
            date: {
              ...(options.from ? { gte: startOfDay(options.from) } : {}),
              ...(options.to ? { lte: startOfDay(options.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { timeSlot: { position: "asc" } }],
    take: options.limit ?? SESSION_PAGE_SIZE,
    select: {
      id: true,
      date: true,
      theme: true,
      homework: true,
      status: true,
      closedAt: true,
      timeSlot: { select: { startTime: true, endTime: true } },
      subject: { select: { name: true, colorHex: true } },
      classGroup: { select: { code: true, name: true } },
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (sessions.length === 0) return [];

  const counts = await db.studentAttendance.groupBy({
    by: ["sessionId", "status"],
    where: {
      sessionId: { in: sessions.map((session) => session.id) },
      status: { in: ["ABSENT", "LATE"] },
    },
    _count: { _all: true },
  });

  const countOf = (sessionId: string, status: string) =>
    counts.find((row) => row.sessionId === sessionId && row.status === status)
      ?._count._all ?? 0;

  return sessions.map((session) => ({
    id: session.id,
    date: toDateInputValue(session.date),
    slotLabel: session.timeSlot
      ? `${session.timeSlot.startTime} — ${session.timeSlot.endTime}`
      : null,
    startTime: session.timeSlot?.startTime ?? null,
    subjectName: session.subject?.name ?? null,
    subjectColorHex: session.subject?.colorHex ?? null,
    groupLabel: groupLabel(session.classGroup),
    teacherName: session.teacher ? displayName(session.teacher) : null,
    theme: session.theme,
    homework: session.homework,
    status: session.status,
    isClosed: session.closedAt != null,
    absent: countOf(session.id, "ABSENT"),
    late: countOf(session.id, "LATE"),
  }));
}

/**
 * The register for one of a class's periods, for somebody who does not teach it.
 *
 * The mirror of `findRegister`, and deliberately the same shape: the appel a
 * director takes must look like the one the teacher would have taken, or the
 * two will disagree about who was in the room.
 *
 * ── Whole class, never half ─────────────────────────────────────────────────
 * The roster is the class even when the period is a split group's, because that
 * is what `saveSession` writes when `actsForSchool` is set — a stand-in has no
 * group of their own and guessing one leaves half the register unmarked. The
 * screen says which group the lesson belongs to; the list stays the class.
 *
 * Returns null when the class is not this school's, or the period is not one of
 * its lessons that day — the id in the URL is never the authority.
 */
export async function findClassRegister(
  context: AuthContext,
  input: { schoolClassId: string; timeSlotId: string; date: Date },
): Promise<Register | null> {
  const day = startOfDay(input.date);

  const { lessons } = await listClassLessons(
    context,
    input.schoolClassId,
    input.date,
  );
  const lesson = lessons.find(
    (candidate) => candidate.timeSlotId === input.timeSlotId,
  );
  if (!lesson) return null;

  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: input.schoolClassId,
      schoolId: currentSchoolId(context),
      levelOffering: yearScope(context),
    },
    select: { id: true, code: true },
  });
  if (!schoolClass) return null;

  const { pupils, timeSlotId, slotLabel } = await rosterRegister(context, {
    schoolClassId: schoolClass.id,
    classGroupId: null,
    timeSlotId: input.timeSlotId,
    day,
  });

  return {
    schoolClassId: schoolClass.id,
    classCode: schoolClass.code,
    // Null, not the lesson's group: the roster above is the whole class, and
    // saying otherwise would label the list wrongly.
    classGroupId: null,
    groupLabel: lesson.groupLabel,
    subjectId: lesson.subjectId,
    subjectName: lesson.subjectName,
    timeSlotId,
    slotLabel,
    date: toDateInputValue(day),
    // The séance as `listClassLessons` already resolved it, rather than a
    // second lookup: the two must agree about whether this register is closed,
    // and reading it twice is how they come to disagree.
    sessionId: lesson.sessionId,
    theme: lesson.theme,
    homework: lesson.homework,
    isCancelled: lesson.sessionStatus === "CANCELLED",
    isClosed: lesson.isClosed,
    pupils,
    tally: tallyAttendance(pupils),
  };
}
