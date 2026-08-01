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
 * it changes `classGroupId` or `termId`.
 */
export function bookingKeyOf(
  classGroupId: string | null | undefined,
  termId: string | null | undefined,
): string {
  return nullableKey(classGroupId, termId);
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
