/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/classes/*.prisma`. Labels belong in
 * `modules/classes/i18n/*.ts` once this module grows a UI.
 */

import { nullableKey } from "@/lib/db-keys";

/**
 * Why a class is split into groups.
 *
 *   LAB        travaux pratiques — the class does not fit in a lab
 *   LANGUAGE   split for a foreign language, often by level
 *   SPORTS     EPS, commonly split by sex or by activity
 *   SUPPORT    soutien scolaire / remedial hours
 *   OTHER      any other arrangement
 */
export const GROUP_PURPOSES = [
  "LAB",
  "LANGUAGE",
  "SPORTS",
  "SUPPORT",
  "OTHER",
] as const;
export type GroupPurpose = (typeof GROUP_PURPOSES)[number];

/*
  `centimesToDirhams` deliberately does not live here.

  It used to, alongside the note that only the *reading* direction belonged in
  this module and the caisse owned the writing one. That split was the problem:
  one rounding rule with two homes, and the pairing that has to agree —
  `centimesToDirhams` and `dirhamsToCentimes` — living in different files. Both
  are in `modules/treasury/enums.ts` now, because the caisse is where money is
  taken in, and it is pure data so a client component may reach for it.
*/

/**
 * Builds `LevelOffering.scopeKey`, which is what stops a track-less level being
 * opened twice in one year — see lib/db-keys.ts for why the nullable `trackId`
 * cannot be indexed directly.
 */
export function offeringScopeKey(trackId: string | null | undefined): string {
  return nullableKey(trackId);
}

/**
 * Builds `TeachingAssignment.scopeKey`, which is what stops a duplicate
 * whole-class assignment of the same teacher to the same subject.
 */
export function assignmentScopeKey(
  classGroupId: string | null | undefined,
): string {
  return nullableKey(classGroupId);
}
