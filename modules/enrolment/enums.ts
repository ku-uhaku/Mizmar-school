/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/enrolment/*.prisma` — plus the money and calendar
 * maths the fee schedule is built from.
 *
 * Pure data and pure functions: this file crosses to the client, where the fee
 * grid uses the same `netAmount` the server wrote with. A cell that computed its
 * own total differently from the row it renders would be worse than no preview
 * at all.
 */

import { applyPercentBps } from "@/modules/billing/enums";

/**
 * Where an inscription stands.
 *
 *   PENDING      the family has applied; the place is not confirmed
 *   ACTIVE       inscribed and attending
 *   TRANSFERRED  left for another school mid-year
 *   WITHDRAWN    left without transferring
 *   COMPLETED    finished the year
 *
 * `Student.status` is derived from these — see modules/students/service.ts.
 */
export const ENROLMENT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "TRANSFERRED",
  "WITHDRAWN",
  "COMPLETED",
] as const;
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number];

/** Statuses that mean the pupil still holds a place. */
export const LIVE_ENROLMENT_STATUSES: readonly EnrolmentStatus[] = [
  "PENDING",
  "ACTIVE",
];

/**
 * What has become of one line of the échéancier.
 *
 *   DUE        owed
 *   WAIVED     forgiven — a favour, and reported as one
 *   CANCELLED  should never have been raised, or the pupil left before it fell
 *
 * Payment is not modelled yet. When it is, it settles DUE lines; the other two
 * are already out of the reckoning.
 */
export const FEE_LINE_STATUSES = ["DUE", "WAIVED", "CANCELLED"] as const;
export type FeeLineStatus = (typeof FEE_LINE_STATUSES)[number];

/** Lines that count toward what a family owes. */
export function isPayable(status: string): boolean {
  return status === "DUE";
}

/**
 * What one schedule line actually costs: the base, less a percentage, less a
 * flat sum, floored at zero.
 *
 * The order matters and is fixed here on purpose — applying the flat reduction
 * before the percentage gives a different answer, and two screens disagreeing
 * about a parent's bill by a few dirhams is a support call. Never negative: a
 * reduction larger than the charge is a data-entry slip, not a credit note.
 */
export function netAmount(
  baseAmountCentimes: number,
  discountBps: number,
  discountCentimes: number,
): number {
  const afterPercentage = applyPercentBps(baseAmountCentimes, discountBps);
  return Math.max(0, afterPercentage - discountCentimes);
}

/**
 * How many instalments a charge is collected in when the price list does not
 * say. `FeeRate.instalmentCount` overrides all of these.
 */
export function defaultInstalmentCount(
  billingCycle: string,
  monthsInYear: number,
  termCount: number,
): number {
  switch (billingCycle) {
    case "MONTHLY":
      return Math.max(1, monthsInYear);
    case "TERM":
      return Math.max(1, termCount);
    // ANNUAL and ONE_OFF are quoted and collected once unless the rate splits
    // them — a school that collects its annual scolarité over nine months says
    // so in `instalmentCount`.
    default:
      return 1;
  }
}

/** A calendar month, as the fee grid's columns are keyed. */
export type MonthKey = { year: number; month: number };

export function monthKeyOf(date: Date): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** `2025-09` — a stable string key for a month, for maps and React keys. */
export function monthKeyString({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Every month the school year touches, in order — the columns of the fee grid.
 *
 * Built from the year's own dates rather than assumed to be September–June: a
 * school that runs to mid-July gets a July column, and one that does not is not
 * given an empty one.
 */
export function monthsOfYear(startDate: Date, endDate: Date): MonthKey[] {
  const months: MonthKey[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  // Guard against a year whose end precedes its start; validation stops that at
  // the form, but a loop that would never terminate is not worth risking.
  while (cursor <= last && months.length < 24) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

/**
 * The dates `count` instalments fall due on, spread month by month from the
 * school year's start.
 *
 * The day of the month is the year's own start day rather than an invented
 * convention: a year opening on 15 September bills on the 15th, and nobody has
 * to remember why it would otherwise be the 5th. Instalments that would run past
 * the end of the year are clamped to the last month, so a nine-month plan on a
 * six-month year still produces nine dated lines instead of dates in the
 * holidays.
 */
export function instalmentDueDates(
  yearStart: Date,
  yearEnd: Date,
  count: number,
): Date[] {
  const months = monthsOfYear(yearStart, yearEnd);
  const day = yearStart.getDate();

  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const slot = months[Math.min(index, months.length - 1)] ?? {
      year: yearStart.getFullYear(),
      month: yearStart.getMonth() + 1,
    };
    // Day 31 in a 30-day month rolls into the next one; clamping keeps the line
    // in the column its month says it is in.
    const lastDayOfMonth = new Date(slot.year, slot.month, 0).getDate();
    return new Date(slot.year, slot.month - 1, Math.min(day, lastDayOfMonth));
  });
}
