import { MOBILE_ONLY_ROLES } from "@/modules/access/system-roles";

/**
 * Who may open the web dashboard at all.
 *
 * The two surfaces are not the same product. The web app is the school's
 * back office — enrolments, the caisse, the RH, the bulletins — and it assumes
 * somebody sitting at a desk answering for what they change. The phone is
 * where a teacher's own work lives: their classes, their registers, their
 * carnet, their marks. A teacher was never meant to be at the desk, so their
 * account is refused at the door rather than let in to a shell of screens it
 * may not open.
 *
 * This is *not* a permission, deliberately. The espace enseignant on the phone
 * runs on exactly the codes the Enseignant role already holds
 * (`CLASSROOM_WORKSPACE`, `ASSESSMENT_GRADE`, …); taking those away to keep
 * them out of the web app would take their own app away with them. What is
 * refused here is the surface, not the authority — see `MOBILE_ONLY_ROLES` in
 * modules/access/system-roles.ts for which roles carry it.
 *
 * Pure data on purpose: `lib/dal.ts` decides it from the user it has already
 * loaded, and the sign-in paths decide it from their own read, so neither has
 * to duplicate the rule.
 */
export type WebAccessSubject = {
  isSuperAdmin: boolean;
  orgRoleId: string | null;
  memberships: { role: { name: string } }[];
};

export function hasWebAccess(user: WebAccessSubject): boolean {
  // Org-wide reach is never teaching-shaped: an administrator or a responsable
  // pédagogique works from the back office by definition.
  if (user.isSuperAdmin || user.orgRoleId !== null) return true;

  /*
    An account with no membership at all is left alone.

    That is a guardian's portal login, and it already reaches nothing on the web
    — no membership means no school and no permission, so the dashboard it lands
    on is empty. Refusing it here would be a second, unrelated decision hiding
    inside this one; the rule below is about roles that *do* grant real work,
    just not at this desk.
  */
  if (user.memberships.length === 0) return true;

  // One non-teaching membership is enough: somebody who teaches in one school
  // and keeps the secretariat in another still has a desk to sit at.
  return user.memberships.some(
    (membership) => !MOBILE_ONLY_ROLES.includes(membership.role.name),
  );
}
