import type { AppreciationBand } from "./types";

/**
 * Which rung of the school's scale a mark falls on.
 *
 * Hand-mirrored from `appreciationFor` in modules/assessments/enums.ts, for the
 * same reason the DTO types beside it are: importing the module would drag
 * `server-only` and Prisma into a phone bundle. Keep the two in step — the
 * suggestion a teacher sees on the phone and the one they see in the browser
 * have to be the same word.
 *
 * A band holds only its floor; its ceiling is the next rung up, so this is "the
 * highest rung the mark clears". The share is of the paper's own `maxScore`,
 * never of 20 — an oral out of 10 must land on the same rung as the same
 * performance on a paper out of 20.
 *
 * Null for an unmarked pupil, for an absence, and for a scale that does not
 * reach the mark: in each case there is no remark to suggest, and suggesting
 * the bottom rung would be a statement the school never made.
 */
export function appreciationFor(
  score: number | null,
  maxScore: number,
  bands: readonly AppreciationBand[],
): AppreciationBand | null {
  if (score === null || !Number.isFinite(score) || maxScore <= 0) return null;

  const bps = (score / maxScore) * 10_000;

  let best: AppreciationBand | null = null;
  for (const band of bands) {
    if (band.minPercentBps > bps) continue;
    if (best === null || band.minPercentBps > best.minPercentBps) best = band;
  }
  return best;
}
