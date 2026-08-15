/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/families/*.prisma`. Labels live in `i18n/*.ts` under
 * `family.situations` and `family.relationships`.
 */

/**
 * Who an adult is to the children on the dossier.
 *
 * ── Why this is no longer three values ──────────────────────────────────────
 * It used to be FATHER, MOTHER and a catch-all GUARDIAN, on the reasoning that
 * the school acts on three things — it calls the mother, invoices the father,
 * and lets the tuteur through the gate — so anything finer was a GUARDIAN with
 * a name beside it.
 *
 * That held for what the school *does* and not for what it has to *read*. A
 * dossier with three GUARDIAN rows tells a secretary at the gate nothing about
 * which of them is the grandmother who collects on Tuesdays; the distinction
 * was there in the family and simply had nowhere to go but a free-text name.
 * The kinship is now recorded, and the *rights* stay exactly where they were —
 * `canCollect`, `isEmergencyContact` and the invoicing contact are their own
 * columns and are still never derived from this one. See the note on
 * `Guardian.canCollect`.
 *
 * GUARDIAN stays, and stays last: it is still the right answer for a tuteur
 * légal who is none of the below, and for anyone a school would rather not
 * classify.
 */
export const GUARDIAN_RELATIONSHIPS = [
  "FATHER",
  "MOTHER",
  "STEPFATHER",
  "STEPMOTHER",
  "GRANDFATHER",
  "GRANDMOTHER",
  "BROTHER",
  "SISTER",
  "UNCLE",
  "AUNT",
  "GUARDIAN",
] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

/**
 * Relationships a family may hold at most one of.
 *
 * Only the two parents, deliberately. Everything else may repeat — a child can
 * have two grandmothers on the file, and an uncle and an aunt besides — and a
 * step-parent is left repeatable too rather than guessed at: a school recording
 * a second remarriage should not be stopped by a rule invented here.
 *
 * Enforced in `modules/families/service.ts` rather than by a unique index,
 * because MySQL cannot express "unique only for two of the values".
 */
export const SINGULAR_RELATIONSHIPS: readonly GuardianRelationship[] = [
  "FATHER",
  "MOTHER",
];

export function isSingularRelationship(
  relationship: string,
): relationship is "FATHER" | "MOTHER" {
  return (SINGULAR_RELATIONSHIPS as readonly string[]).includes(relationship);
}

/**
 * The household's situation, as it bears on the school.
 *
 * Recorded because it decides who receives the paperwork and who may collect a
 * child, not for demographics — which is why the list stops where the school's
 * interest does.
 */
export const FAMILY_SITUATIONS = [
  "MARRIED",
  "DIVORCED",
  "SEPARATED",
  "WIDOWED",
  "OTHER",
] as const;
export type FamilySituation = (typeof FAMILY_SITUATIONS)[number];
