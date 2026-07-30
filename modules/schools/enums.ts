/**
 * Allowed values for this module's "enum-like" String columns.
 *
 * SQLite has no native enum type, so these unions are the source of truth for
 * `prisma/schema/schools/school.prisma`. Keep both in sync — and add the label
 * for every new value to `i18n/*.ts` (`school.levels`) at the same time.
 */

export const SCHOOL_LEVELS = [
  "PRESCHOOL",
  "PRIMARY",
  "MIDDLE",
  "HIGH",
  "GROUP",
] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];
