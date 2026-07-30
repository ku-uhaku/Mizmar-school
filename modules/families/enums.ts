/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/families/*.prisma`. Labels live in `i18n/*.ts` under
 * `family.situations` and `family.relationships`.
 */

/**
 * Who an adult is to the children on the dossier.
 *
 * Three values and no more, because they are the three the school acts on: it
 * calls the mother, it invoices the father, and it lets the tuteur through the
 * gate. Anything finer (grandmother, uncle, elder brother) is a GUARDIAN with a
 * name — the relationship the school needs to *record* is not the one a family
 * would use to describe itself.
 */
export const GUARDIAN_RELATIONSHIPS = ["FATHER", "MOTHER", "GUARDIAN"] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

/**
 * Relationships a family may hold at most one of. A tuteur is deliberately not
 * here: an uncle and a grandmother may both be on the same file.
 *
 * Enforced in `modules/families/service.ts` rather than by a unique index,
 * because SQLite cannot express "unique only for two of the three values".
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

/** Dossier numbers look like `F-2025-0142`. */
export const FAMILY_CODE_PREFIX = "F";

/**
 * Builds the next dossier number for a school and year.
 *
 * Sequence-per-year rather than a global counter: the year in the code is what
 * makes a dossier number readable on paper, and a secretary asked for "the 2025
 * files" means the ones that start with 2025.
 */
export function nextFamilyCode(year: number, sequence: number): string {
  return `${FAMILY_CODE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}
