/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/bulletins/*.prisma`. Labels live in
 * `modules/bulletins/i18n/*.ts` under `bulletinOptions`.
 *
 * Pure data: the council table is a client component and shows the mention its
 * own thresholds suggest before anything is saved, so the arithmetic here has
 * to cross the boundary.
 */

/**
 * Where a bulletin is.
 *
 *   DRAFT      computed; the conseil de classe's working copy. Recomputing
 *              refreshes every figure on it. Families see nothing.
 *   PUBLISHED  issued. Frozen — a recomputation refuses it outright — and this
 *              is the only state a family may read.
 *
 * Two, and deliberately not the assessments module's five. A contrôle has a
 * workflow because several people take turns on it; a bulletin is computed by
 * one office and released by one office, and the only question that matters
 * about it is whether it has left the building.
 */
export const BULLETIN_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type BulletinStatus = (typeof BULLETIN_STATUSES)[number];

/** Statuses a family may read. Named rather than compared inline, as in assessments. */
export const FAMILY_VISIBLE_STATUSES: readonly BulletinStatus[] = ["PUBLISHED"];

/**
 * Whether the figures on this bulletin may still be recomputed.
 *
 * The freeze is the whole point of the table: once a document has been handed
 * out, a mark corrected in April must not rewrite it. Withdrawing is how a
 * school says it means to reissue.
 */
export function acceptsRecompute(status: string): boolean {
  return status === "DRAFT";
}

export function isPublished(status: string): boolean {
  return status === "PUBLISHED";
}

/**
 * The mentions a Moroccan bulletin carries, best first.
 *
 *   FELICITATIONS    التهنئة        — outstanding work
 *   ENCOURAGEMENTS   التشجيع        — good work, or clear progress
 *   TABLEAU_HONNEUR  لوحة الشرف     — a solid pass worth naming
 *   AVERTISSEMENT    إنذار          — work below what the council will accept
 *
 * A mention is *awarded*, not calculated — see the note on Bulletin.mention.
 * `suggestMention` proposes one and the council decides.
 */
export const MENTIONS = [
  "FELICITATIONS",
  "ENCOURAGEMENTS",
  "TABLEAU_HONNEUR",
  "AVERTISSEMENT",
] as const;
export type Mention = (typeof MENTIONS)[number];

/**
 * Where each mention starts, as a ratio of the scale in basis points.
 *
 * In bps rather than as marks out of 20 for the same reason `passMarkBps` is: a
 * school that marks out of 10 or out of 100 gets the same thresholds without a
 * second table of numbers. 8000 bps is 16/20, 7000 is 14/20, 6000 is 12/20.
 *
 * AVERTISSEMENT is deliberately absent: it is a judgement about work the council
 * has watched all term, not a band an average falls into, and proposing it
 * automatically would put a warning on a bulletin because a pupil was ill for
 * two papers.
 */
export const MENTION_THRESHOLD_BPS: Partial<Record<Mention, number>> = {
  FELICITATIONS: 8000,
  ENCOURAGEMENTS: 7000,
  TABLEAU_HONNEUR: 6000,
};

/**
 * The mention an average would ordinarily earn, or null when it earns none.
 *
 * Only ever a default offered to the council. Nothing writes it on its own.
 */
export function suggestMention(
  average: number | null,
  outOf: number,
): Mention | null {
  if (average === null || outOf <= 0) return null;
  const bps = (average / outOf) * 10_000;

  for (const mention of MENTIONS) {
    const threshold = MENTION_THRESHOLD_BPS[mention];
    if (threshold !== undefined && bps >= threshold) return mention;
  }
  return null;
}

/**
 * What the conseil de fin d'année decided about the pupil's year.
 *
 *   ADMITTED              ينتقل — passes to the next level
 *   ADMITTED_CONDITIONAL  ينتقل بشروط — passes, with work set over the summer
 *   REPEATING             يكرر — repeats the level
 *   REORIENTED            يوجه — moves to another filière or another school
 *
 * Set on the last term's bulletin and left null on the others; null elsewhere
 * means "not a question this bulletin answers" rather than "undecided". See the
 * note on Bulletin.decision.
 */
export const COUNCIL_DECISIONS = [
  "ADMITTED",
  "ADMITTED_CONDITIONAL",
  "REPEATING",
  "REORIENTED",
] as const;
export type CouncilDecision = (typeof COUNCIL_DECISIONS)[number];

/** Longest an appreciation may run — one or two lines on the printed page. */
export const APPRECIATION_MAX_LENGTH = 500;

/** The council's own note has more room: it is the bulletin's closing paragraph. */
export const COMMENT_MAX_LENGTH = 1000;

// ── Arithmetic ───────────────────────────────────────────────────────────────

/** Two decimals, like every other mark in the app. See `roundScore`. */
export function roundAverage(value: number): number {
  return Math.round(value * 100) / 100;
}

export type WeightedEntry = { value: number; weight: number };

/**
 * Coefficient-weighted mean, or null when nothing carries any weight.
 *
 * The same function `loadPupilMarks` uses on the fly. It lives here rather than
 * there because the bulletin has to reach it from the client too — the council
 * table previews what a changed coefficient would do — and because a document
 * and a screen disagreeing about how an average is worked out is precisely what
 * freezing the document was meant to prevent.
 */
export function weightedAverage(
  entries: readonly WeightedEntry[],
): number | null {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return null;

  const total = entries.reduce(
    (sum, entry) => sum + entry.value * entry.weight,
    0,
  );
  return roundAverage(total / totalWeight);
}

/**
 * Ranks values best-first, ties sharing a rank and the next rank skipping.
 *
 * ── Why ties share, and why the next one skips ──────────────────────────────
 * Two pupils on 15.4 are second equal, and the pupil on 15.1 is fourth. That is
 * the convention every Moroccan bulletin uses ("compétition" ranking), and it
 * is the one a parent will check by counting names down the class list. Dense
 * ranking — where the third pupil is third — reads as though somebody has been
 * left out.
 *
 * Entries with no value are not ranked at all: a pupil who sat nothing is not
 * last, they are unranked, and putting them at the bottom of the class would be
 * an assertion the school has no evidence for.
 */
export function rankValues(
  values: readonly (number | null)[],
): (number | null)[] {
  const ordered = values
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } =>
      entry.value !== null,
    )
    .sort((a, b) => b.value - a.value);

  const ranks: (number | null)[] = values.map(() => null);

  let lastValue: number | null = null;
  let lastRank = 0;

  ordered.forEach((entry, position) => {
    // Compared on the rounded figure: 15.404 and 15.396 both print as 15.4, and
    // a bulletin that shows two identical averages at different ranks is one
    // the office cannot defend to a parent holding both.
    const rounded = roundAverage(entry.value);
    if (lastValue === null || rounded !== lastValue) {
      lastRank = position + 1;
      lastValue = rounded;
    }
    ranks[entry.index] = lastRank;
  });

  return ranks;
}

export type Spread = {
  average: number | null;
  lowest: number | null;
  highest: number | null;
};

/**
 * What the class did — the three figures printed beside a pupil's own mark.
 *
 * An unweighted mean of the pupils' averages, not a weighted mean of every mark
 * in the class: the question is "how did this cohort do", and a pupil is one
 * pupil however many papers they sat.
 */
export function spreadOf(values: readonly (number | null)[]): Spread {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return { average: null, lowest: null, highest: null };
  }

  return {
    average: roundAverage(
      present.reduce((sum, value) => sum + value, 0) / present.length,
    ),
    lowest: roundAverage(Math.min(...present)),
    highest: roundAverage(Math.max(...present)),
  };
}

/**
 * The year's mean of a pupil's issued bulletins, on the school's scale.
 *
 * Frozen figures averaged rather than every mark of the year re-pooled: the
 * year average a Moroccan school reports is the mean of its terms, and a pupil
 * who sat twice as many papers in the second semester must not have it count
 * twice as much. Terms are equal because a term is equal.
 */
export function yearAverageOf(
  bulletins: readonly { generalAverage: number | null }[],
): number | null {
  const present = bulletins
    .map((bulletin) => bulletin.generalAverage)
    .filter((average): average is number => average !== null);

  if (present.length === 0) return null;
  return roundAverage(
    present.reduce((sum, average) => sum + average, 0) / present.length,
  );
}
