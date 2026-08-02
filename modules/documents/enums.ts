/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/documents/*.prisma`. Labels live in `i18n/*.ts`
 * under `documentOptions`.
 *
 * Pure data: no server imports, no React. The dossier panel is a client
 * component and derives its own counts from these helpers, so they must cross
 * the boundary.
 */

/**
 * What has become of one pièce for one pupil.
 *
 *   MISSING   not handed in. The state of every pièce nobody has touched, and
 *             the only one that is *derived* rather than stored — a pupil with
 *             no rows at all is missing everything.
 *   RECEIVED  the school has the paper.
 *   REJECTED  handed in but not accepted — illegible, expired, the wrong
 *             document. Distinct from MISSING because the family has already
 *             been once and the conversation is different.
 *   EXEMPTED  waived. A child born abroad may have no acte de naissance in the
 *             Moroccan form, and a dossier that can never be completed would
 *             hold the parcours up for ever.
 *
 * REJECTED and EXEMPTED both carry a reason in `StudentDocument.notes` — they
 * are decisions, and a decision nobody can read is one that gets re-litigated
 * at every rentrée.
 */
export const DOCUMENT_STATUSES = [
  "MISSING",
  "RECEIVED",
  "REJECTED",
  "EXEMPTED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * Whether a pièce counts as settled.
 *
 * EXEMPTED settles it as surely as RECEIVED: the school has decided it will not
 * ask again, and a waiver that still read as outstanding would be no waiver.
 */
export function isSettled(status: string): boolean {
  return status === "RECEIVED" || status === "EXEMPTED";
}

/**
 * Whether the status is one a date of receipt belongs to.
 *
 * The invariant `recordDocument` enforces: a pièce that was never accepted has
 * no date it was accepted on, and leaving a stale one behind is how a dossier
 * comes to claim it received a document it refused.
 */
export function acceptsReceivedOn(status: string): boolean {
  return status === "RECEIVED";
}

/** How a dossier stands, in the two numbers a guichet actually asks for. */
export type DossierStanding = {
  /** Required pièces the school is still waiting for. */
  missingRequired: number;
  /** Required pièces settled. */
  settledRequired: number;
  /** Required pièces in all — the denominator. */
  totalRequired: number;
  /** Optional pièces still outstanding. Reported, never blocking. */
  missingOptional: number;
  /** True when nothing required is outstanding. */
  isComplete: boolean;
};

/**
 * Reads a dossier's standing off the pièces themselves.
 *
 * Derived rather than stored, for the same reason the pupil's parcours is: a
 * completeness flag that can disagree with the rows underneath it is worse than
 * no flag at all. A school that adds a pièce to its catalogue on Monday has
 * every dossier read as incomplete on Tuesday, which is correct and is exactly
 * what a stored column would have got wrong.
 */
export function dossierStandingOf(
  pieces: readonly { isRequired: boolean; status: string }[],
): DossierStanding {
  const required = pieces.filter((piece) => piece.isRequired);
  const settledRequired = required.filter((piece) => isSettled(piece.status)).length;

  return {
    missingRequired: required.length - settledRequired,
    settledRequired,
    totalRequired: required.length,
    missingOptional: pieces.filter(
      (piece) => !piece.isRequired && !isSettled(piece.status),
    ).length,
    // A school that has declared no required pièce has a complete dossier by
    // definition, rather than an empty checklist that never goes green.
    isComplete: settledRequired === required.length,
  };
}
