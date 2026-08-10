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
 * What a school calls its primary years.
 *
 * The Ministry's six years are the same six years either way — this is a naming
 * convention, not a different cursus. A school under Moroccan nomenclature runs
 * 1AP…6AP; one that took its names from the French system runs CP, CE1, CE2,
 * CM1, CM2 and a sixth year, and the two are the same rows with different
 * labels: same `gradeYear`, same programme, same MASSAR codes.
 *
 * Only the primary cycle has the choice. Nobody renames the collège or the
 * baccalauréat, so this deliberately does not generalise to the other cycles.
 *
 * Not a column anywhere. Once the wizard has written the `Level` rows the
 * school simply *has* levels called CE2, and renaming one afterwards is the
 * ordinary configuration screen's job — a stored preference would be a second
 * answer to what the level is called.
 */
export const LEVEL_NOMENCLATURES = ["MOROCCAN", "FRENCH"] as const;
export type LevelNomenclature = (typeof LEVEL_NOMENCLATURES)[number];

/**
 * Cycles that stream into filières. Only the qualifying cycle does, which is why
 * every `trackId` in the schema is nullable.
 */
export function cycleHasTracks(cycle: EducationCycle): boolean {
  return cycle === "SECONDARY_QUALIFYING";
}

/*
  The mark scale used to be declared here as MARK_SCALE_MAX and
  MARK_PASS_THRESHOLD, on the reasoning that 20 and 10 are a property of the
  Moroccan curriculum rather than of any one screen, and that the grading module
  would want the same constants.

  The grading module arrived and wanted something else. A school sets its own
  scale and its own pass ratio — `SchoolSettings.gradingMaxScore` and
  `passMarkBps` — and every reader goes through `context.settings`, which
  defaults to exactly 20 and 10. So the pair here was not merely unused: it
  asserted as fixed the two numbers the app had made configurable, and the next
  person to reach for it would have written a screen that disagreed with the
  school's own settings.

  Deleted rather than re-pointed: `lib/school-settings.ts` is where they live,
  `passMarkOf` is how the threshold is worked out, and there is nothing left for
  this file to say about it.
*/

/**
 * Coefficients are small integers in practice; this bounds data entry.
 *
 * Read by the `programme` resource in modules/configuration/resources.ts, which
 * is the only screen that writes one — the bounds were spelled as literals
 * there and as constants here, which is two answers to one question.
 */
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

/**
 * A class's programme: one row per subject, with the track's own row winning.
 *
 * The unique index is on (level, subject, scopeKey), so a level may legitimately
 * declare a subject twice — once for every track, once for one of them. That is
 * the point: Maths is 4 across 2BAC and 7 in Sciences Maths. Resolved as a bare
 * union, both rows survive, and everything downstream then has to guess: the
 * generator's picker offered the subject twice, and a pupil's overall average
 * took whichever coefficient the database happened to return last.
 *
 * So the union is settled here, once, in the only way that means anything: the
 * more specific declaration overrides the general one for the track it names.
 * Rows for another track are not this class's programme at all.
 *
 * Order is preserved — every caller reads the programme in `position` order.
 */
export function resolveProgrammeRows<
  T extends { subjectId: string; trackId: string | null },
>(rows: readonly T[], trackId: string | null): T[] {
  const chosen = new Map<string, T>();
  for (const row of rows) {
    if (row.trackId !== null && row.trackId !== trackId) continue;
    const held = chosen.get(row.subjectId);
    // A row already held for this track is never displaced by the general one.
    if (held && held.trackId !== null) continue;
    chosen.set(row.subjectId, row);
  }
  return rows.filter((row) => chosen.get(row.subjectId) === row);
}
