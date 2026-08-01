import { toDateInputValue } from "@/lib/utils";

/**
 * Dates that fall inside the school year.
 *
 * ── Why "today" is not a safe default ────────────────────────────────────────
 * A Moroccan school year runs September to early July, and the application is
 * used through the summer too: enrolling for September, printing last year's
 * certificates, closing the books. Every form that defaults a date to `today`
 * therefore proposes a date outside the year for two months of every twelve —
 * a contrôle dated in August belongs to no term, a register for August marks a
 * day the school was shut, and both are accepted without complaint because
 * nothing downstream re-checks.
 *
 * So the default is clamped: today when today is inside the year, otherwise the
 * nearest end of it. The user can still type any date they like — this decides
 * what the box starts at, which is what actually gets submitted nine times out
 * of ten.
 *
 * Pure, and takes the dates rather than reading context, so a page hands it
 * `context.currentSchoolYear` and a component can be given the result.
 */
export function clampToSchoolYear(
  date: Date,
  year: { startDate: Date; endDate: Date } | null,
): Date {
  if (!year) return date;
  if (date < year.startDate) return year.startDate;
  if (date > year.endDate) return year.endDate;
  return date;
}

/**
 * The same, as the `YYYY-MM-DD` an `<input type="date">` wants.
 *
 * `today` is a parameter so the caller can pass a date already resolved from a
 * query string, and so this is testable without stubbing the clock.
 */
export function defaultDateWithin(
  year: { startDate: Date; endDate: Date } | null,
  today: Date = new Date(),
): string {
  return toDateInputValue(clampToSchoolYear(today, year));
}
