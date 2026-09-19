/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/timetable/*.prisma`. Labels belong in
 * `modules/timetable/i18n/*.ts` once this module grows a UI.
 */

import { nullableKey } from "@/lib/db-keys";
import { addDays, atMidnight, schoolWeeks } from "@/modules/timetable/weeks";

/**
 * The two halves of a Moroccan school day. Many rules (canteen, transport,
 * half-day absence) key off the session rather than the clock, which is why it
 * is stored rather than derived from `startTime`.
 */
export const DAY_SESSIONS = ["MORNING", "AFTERNOON"] as const;
export type DaySession = (typeof DAY_SESSIONS)[number];

/**
 * Which bell schedule a slot belongs to.
 *
 * During Ramadan Moroccan schools switch to a compressed continuous day (horaire
 * continu) with no afternoon session. Rather than rewrite the grid twice a year,
 * a school keeps both sets of slots and switches which one is in force.
 */
export const SCHEDULE_KINDS = ["STANDARD", "RAMADAN"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/**
 * A whole-grid snapshot's lifecycle. Style matches SchoolYear.status.
 *
 *   ACTIVE    what every ordinary screen shows for its scope — at most one per
 *             (schoolYearId, scheduleKind), enforced by TimetableVersion.activeKey.
 *   ARCHIVED  superseded by a later generation, or by a revert. Its rows are
 *             kept, never deleted, so switching back to it is instant.
 */
export const TIMETABLE_VERSION_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type TimetableVersionStatus = (typeof TIMETABLE_VERSION_STATUSES)[number];

/**
 * Builds `TimetableVersion.activeKey` — see the note on that column for why it
 * exists. Never set by hand outside `activateTimetableVersion`/
 * `writeTimetableDraft`, which are the only two places that change which
 * version is active.
 */
export function activeVersionKeyOf(
  schoolYearId: string,
  scheduleKind: string,
): string {
  return `${schoolYearId}:${scheduleKind}`;
}

/**
 * Why the school is not teaching on a given day.
 *
 *   SCHOOL_HOLIDAY  vacances scolaires — the announced school breaks
 *   PUBLIC_HOLIDAY  jour férié — the school is closed because the country is
 *   EXAM_PERIOD     no ordinary lessons, but the school is very much open
 *   CLOSURE         anything else: weather, works, a one-off closure
 *
 * Told apart because a reader looking at an empty week needs to know which of
 * these it was — an exam period and a closure mean opposite things about
 * whether anybody was in the building.
 */
/**
 * What a one-off change to a week's grid does.
 *
 *   CANCELLED  the period is empty this week — a trip, a closure of one class
 *   REPLACED   a different subject/teacher/room runs instead, or a lesson lands
 *              in a period the template leaves free
 *
 * Two values and not more: "moved" is a cancellation here and a replacement
 * there, and modelling it as one row would tie two cells together that a user
 * then cannot edit apart.
 */
export const EXCEPTION_KINDS = ["CANCELLED", "REPLACED"] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

/** Why a teacher is away. Descriptive only — none of them changes the grid. */
export const ABSENCE_KINDS = ["SICK", "LEAVE", "TRAINING", "OTHER"] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

export const HOLIDAY_KINDS = [
  "SCHOOL_HOLIDAY",
  "PUBLIC_HOLIDAY",
  "EXAM_PERIOD",
  "CLOSURE",
] as const;
export type HolidayKind = (typeof HOLIDAY_KINDS)[number];

/**
 * The days a school may declare it teaches, ISO-8601 numbered (1 = Monday).
 *
 * All seven, and that is the point: this is what every picker offers, not what
 * a Moroccan school usually does. The usual week — Monday to Saturday, Saturday
 * morning only, Sunday off — is a *default*, and it lives in
 * `DEFAULT_SETTINGS.teachingDays` and `PRESET_TEACHING_DAYS` where a default
 * belongs. It used to stop at six here as well, which meant a school could not
 * say it opens on a Sunday however it configured itself: the picker simply had
 * no box, and `generateTimeSlotsAction` filtered the day back out.
 *
 * Which of them a given school actually teaches is `SchoolSettings.teachingDays`,
 * read through `teachingDaysOf(context.settings)`; which of those stop at noon
 * is `freeAfternoonDays`.
 */
export const TEACHING_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type TeachingDay = (typeof TEACHING_DAYS)[number];

/**
 * The most consecutive periods one lesson may occupy.
 *
 * Counted in *periods*, not hours, and a period is whatever the school's bell
 * schedule says — 30 minutes in the grids this app seeds. So eight covers the
 * 3h atelier that four covered when a period was an hour, and anything longer
 * is a data-entry slip rather than a lesson. Each period is still its own row —
 * see the note in `service.ts`.
 */
export const MAX_LESSON_SPAN = 8;

/**
 * The most lines of detail one lesson may carry — see `TimetableEntryDetail`.
 * A guard against a runaway form: past a handful, the pieces of an hour are
 * shorter than anything anybody teaches.
 */
export const MAX_ENTRY_DETAILS = 6;

/**
 * How long a lesson runs, offered as minutes rather than as a count of periods.
 *
 * ── Why the screens talk in hours and the placer counts periods ─────────────
 * The bell rings every 30 minutes so that a school can start at 08h30 or 09h30
 * — the half hour exists to let the whole day *shift*, not because anybody
 * teaches for half an hour. A lesson is an hour, and a screen that asked "how
 * many periods?" would be asking the head of studies to do the conversion in
 * their head and to get it wrong the first time the bell schedule changed.
 *
 * So the dialogs offer these, and `periodsForMinutes` turns the answer into the
 * number of consecutive slots the placer actually books.
 */
export const LESSON_LENGTHS_MINUTES = [30, 60, 90, 120] as const;

/**
 * The longest lesson the generator may join from consecutive slots.
 *
 * The generator no longer counts periods — slots differ in length, so it sums
 * their minutes — and this is the ceiling it and its request bound share.
 */
export const MAX_BLOCK_MINUTES = 240;

/**
 * What the generator dialog offers for "how long may one lesson be". 0 is "one
 * lesson per slot, whatever the slot's length" — the default, and the only
 * setting that follows a bell of mixed lengths exactly.
 */
export const GENERATOR_BLOCK_OPTIONS = [0, 90, 120, 180, 240] as const;

/** Most minutes of one subject a day the dialog offers. */
export const GENERATOR_DAY_LIMIT_OPTIONS = [60, 90, 120, 180, 240] as const;

/**
 * How many consecutive periods a lesson of `minutes` occupies.
 *
 * Rounded up, and never below one: a school whose bell is 45 minutes asking for
 * an hour gets two periods rather than one and a third, because a lesson has to
 * end when a bell rings.
 */
export function periodsForMinutes(
  minutes: number,
  periodMinutes: number,
): number {
  if (periodMinutes <= 0) return 1;
  return Math.max(1, Math.ceil(minutes / periodMinutes));
}

/** `90` → `"1h30"`, `60` → `"1h"`, `30` → `"30min"`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** `HH:MM`, 24-hour — the format `TimeSlot.startTime` / `endTime` are stored in. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeOfDay(value: string): boolean {
  return TIME_OF_DAY_PATTERN.test(value);
}

/**
 * Builds `TimetableEntry.bookingKey`, which is what makes the no-double-booking
 * rule enforceable — see lib/db-keys.ts for why the nullable columns cannot be
 * indexed directly.
 *
 * Every write of a TimetableEntry must set this, and must recompute it whenever
 * it changes `classGroupId`, `termId` or `weekParity`.
 *
 * The parity is in the key so one class can hold the same slot in week A and in
 * week B. It does not make the database able to enforce the whole rule — ALL
 * overlaps both A and B and no key can say so — which is why `parityOverlaps`
 * exists and `findClash` still checks.
 */
export function bookingKeyOf(
  classGroupId: string | null | undefined,
  termId: string | null | undefined,
  weekParity: string | null | undefined = "ALL",
  fromWeek: number | null | undefined = null,
  toWeek: number | null | undefined = null,
): string {
  return nullableKey(
    classGroupId,
    termId,
    weekParity ?? "ALL",
    fromWeek === null || fromWeek === undefined ? "" : String(fromWeek),
    toWeek === null || toWeek === undefined ? "" : String(toWeek),
  );
}

// ── Week windows ─────────────────────────────────────────────────────────────

export type WeekWindow = {
  /** Null = since the start of the year. */
  fromWeek: number | null;
  /** Null = until further notice. */
  toWeek: number | null;
};

/** Whether a lesson is in force in a given week. */
export function runsInWeekNumber(
  window: WeekWindow,
  weekNumber: number | null,
): boolean {
  // No week in play — a printout of the template, say — so everything counts.
  if (weekNumber === null) return true;
  if (window.fromWeek !== null && weekNumber < window.fromWeek) return false;
  if (window.toWeek !== null && weekNumber > window.toWeek) return false;
  return true;
}

/**
 * Whether two lessons are ever in force in the same week.
 *
 * Open ends are what make this worth a function: "since the start" and "until
 * further notice" are both null, and the naive comparison of two nulls says
 * nothing. Two halves of a split lesson — one ending at S11, one starting at
 * S12 — must come out as *not* overlapping, or a grid could never be edited
 * mid-year.
 */
export function weekWindowsOverlap(a: WeekWindow, b: WeekWindow): boolean {
  const aFrom = a.fromWeek ?? Number.NEGATIVE_INFINITY;
  const aTo = a.toWeek ?? Number.POSITIVE_INFINITY;
  const bFrom = b.fromWeek ?? Number.NEGATIVE_INFINITY;
  const bTo = b.toWeek ?? Number.POSITIVE_INFINITY;
  return aFrom <= bTo && bFrom <= aTo;
}

/**
 * Which weeks a lesson runs in.
 *
 *   ALL  every week — the ordinary case
 *   A    odd weeks of the rotation
 *   B    even weeks
 *
 * Kept as three values rather than a nullable "A or B" because "every week" is
 * a real answer and by far the commonest, and a null would make every reader
 * decide for itself what a missing parity meant.
 */
export const WEEK_PARITIES = ["ALL", "A", "B"] as const;
export type WeekParity = (typeof WEEK_PARITIES)[number];

/** The parities a week actually is — what SchoolWeek.parity holds. */
export const SCHOOL_WEEK_PARITIES = ["A", "B"] as const;
export type SchoolWeekParity = (typeof SCHOOL_WEEK_PARITIES)[number];

/**
 * Whether two lessons can collide, given the weeks each runs in.
 *
 * ALL overlaps everything, including the other ALL. A and B miss each other —
 * that is the whole point of the rotation. Pure, and used by both the clash
 * check on the server and the grid on the client, so the two cannot disagree
 * about whether a cell is free.
 */
export function parityOverlaps(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = a ?? "ALL";
  const right = b ?? "ALL";
  if (left === "ALL" || right === "ALL") return true;
  return left === right;
}

/** Whether a lesson runs in a given week. */
export function runsInWeek(
  weekParity: string | null | undefined,
  week: { parity: string } | null,
): boolean {
  const parity = weekParity ?? "ALL";
  if (parity === "ALL") return true;
  if (!week) return true;
  return parity === week.parity;
}

/** Minutes since midnight, for ordering and overlap maths on stored `HH:MM`. */
export function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * `08:00` + 60 → `09:00`. The inverse of `minutesSinceMidnight`, kept beside
 * it for the same reason: a bell schedule never crosses midnight, so plain
 * integer arithmetic on the stored "HH:MM" text is enough and a date library
 * would be answering a question about calendars this never asks.
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const total = minutesSinceMidnight(time) + minutes;
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** True when two `HH:MM` ranges overlap. Touching ends do not count. */
export function slotsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return (
    minutesSinceMidnight(a.startTime) < minutesSinceMidnight(b.endTime) &&
    minutesSinceMidnight(b.startTime) < minutesSinceMidnight(a.endTime)
  );
}

// ── The year's weeks ─────────────────────────────────────────────────────────

export type WeekPlan = {
  number: number;
  startsOn: Date;
  endsOn: Date;
  /** False when a holiday swallows the week whole. */
  isTeaching: boolean;
  parity: SchoolWeekParity;
};

/**
 * Lays out every week the school year spans, and which half of the rotation
 * each taught one falls on.
 *
 * ── One numbering ───────────────────────────────────────────────────────────
 * The weeks and their bounds come straight from `schoolWeeks()`, which is what
 * the week picker navigates by, so a stored week and a `?week=` are the same
 * week. Numbering only the taught weeks was tried and made "semaine 12" mean
 * two different fortnights depending on which screen you read.
 *
 * ── The rotation skips the holidays ─────────────────────────────────────────
 * Parity advances on taught weeks only. A fortnight of vacances must not
 * silently swap which half comes back — that is exactly the mistake a school
 * makes doing this on paper. A holiday week carries the parity the next taught
 * week will use, so reading down the column never jumps.
 *
 * Pure, and exported so the seed, the generator action and any preview lay the
 * year out identically.
 */
export function planSchoolWeeks(input: {
  yearStart: Date;
  yearEnd: Date;
  /** Inclusive ranges, as SchoolHoliday stores them. */
  holidays: readonly { startDate: Date; endDate: Date }[];
  firstParity?: SchoolWeekParity;
}): WeekPlan[] {
  const holidays = input.holidays.map((holiday) => ({
    start: atMidnight(holiday.startDate).getTime(),
    end: atMidnight(holiday.endDate).getTime(),
  }));

  const covered = (day: Date) => {
    const time = day.getTime();
    return holidays.some((holiday) => time >= holiday.start && time <= holiday.end);
  };

  let parity: SchoolWeekParity = input.firstParity ?? "A";

  return schoolWeeks(input.yearStart, input.yearEnd).map((week) => {
    // Monday to Saturday: Sunday is never taught, so it cannot rescue a week
    // that is otherwise entirely holiday.
    const teaches = [0, 1, 2, 3, 4, 5]
      .map((offset) => addDays(week.start, offset))
      .some((day) => !covered(day));

    const plan: WeekPlan = {
      number: week.index,
      startsOn: week.start,
      endsOn: week.end,
      isTeaching: teaches,
      parity,
    };

    if (teaches) parity = parity === "A" ? "B" : "A";
    return plan;
  });
}
