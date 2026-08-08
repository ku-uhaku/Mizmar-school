"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeOrg } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, listField, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { resolvePermissionIds } from "@/modules/access/queries";
import { roleSchema } from "@/modules/access/validation";

function readRoleForm(formData: FormData) {
  return {
    name: field(formData, "name"),
    description: field(formData, "description"),
    scope: field(formData, "scope"),
    permissions: listField(formData, "permissions"),
  };
}

export async function createRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeOrg(PERMISSIONS.ROLE_CREATE);

    const parsed = roleSchema(t).safeParse(readRoleForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const duplicate = await db.role.findUnique({
      where: {
        organizationId_name: {
          organizationId: context.organization.id,
          name: parsed.data.name,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.role.nameTaken, { name: t.role.nameTaken });
    }

    const permissionIds = await resolvePermissionIds(parsed.data.permissions);

    await db.role.create({
      data: {
        organizationId: context.organization.id,
        name: parsed.data.name,
        description: parsed.data.description,
        scope: parsed.data.scope,
        isSystem: false,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });

    refresh();
    return success(t.role.created);
  });
}

export async function updateRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeOrg(PERMISSIONS.ROLE_UPDATE);
    const roleId = field(formData, "id");

    const existing = await db.role.findFirst({
      where: { id: roleId, organizationId: context.organization.id },
      select: {
        id: true,
        isSystem: true,
        name: true,
        scope: true,
        _count: { select: { memberships: true, orgUsers: true } },
      },
    });
    if (!existing) return failure(t.errors.notFound);

    const parsed = roleSchema(t).safeParse(readRoleForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // System roles keep their identity; only their permission set is editable.
    const name = existing.isSystem ? existing.name : parsed.data.name;
    const scope = existing.isSystem ? existing.scope : parsed.data.scope;

    // Re-scoping an assigned role revokes it, silently. `scope` is not
    // decorative: a membership may only carry a SCHOOL role and `User.orgRoleId`
    // may only carry an ORG one, both enforced in modules/users/actions.ts. So
    // flipping a role that people already hold leaves those rows pointing at a
    // role that no longer qualifies — and because the user form replaces
    // memberships wholesale, the next unrelated save of any of those users drops
    // their membership without saying so. Refused for the same reason, and with
    // the same message, as deleting a role somebody still holds.
    const assigned = existing._count.memberships + existing._count.orgUsers;
    if (!existing.isSystem && scope !== existing.scope && assigned > 0) {
      return failure(interpolate(t.role.inUse, { count: assigned }), {
        scope: interpolate(t.role.inUse, { count: assigned }),
      });
    }

    if (!existing.isSystem) {
      const duplicate = await db.role.findFirst({
        where: {
          organizationId: context.organization.id,
          name,
          NOT: { id: roleId },
        },
        select: { id: true },
      });
      if (duplicate) {
        return failure(t.role.nameTaken, { name: t.role.nameTaken });
      }
    }

    const permissionIds = await resolvePermissionIds(parsed.data.permissions);

    // Replace the permission set wholesale — the form submits the full desired
    // state, so diffing would only add a chance to get it wrong.
    await db.$transaction([
      db.role.update({
        where: { id: roleId },
        data: { name, scope, description: parsed.data.description },
      }),
      db.rolePermission.deleteMany({ where: { roleId } }),
      db.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);

    refresh();
    return success(t.role.updated);
  });
}

export async function deleteRoleAction(roleId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeOrg(PERMISSIONS.ROLE_DELETE);

    const role = await db.role.findFirst({
      where: { id: roleId, organizationId: context.organization.id },
      select: {
        id: true,
        isSystem: true,
        _count: { select: { memberships: true, orgUsers: true } },
      },
    });
    if (!role) return failure(t.errors.notFound);

    if (role.isSystem) return failure(t.role.cannotDeleteSystem);

    // Membership.roleId is onDelete: Restrict, so refuse with a useful message
    // rather than letting the database raise a constraint error.
    const assigned = role._count.memberships + role._count.orgUsers;
    if (assigned > 0) {
      return failure(interpolate(t.role.inUse, { count: assigned }));
    }

    await db.role.delete({ where: { id: roleId } });

    refresh();
    return success(t.role.deleted);
  });
}
