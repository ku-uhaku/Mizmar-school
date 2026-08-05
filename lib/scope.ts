import type { AuthContext } from "@/lib/dal";

/**
 * The two `where` fragments every module's reads are built on.
 *
 * There were eleven copies of these four lines — one per `queries.ts` — and
 * treasury spelled the sentinel `NO_MATCH` while everybody else spelled it
 * `"__none__"`. Two spellings of "match nothing" is how the two come to
 * disagree about what an unselected school means, so there is one of each here.
 *
 * ── Why a sentinel rather than a guard ───────────────────────────────────────
 * A request can legitimately arrive with no school or no year in context — the
 * first login, or a user whose only membership was just revoked. Returning an
 * id that cannot match is what makes every count come back zero and every list
 * come back empty, which is the honest answer. An `undefined` would drop the
 * clause instead and hand the reader the whole organisation.
 *
 * Pure data: no `server-only`, so a module may reach for it from either side.
 */
const NO_MATCH = "__none__";

/** Confines a read to the school in context. */
export function schoolScope(context: AuthContext): { schoolId: string } {
  return { schoolId: context.currentSchool?.id ?? NO_MATCH };
}

/** Confines a read to the year in context. */
export function yearScope(context: AuthContext): { schoolYearId: string } {
  return { schoolYearId: context.currentSchoolYear?.id ?? NO_MATCH };
}

/** The bare ids, for callers that build the clause themselves. */
export function currentSchoolId(context: AuthContext): string {
  return context.currentSchool?.id ?? NO_MATCH;
}

export function currentSchoolYearId(context: AuthContext): string {
  return context.currentSchoolYear?.id ?? NO_MATCH;
}
