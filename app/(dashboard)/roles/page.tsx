import type { Metadata } from "next";

import { RolesManager } from "@/components/roles/roles-manager";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Rôles et permissions" };

export default async function RolesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // Roles are organisation-level, so this is an org-wide permission.
  if (!context.canOrg(PERMISSIONS.ROLE_VIEW)) {
    return <ForbiddenState />;
  }

  const roles = await db.role.findMany({
    where: { organizationId: context.organization.id },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
    include: {
      permissions: { include: { permission: { select: { code: true } } } },
      _count: { select: { memberships: true, orgUsers: true } },
    },
  });

  return (
    <>
      <PageHeader title={t.role.title} description={t.role.subtitle} />

      <RolesManager
        permissions={{
          canCreate: context.canOrg(PERMISSIONS.ROLE_CREATE),
          canUpdate: context.canOrg(PERMISSIONS.ROLE_UPDATE),
          canDelete: context.canOrg(PERMISSIONS.ROLE_DELETE),
        }}
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          scope: role.scope,
          isSystem: role.isSystem,
          permissions: role.permissions.map((entry) => entry.permission.code),
          assignedCount: role._count.memberships + role._count.orgUsers,
        }))}
      />
    </>
  );
}
