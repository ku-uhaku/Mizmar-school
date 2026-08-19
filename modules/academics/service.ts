import "server-only";

import { db } from "@/lib/db";

/**
 * Writes for the cursus.
 *
 * The module owns `LevelSubject`, so the copy that starts a year's programme
 * from another year's lives here rather than in whatever screen happens to
 * offer it — both callers (the "start from a previous year" dialog and the
 * button on the programme screen) run the same function.
 */

/**
 * Copies one year's programme into another.
 *
 * Idempotent, like every other year copy: an upsert on the unique
 * (year, level, subject, scope) leaves a row that already exists exactly as it
 * is. A school that has already corrected a coefficient in the new year can
 * therefore press the button again without losing the correction — the copy
 * fills in what is missing and touches nothing else.
 *
 * The niveaux and the matières themselves are the *school's* and are not
 * copied: both years point at the same `Level` and `Subject` rows, and only the
 * weighting and the volume horaire are the year's.
 *
 * Both years must already have been checked to belong to the same school — the
 * caller does that, because it is the caller that took an id from a request.
 */
export async function copyProgramme(
  sourceYearId: string,
  targetYearId: string,
): Promise<number> {
  const rows = await db.levelSubject.findMany({
    where: { schoolYearId: sourceYearId },
    orderBy: [{ position: "asc" }],
  });

  // A before/after delta rather than a tally of the upserts, for the reason
  // `copyFeeConfiguration` gives: `update: {}` leaves `updatedAt` alone, so a
  // row that was already there cannot be told from a fresh one afterwards.
  const before = await db.levelSubject.count({
    where: { schoolYearId: targetYearId },
  });

  for (const row of rows) {
    await db.levelSubject.upsert({
      where: {
        schoolYearId_levelId_subjectId_scopeKey: {
          schoolYearId: targetYearId,
          levelId: row.levelId,
          subjectId: row.subjectId,
          scopeKey: row.scopeKey,
        },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        levelId: row.levelId,
        trackId: row.trackId,
        subjectId: row.subjectId,
        coefficient: row.coefficient,
        weeklyMinutes: row.weeklyMinutes,
        isGraded: row.isGraded,
        isEliminatory: row.isEliminatory,
        position: row.position,
        scopeKey: row.scopeKey,
      },
      select: { id: true },
    });
  }

  const after = await db.levelSubject.count({
    where: { schoolYearId: targetYearId },
  });

  return after - before;
}
