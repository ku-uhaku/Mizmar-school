/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/school-years/school-year.prisma`. Labels live in
 * `i18n/*.ts` under `schoolYear.statuses`.
 */

export const SCHOOL_YEAR_STATUSES = ["PLANNED", "ACTIVE", "CLOSED"] as const;
export type SchoolYearStatus = (typeof SCHOOL_YEAR_STATUSES)[number];
