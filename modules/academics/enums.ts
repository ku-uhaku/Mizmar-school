/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/academics/*.prisma`.
 *
 * SQLite has no native enum type, so these unions are what validates the
 * columns. Labels belong in `modules/academics/i18n/*.ts` once this module grows
 * a UI.
 */

import { nullableKey } from "@/lib/db-keys";

/**
 * The four cycles of the Moroccan system, in progression order.
 *
 * Fixed, unlike filières: the cycles are set by the Ministry and a school picks
 * from them rather than inventing its own.
 *
 *   PRESCHOOL             التعليم الأولي         — 2 years, ages ~4–5
 *   PRIMARY               التعليم الابتدائي      — 6 years, 1AP … 6AP
 *   SECONDARY_COLLEGE     التعليم الثانوي الإعدادي — 3 years, 1AC … 3AC
 *   SECONDARY_QUALIFYING  التعليم الثانوي التأهيلي — 3 years, TC, 1BAC, 2BAC
 */
export const EDUCATION_CYCLES = [
  "PRESCHOOL",
  "PRIMARY",
  "SECONDARY_COLLEGE",
  "SECONDARY_QUALIFYING",
] as const;
export type EducationCycle = (typeof EDUCATION_CYCLES)[number];

/**
 * How many grades each cycle contains, and therefore the valid range for
 * `Level.gradeYear`. Used to validate a level rather than to generate one — a
 * school may run a partial cycle.
 */
export const CYCLE_GRADE_COUNT: Record<EducationCycle, number> = {
  PRESCHOOL: 2,
  PRIMARY: 6,
  SECONDARY_COLLEGE: 3,
  SECONDARY_QUALIFYING: 3,
};

/**
 * Cycles that stream into filières. Only the qualifying cycle does, which is why
 * every `trackId` in the schema is nullable.
 */
export function cycleHasTracks(cycle: EducationCycle): boolean {
  return cycle === "SECONDARY_QUALIFYING";
}

/**
 * Marks are out of 20 throughout the Moroccan system, and 10 is the pass mark.
 * Kept here because the grading module will need the same constants and they are
 * a property of the curriculum, not of any one screen.
 */
export const MARK_SCALE_MAX = 20;
export const MARK_PASS_THRESHOLD = 10;

/** Coefficients are small integers in practice; this bounds data entry. */
export const COEFFICIENT_MIN = 1;
export const COEFFICIENT_MAX = 20;

/**
 * Builds `LevelSubject.scopeKey`, which is what stops the same subject being
 * declared twice for "all tracks" of a level — see lib/db-keys.ts for why the
 * nullable `trackId` cannot be indexed directly.
 *
 * Every write of a LevelSubject must set this, and must recompute it whenever it
 * changes `trackId`.
 */
export function levelSubjectScopeKey(
  trackId: string | null | undefined,
): string {
  return nullableKey(trackId);
}
