/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/classroom/*.prisma`. Labels live in `i18n/*.ts` under
 * `classroomOptions`.
 *
 * Pure data: no server imports, no React. The register is a client component and
 * counts its own totals from these helpers, so they must cross the boundary.
 */

import { nullableKey } from "@/lib/db-keys";
import { minutesSinceMidnight } from "@/modules/timetable/enums";

/**
 * Whether a pupil was in the room.
 *
 *   PRESENT  there, on time
 *   LATE     there, after the bell — `minutesLate` says by how much
 *   ABSENT   not there, nothing on file
 *   EXCUSED  not there, with a justification the office has accepted
 *
 * LATE is a status of its own rather than a flag on PRESENT because a retard is
 * what a school acts on by accumulation — three of them and somebody writes to
 * the family — and that count is impossible if lateness hides inside "present".
 */
export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** The statuses that mean the pupil was not in the room. */
export const MISSING_STATUSES: readonly AttendanceStatus[] = [
  "ABSENT",
  "EXCUSED",
];

/**
 * Whether a stored status means the pupil missed the lesson.
 *
 * Takes a plain string because that is what the column is: the values are an
 * enum by convention only, so a read has to be able to ask about whatever it
 * found rather than about what it hoped for.
 */
export function wasMissing(status: string): boolean {
  return (MISSING_STATUSES as readonly string[]).includes(status);
}

/**
 * The statuses a justification can be accepted against.
 *
 * A retard is here as well as an absence: a note explaining why a child arrived
 * at half past eight is the same piece of paper, and the pupil's file counts
 * unjustified lates separately from unjustified absences. What is *not* here is
 * PRESENT — there is nothing to excuse about a pupil who was in the room on
 * time, and accepting one would turn them into an absentee.
 */
export const JUSTIFIABLE_STATUSES: readonly AttendanceStatus[] = [
  "ABSENT",
  "EXCUSED",
  "LATE",
];

/**
 * Whether a séance actually took place.
 *
 * CANCELLED is recorded rather than left blank: "no lesson that Tuesday" and
 * "nobody wrote the lesson up" are different facts, and a cahier de textes that
 * cannot tell them apart is one the inspection does not accept. A cancelled
 * séance takes no register.
 */
export const SESSION_STATUSES = ["HELD", "CANCELLED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * Mirror for the two nullable columns that make a séance unique within a day.
 *
 * The slot is in it because a whole-day séance and a period one are records of
 * different things; the group is in it because two halves of one class can sit
 * different subjects in the same period. Both are null in the commonest case of
 * all, and MySQL treats NULLs as distinct — so without this the unique index
 * would not fire exactly where it matters. See lib/db-keys.ts.
 */
export function sessionScopeKey(
  timeSlotId: string | null,
  classGroupId: string | null,
): string {
  return nullableKey(timeSlotId, classGroupId);
}

/** What a teacher notes about a pupil. */
export const REMARK_KINDS = [
  "BEHAVIOUR",
  "WORK",
  "PROGRESS",
  "ATTENDANCE",
  "OTHER",
] as const;
export type RemarkKind = (typeof REMARK_KINDS)[number];

/**
 * The tone of a remark, kept separate from its kind.
 *
 * "Behaviour" can be praise as easily as a complaint, and a carnet that only
 * ever records problems is one nobody reads to the child's credit.
 */
export const REMARK_TONES = ["POSITIVE", "NEUTRAL", "CONCERN"] as const;
export type RemarkTone = (typeof REMARK_TONES)[number];

/** Longest a remark may run — a paragraph, not an essay. */
export const REMARK_MAX_LENGTH = 1000;

/**
 * How many remarks one read returns.
 *
 * Ample for a teacher's own carnet, which is what it was chosen for. It is not
 * ample for the direction's review screen, where the scope is the whole school
 * — so that screen says so when it is holding a full page, rather than quietly
 * showing the newest 200 of 652 and letting somebody conclude they have worked
 * through a backlog they have not seen the bottom of.
 */
export const REMARK_PAGE_SIZE = 200;

/** Most minutes a retard can sensibly be before it is really an absence. */
export const MAX_MINUTES_LATE = 120;

/**
 * Longest a séance's theme or travail à faire may run.
 *
 * A paragraph each. The cahier de textes is read at a glance by whoever takes
 * the next lesson, and a column that invites an essay gets one.
 */
export const SESSION_TEXT_MAX = 1000;

/**
 * Mirror for the nullable `timeSlotId`, so the unique index on
 * StudentAttendance actually fires.
 *
 * MySQL treats NULLs as distinct in a unique index, so a pupil could be marked
 * twice for the same whole-day register and every absence count would double.
 * Writing a sentinel instead of NULL is what makes the constraint real. See
 * lib/db-keys.ts for the same pattern elsewhere.
 */
export function attendanceScopeKey(timeSlotId: string | null): string {
  return timeSlotId ?? "__day__";
}

/** Midnight, so two marks for the same day always compare equal. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Which of a day's lessons a register should open on at `now`: the one being
 * taught, else the one about to be, else the last of the day.
 *
 * A teacher opening the appel is standing in front of a class, so "which class"
 * is a question the clock can answer and should not be asked. Between two
 * periods it looks *forward* — a register is taken at the start of a lesson,
 * not after the previous one has ended — and once the school day is over it
 * stops at the last lesson, which is what somebody marking up in the evening
 * means. Before the first bell, "the one about to be" is that first lesson.
 *
 * Sorted here rather than trusting the caller's order, so the rule cannot
 * quietly become a rule about list position.
 */
export function lessonAt<T extends { startTime: string; endTime: string }>(
  lessons: readonly T[],
  now: Date,
): T | null {
  if (lessons.length === 0) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const byStart = [...lessons].sort(
    (a, b) =>
      minutesSinceMidnight(a.startTime) - minutesSinceMidnight(b.startTime),
  );

  return (
    byStart.find(
      (lesson) =>
        minutesSinceMidnight(lesson.startTime) <= minutes &&
        minutes < minutesSinceMidnight(lesson.endTime),
    ) ??
    byStart.find((lesson) => minutesSinceMidnight(lesson.startTime) > minutes) ??
    byStart[byStart.length - 1]
  );
}

export type AttendanceTally = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /**
   * Always 0, and kept only so the figures still add up to `total`.
   *
   * It used to mean "pupils nobody has decided about yet", which was a real
   * state while a register wrote a row per pupil. It cannot exist now: presence
   * is the absence of a row, so an unflagged pupil *is* the answer rather than a
   * gap in it. Whether the appel was taken at all is the séance's business —
   * see `ClassSession.closedAt`.
   */
  unmarked: number;
  total: number;
};

/**
 * The figures under a register.
 *
 * Counted over the roster, not over the rows: a pupil with no mark was there.
 * Pass the whole class — every pupil, flagged or not — and the present count
 * falls out as whatever is left.
 */
export function tallyAttendance(
  roster: readonly { status: string | null }[],
): AttendanceTally {
  const count = (status: string) =>
    roster.filter((pupil) => pupil.status === status).length;

  const late = count("LATE");
  const absent = count("ABSENT");
  const excused = count("EXCUSED");

  return {
    present: roster.length - late - absent - excused,
    late,
    absent,
    excused,
    unmarked: 0,
    total: roster.length,
  };
}
