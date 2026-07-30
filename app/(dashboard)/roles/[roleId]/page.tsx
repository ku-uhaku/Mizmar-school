import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoleForm } from "@/components/roles/role-form";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Rôle" };

export default async function EditRolePage(props: PageProps<"/roles/[roleId]">) {
  const { roleId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.canOrg(PERMISSIONS.ROLE_VIEW)) {
    return <ForbiddenState />;
  }

  const role = await db.role.findFirst({
    where: { id: roleId, organizationId: context.organization.id },
    include: {
      permissions: { include: { permission: { select: { code: true } } } },
      _count: { select: { memberships: true, orgUsers: true } },
    },
  });
  if (!role) notFound();

  // Viewers without edit rights still get the page, in read-only mode.
  const readOnly = !context.canOrg(PERMISSIONS.ROLE_UPDATE);

  return (
    <>
      <PageHeader
        title={role.name}
        description={readOnly ? t.role.permissions : t.role.editRole}
        backHref="/roles"
        backLabel={t.nav.roles}
      />
      <RoleForm
        readOnly={readOnly}
        role={{
          id: role.id,
          name: role.name,
          description: role.description,
          scope: role.scope,
          isSystem: role.isSystem,
          permissions: role.permissions.map((entry) => entry.permission.code),
          assignedCount: role._count.memberships + role._count.orgUsers,
        }}
      />
    </>
  );
}
