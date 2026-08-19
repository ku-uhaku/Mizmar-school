/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/school-years/*.prisma`. Labels live in `i18n/*.ts`
 * under `schoolYear.statuses`.
 */

export const SCHOOL_YEAR_STATUSES = ["PLANNED", "ACTIVE", "CLOSED"] as const;
export type SchoolYearStatus = (typeof SCHOOL_YEAR_STATUSES)[number];

/**
 * Status of a semestre. Deliberately the same three values as a school year, so
 * the two read consistently — but a distinct type, because closing a term locks
 * mark entry while closing a year archives it.
 */
export const TERM_STATUSES = ["PLANNED", "ACTIVE", "CLOSED"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

/**
 * Moroccan schools run two semesters, each closed by a normalised exam.
 * `Term.number` is validated against this rather than hard-coded, because some
 * primary schools still work in three trimesters.
 */
export const TERMS_PER_YEAR_DEFAULT = 2;
export const TERM_NUMBER_MAX = 3;

/**
 * What a new year can inherit from an old one.
 *
 *   CALENDAR   les semestres, les créneaux horaires et les vacances
 *   STRUCTURE  les niveaux offerts, les classes et leurs groupes
 *   FEES       la liste des prix et les réductions
 *   TRANSPORT  les horaires, les circuits, leurs arrêts et leurs quartiers
 *
 * Four groups rather than a checkbox per table: a school thinks in "the
 * calendar" and "the classes", and offering fourteen tick-boxes would be asking
 * the operator to know which table a class group lives in.
 *
 * None of them ever carries a person — no pupil, no abonnement, no professeur
 * principal. What a year holds about people is that year's own business, and
 * copying it is how a September starts out quietly wrong.
 */
export const YEAR_COPY_PARTS = [
  "CALENDAR",
  // Before the structure: the classes a level opens are drawn against what that
  // level is taught, and a year whose programme is empty can neither be
  // timetabled nor averaged. See LevelSubject.
  "PROGRAMME",
  "STRUCTURE",
  "FEES",
  "TRANSPORT",
] as const;
export type YearCopyPart = (typeof YEAR_COPY_PARTS)[number];

/**
 * How far to move a copied date, in **whole weeks**, so a Monday stays a Monday.
 *
 * The bell schedule is keyed on the day of the week and `planSchoolWeeks`
 * decides whether a week is taught by looking at Monday to Saturday, so a
 * holiday that slid mid-week would quietly change which weeks count. Rounding
 * the gap between the two years' start dates to the nearest seven days keeps
 * every weekday aligned at the cost of a few days' drift, which is the right
 * trade: the drift is visible and correctable, the weekday shift is not.
 */
export function shiftInDays(sourceStart: Date, targetStart: Date): number {
  const days = Math.round(
    (targetStart.getTime() - sourceStart.getTime()) / 86_400_000,
  );
  return Math.round(days / 7) * 7;
}
