/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/timetable/*.prisma`. Labels belong in
 * `modules/timetable/i18n/*.ts` once this module grows a UI.
 */

import { nullableKey } from "@/lib/db-keys";

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
 * Teaching days, ISO-8601 numbered (1 = Monday).
 *
 * The Moroccan week runs Monday to Saturday — Saturday is usually morning only,
 * and Sunday is the weekly day off. There is deliberately no 7.
 */
/**
 * The week when nobody has said otherwise — Monday to Saturday, as most
 * Moroccan schools run.
 *
 * A school declares its own in the configuration (SchoolSettings.teachingDays),
 * and every grid is drawn from `teachingDaysOf(context.settings)`. This stays as
 * the fallback and as the set the picker offers, which is why it still lists six
 * days rather than seven: a school that teaches Sunday adds it in the settings.
 */
export const TEACHING_DAYS = [1, 2, 3, 4, 5, 6] as const;
export type TeachingDay = (typeof TEACHING_DAYS)[number];

/**
 * The most consecutive periods one lesson may occupy.
 *
 * Four, because a Moroccan timetable runs 2h blocks for TP and the odd 3h
 * atelier, and anything longer is a data-entry slip rather than a lesson. Each
 * period is still its own row — see the note in `service.ts`.
 */
export const MAX_LESSON_SPAN = 4;

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
): string {
  return nullableKey(classGroupId, termId, weekParity ?? "ALL");
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

/** Midnight of a date, local — the calendar day, with no time on it. */
function atMidnight(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** The Monday of the week a date falls in. Sunday counts as the week before. */
export function mondayOf(value: Date): Date {
  const date = atMidnight(value);
  // getDay(): 0 = Sunday … 6 = Saturday. Sunday is the *end* of the Moroccan
  // school week, not the start, so it belongs to the Monday six days back.
  const weekday = date.getDay();
  const shift = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + shift);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export type WeekPlan = {
  number: number;
  startsOn: Date;
  /** Saturday — the Moroccan school week runs Monday to Saturday. */
  endsOn: Date;
  parity: SchoolWeekParity;
};

/**
 * Lays out the weeks a school year actually teaches in.
 *
 * ── What gets a number ──────────────────────────────────────────────────────
 * Only weeks with at least one teaching day left in them. A week swallowed
 * whole by the vacances is skipped rather than numbered and flagged, because
 * "semaine 12" is what a progression pédagogique counts in — the twelfth week
 * the school taught, not the twelfth square on a calendar. A week that loses
 * three days to a férié is still a teaching week and keeps its real dates.
 *
 * Parity alternates from `firstParity`, so the rotation is a consequence of the
 * numbering rather than a second thing to maintain. A school that comes back
 * from the holidays on the wrong foot fixes the one row, not the year.
 *
 * Pure, and exported so the seed, the generator action and any preview all lay
 * the year out identically.
 */
export function planSchoolWeeks(input: {
  yearStart: Date;
  yearEnd: Date;
  /** Inclusive ranges, as SchoolHoliday stores them. */
  holidays: readonly { startDate: Date; endDate: Date }[];
  firstParity?: SchoolWeekParity;
}): WeekPlan[] {
  const lastDay = atMidnight(input.yearEnd);
  const holidays = input.holidays.map((holiday) => ({
    start: atMidnight(holiday.startDate).getTime(),
    end: atMidnight(holiday.endDate).getTime(),
  }));

  const isHoliday = (day: Date) => {
    const time = day.getTime();
    return holidays.some((holiday) => time >= holiday.start && time <= holiday.end);
  };

  const weeks: WeekPlan[] = [];
  let cursor = mondayOf(input.yearStart);
  let number = 1;
  let parity: SchoolWeekParity = input.firstParity ?? "A";

  // Bounded rather than `while (true)`: a mis-entered year with the end before
  // the start must not spin. Sixty covers any school year with room to spare.
  for (let guard = 0; guard < 60 && cursor <= lastDay; guard += 1) {
    const saturday = addDays(cursor, 5);

    // Monday to Saturday — Sunday is never a teaching day, so it cannot rescue
    // a week that is otherwise entirely holiday.
    const teaches = [0, 1, 2, 3, 4, 5]
      .map((offset) => addDays(cursor, offset))
      .some((day) => day <= lastDay && !isHoliday(day));

    if (teaches) {
      weeks.push({ number, startsOn: cursor, endsOn: saturday, parity });
      number += 1;
      parity = parity === "A" ? "B" : "A";
    }

    cursor = addDays(cursor, 7);
  }

  return weeks;
}

/** The week a date falls in, or null when it is outside the taught year. */
export function weekOf<T extends { startsOn: Date; endsOn: Date }>(
  weeks: readonly T[],
  date: Date,
): T | null {
  const time = atMidnight(date).getTime();
  return (
    weeks.find(
      (week) =>
        time >= atMidnight(week.startsOn).getTime() &&
        time <= atMidnight(week.endsOn).getTime(),
    ) ?? null
  );
}
