/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/classroom/*.prisma`. Labels live in `i18n/*.ts` under
 * `classroomOptions`.
 *
 * Pure data: no server imports, no React. The register is a client component and
 * counts its own totals from these helpers, so they must cross the boundary.
 */

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

/** Was the pupil there at all? LATE counts as attending — they turned up. */
export function wasPresent(status: string): boolean {
  return status === "PRESENT" || status === "LATE";
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

/** Most minutes a retard can sensibly be before it is really an absence. */
export const MAX_MINUTES_LATE = 120;

/**
 * Mirror for the nullable `timeSlotId`, so the unique index on
 * StudentAttendance actually fires.
 *
 * SQLite treats NULLs as distinct in a unique index, so a pupil could be marked
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

export type AttendanceTally = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Pupils with no mark at all — the register is not finished. */
  unmarked: number;
  total: number;
};

/** The figures under a register, computed from the marks alone. */
export function tallyAttendance(
  marks: readonly { status: string | null }[],
): AttendanceTally {
  const count = (status: string) =>
    marks.filter((mark) => mark.status === status).length;

  return {
    present: count("PRESENT"),
    late: count("LATE"),
    absent: count("ABSENT"),
    excused: count("EXCUSED"),
    unmarked: marks.filter((mark) => mark.status === null).length,
    total: marks.length,
  };
}
