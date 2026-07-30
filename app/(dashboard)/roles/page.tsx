import type { Metadata } from "next";

import { RolesManager } from "@/modules/access/components/roles-manager";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listRoles } from "@/modules/access/queries";

export const metadata: Metadata = { title: "Rôles et permissions" };

export default async function RolesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  // Roles are organisation-level, so this is an org-wide permission.
  if (!context.canOrg(PERMISSIONS.ROLE_VIEW)) {
    return <ForbiddenState />;
  }

  const roles = await listRoles(context);

  return (
    <>
      <PageHeader title={t.role.title} description={t.role.subtitle} />

      <RolesManager
        permissions={{
          canCreate: context.canOrg(PERMISSIONS.ROLE_CREATE),
          canUpdate: context.canOrg(PERMISSIONS.ROLE_UPDATE),
          canDelete: context.canOrg(PERMISSIONS.ROLE_DELETE),
        }}
        roles={roles}
      />
    </>
  );
}
