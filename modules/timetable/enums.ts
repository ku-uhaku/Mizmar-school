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
 * Teaching days, ISO-8601 numbered (1 = Monday).
 *
 * The Moroccan week runs Monday to Saturday — Saturday is usually morning only,
 * and Sunday is the weekly day off. There is deliberately no 7.
 */
export const TEACHING_DAYS = [1, 2, 3, 4, 5, 6] as const;
export type TeachingDay = (typeof TEACHING_DAYS)[number];

export function isTeachingDay(value: number): value is TeachingDay {
  return (TEACHING_DAYS as readonly number[]).includes(value);
}

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
