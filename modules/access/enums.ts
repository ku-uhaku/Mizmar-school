/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/access/role.prisma`. Labels live in `i18n/*.ts`
 * under `role.scopes`.
 */

/**
 * Where a role can be assigned. ORG roles go on `User.orgRoleId` and apply in
 * every school; SCHOOL roles go on `Membership.roleId` and apply only where
 * granted.
 */
export const ROLE_SCOPES = ["ORG", "SCHOOL"] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];
