import type { AuthContext } from "@/lib/dal";
import { EMPLOYED_STATUSES, TEACHING_JOB_ROLES } from "@/modules/hr/enums";

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

/**
 * The `where` for "somebody this school may be given work": every teacher
 * picker, and every write that re-derives a teacher id from a request.
 *
 * ── Why it is not the membership alone ──────────────────────────────────────
 * A `Membership` grants *permissions*, and plenty of people a school puts in
 * front of a class hold none. Hiring a teacher and opening their login without
 * picking a role writes no membership at all — deliberately, see the note in
 * `createLoginAccount` — so a membership test answered "this school has no
 * teachers" about seven teachers with a `Staff` row in the school, an active
 * account, and a matricule. That is not a display quirk: they could not be put
 * on a class, a timetable or a paper.
 *
 * So the test is the union of the two ways somebody belongs to a school, which
 * is the same split the rest of the app already makes — the employment record
 * says they work here, the membership says what they may do once signed in:
 *
 *   * they hold a membership in it (staff with permissions), **or**
 *   * their employment record is in it (`Staff.schoolId`).
 *
 * Deactivated accounts are excluded here rather than by each caller: a login
 * that has been switched off must never be offered as a choice, and leaving that
 * to eleven call sites is how one of them forgets.
 *
 * The organisation is *not* baked in — a caller that has an `AuthContext` should
 * spread this alongside `organizationId: context.organization.id`, and the two
 * together are what confine the read to one tenant.
 *
 * Takes a bare id rather than the context, because the stricter callers do not
 * want the context's school: a teaching assignment is checked against *the
 * class's* own school, re-derived from the session a line earlier. Pass
 * `currentSchoolId(context)` when the context's school is what you mean.
 */
export function staffOfSchool(schoolId: string): {
  isActive: true;
  OR: [
    { memberships: { some: { schoolId: string } } },
    { staffRecord: { schoolId: string } },
  ];
} {
  return {
    isActive: true,
    OR: [
      { memberships: { some: { schoolId } } },
      { staffRecord: { schoolId } },
    ],
  };
}

/**
 * The `where` for "somebody this school may put in front of a class": every
 * teacher picker, and every write that re-derives a teacher id from a request.
 *
 * ── Why it is narrower than `staffOfSchool` ─────────────────────────────────
 * `staffOfSchool` answers "does this person work here", and that is the right
 * test for a till's holder or a cashier. It is the wrong one for a teacher: it
 * admits the whole payroll, so the school's manager, the secretary and the
 * driver were all offered on a class, on a timetable slot and on the
 * availability grid. A surveillant général is the one that actually got picked,
 * because the payroll files them under the teaching department — see
 * `TEACHING_JOB_ROLES`, which is why "who may teach" is its own list.
 *
 * ── Why the membership branch is gone ───────────────────────────────────────
 * Deliberately, and it is the whole point. `jobRole` lives on the employment
 * record, so somebody with a membership and no `Staff` row cannot be said to
 * teach anything — that describes an administrator's login, not a teacher. A
 * teacher hired without a role still qualifies, which is the case
 * `staffOfSchool` exists for: they have the `Staff` row, and it says TEACHER.
 *
 * TERMINATED is excluded and the other three employment statuses are not. Only
 * "has left" means somebody may not be given next week's lessons; a teacher on
 * leave or suspended is still on the books, still on the timetable, and whether
 * they take their classes is the school's business rather than a filter's.
 *
 * Takes a bare id for the same reason `staffOfSchool` does: the stricter callers
 * check against *the class's* own school, re-derived from the session, and not
 * against whatever the context happens to have selected.
 */
export function teacherOfSchool(schoolId: string): {
  isActive: true;
  staffRecord: {
    schoolId: string;
    jobRole: { in: string[] };
    status: { in: string[] };
  };
} {
  return {
    isActive: true,
    staffRecord: {
      schoolId,
      jobRole: { in: [...TEACHING_JOB_ROLES] },
      status: { in: [...EMPLOYED_STATUSES] },
    },
  };
}
