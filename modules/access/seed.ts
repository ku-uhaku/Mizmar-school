import { PERMISSION_GROUPS, type PermissionCode } from "@/lib/permissions";
import { SYSTEM_ROLES } from "@/modules/access/system-roles";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The permission catalogue and the built-in roles.
 *
 * Both are derived from the module registry, so a module that adds permissions
 * gets them upserted here on the next seed without this file changing.
 */

export async function seedPermissions(db: SeedDb) {
  let count = 0;
  for (const { group, codes } of PERMISSION_GROUPS) {
    for (const code of codes) {
      await db.permission.upsert({
        where: { code },
        update: { group },
        create: { code, group },
      });
      count += 1;
    }
  }
  log("permissions", count);
}

export async function seedRoles(db: SeedDb, organizationId: string) {
  const permissions = await db.permission.findMany();
  const idByCode = new Map(permissions.map((p) => [p.code, p.id]));
  const roles: Record<string, string> = {};

  for (const definition of SYSTEM_ROLES) {
    const role = await db.role.upsert({
      where: { organizationId_name: { organizationId, name: definition.name } },
      update: {
        description: definition.description,
        scope: definition.scope,
        isSystem: true,
      },
      create: {
        organizationId,
        name: definition.name,
        description: definition.description,
        scope: definition.scope,
        isSystem: true,
      },
    });

    // Reset to the declared set, so re-running the seed repairs any drift in the
    // built-in roles.
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: definition.permissions
        .map((code: PermissionCode) => idByCode.get(code))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    });

    roles[definition.name] = role.id;
  }

  log("roles", Object.keys(roles).length);
  return roles;
}
