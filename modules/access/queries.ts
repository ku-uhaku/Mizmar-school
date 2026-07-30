import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { isPermissionCode } from "@/lib/permissions";

/**
 * Reads for the access module. See modules/schools/queries.ts for the contract:
 * each function scopes its own `where` to what the actor may see.
 *
 * Roles are organisation-level, so everything here is scoped by
 * `organizationId` and the callers check the org-wide ROLE_* permissions.
 */

/** The shape the roles table and the role form both render. */
export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  /** Permission codes currently granted. */
  permissions: string[];
  /** How many users hold this role, org-wide plus per-school. */
  assignedCount: number;
};

const WITH_PERMISSIONS_AND_COUNTS = {
  permissions: { include: { permission: { select: { code: true } } } },
  _count: { select: { memberships: true, orgUsers: true } },
} as const;

type RoleWithRelations = Awaited<
  ReturnType<
    typeof db.role.findFirstOrThrow<{
      include: typeof WITH_PERMISSIONS_AND_COUNTS;
    }>
  >
>;

function toRow(role: RoleWithRelations): RoleRow {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    scope: role.scope,
    isSystem: role.isSystem,
    permissions: role.permissions.map((entry) => entry.permission.code),
    assignedCount: role._count.memberships + role._count.orgUsers,
  };
}

export async function listRoles(context: AuthContext): Promise<RoleRow[]> {
  const roles = await db.role.findMany({
    where: { organizationId: context.organization.id },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
    include: WITH_PERMISSIONS_AND_COUNTS,
  });
  return roles.map(toRow);
}

/** Null when the role does not exist in this organisation. */
export async function findRole(
  context: AuthContext,
  roleId: string,
): Promise<RoleRow | null> {
  const role = await db.role.findFirst({
    where: { id: roleId, organizationId: context.organization.id },
    include: WITH_PERMISSIONS_AND_COUNTS,
  });
  return role ? toRow(role) : null;
}

/** Live count for the dashboard. */
export async function countRoles(context: AuthContext): Promise<number> {
  return db.role.count({
    where: { organizationId: context.organization.id },
  });
}

/**
 * Maps permission codes to ids, dropping anything outside the catalogue, so a
 * role can never hold a permission the code does not check.
 *
 * Lives here rather than in `actions.ts` because both the create and the update
 * action need it, and a future import/scripted role setup would too.
 */
export async function resolvePermissionIds(
  codes: string[],
): Promise<string[]> {
  const allowed = codes.filter(isPermissionCode);
  if (allowed.length === 0) return [];

  const rows = await db.permission.findMany({
    where: { code: { in: allowed } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
