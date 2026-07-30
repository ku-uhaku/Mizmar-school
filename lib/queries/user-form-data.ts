import "server-only";

import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/dal";

/**
 * The choices the user form needs. Shared by the create and edit routes so the
 * two can never drift apart in what they offer.
 */
export async function loadUserFormChoices(context: AuthContext) {
  const [orgRoles, schoolRoles] = await Promise.all([
    db.role.findMany({
      where: { organizationId: context.organization.id, scope: "ORG" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.role.findMany({
      where: { organizationId: context.organization.id, scope: "SCHOOL" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    orgRoles,
    schoolRoles,
    // Only schools this actor can reach — the action filters memberships the
    // same way, so the form can never offer a school it would then discard.
    schools: context.schools.map((school) => ({
      id: school.id,
      name: school.name,
      code: school.code,
    })),
  };
}
