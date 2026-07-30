import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { UserForm } from "@/modules/users/components/user-form";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loadUserFormChoices } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Nouvel utilisateur" };

export default async function NewUserPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.USER_CREATE)) {
    return <ForbiddenState />;
  }

  const { schools, orgRoles, schoolRoles } = await loadUserFormChoices(context);

  return (
    <>
      <PageHeader
        title={t.user.newUser}
        description={t.user.subtitle}
        backHref="/users"
        backLabel={t.nav.users}
      />
      <UserForm
        schools={schools}
        orgRoles={orgRoles}
        schoolRoles={schoolRoles}
        canManageSuperAdmin={context.isSuperAdmin}
        canAssignOrgRole={context.canOrg(PERMISSIONS.USER_ASSIGN_ROLE)}
      />
    </>
  );
}
