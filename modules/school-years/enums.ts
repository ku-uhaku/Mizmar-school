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
