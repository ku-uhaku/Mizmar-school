import type { Metadata } from "next";

import { RoleForm } from "@/modules/access/components/role-form";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nouveau rôle" };

export default async function NewRolePage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.canOrg(PERMISSIONS.ROLE_CREATE)) {
    return <ForbiddenState />;
  }

  return (
    <>
      <PageHeader
        title={t.role.newRole}
        description={t.role.subtitle}
        backHref="/roles"
        backLabel={t.nav.roles}
      />
      <RoleForm />
    </>
  );
}
