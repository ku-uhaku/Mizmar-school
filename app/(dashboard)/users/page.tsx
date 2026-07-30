import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { UsersManager } from "@/modules/users/components/users-manager";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listUsers } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.USER_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped inside listUsers: org-wide reach sees everyone, a school-scoped
  // admin only people holding a membership in one of their schools.
  const users = await listUsers(context);

  return (
    <>
      <PageHeader title={t.user.title} description={t.user.subtitle} />

      <UsersManager
        permissions={{
          canCreate: context.can(PERMISSIONS.USER_CREATE),
          canUpdate: context.can(PERMISSIONS.USER_UPDATE),
          canDelete: context.can(PERMISSIONS.USER_DELETE),
        }}
        users={users}
      />
    </>
  );
}
