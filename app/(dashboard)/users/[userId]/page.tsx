import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { RecordHistoryPanel } from "@/modules/audit/components/record-history-panel";
import { UserForm } from "@/modules/users/components/user-form";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { findUser, loadUserFormChoices } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Modifier l'utilisateur" };

export default async function EditUserPage(props: PageProps<"/users/[userId]">) {
  const { userId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.USER_UPDATE)) {
    return <ForbiddenState />;
  }

  // Mirrors assertCanActOnUser in the action: a school-scoped admin may only
  // reach users inside their schools, and never one who outranks them.
  const user = await findUser(context, userId, PERMISSIONS.USER_UPDATE);
  if (!user) notFound();

  const { schools, orgRoles, schoolRoles, jobFunctions } =
    await loadUserFormChoices(context);

  return (
    <>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`.trim() || user.username}
        description={t.user.editUser}
        backHref="/users"
        backLabel={t.nav.users}
      />
      <UserForm
        schools={schools}
        orgRoles={orgRoles}
        schoolRoles={schoolRoles}
        jobFunctions={jobFunctions}
        canManageSuperAdmin={context.isSuperAdmin}
        canAssignOrgRole={context.canOrg(PERMISSIONS.USER_ASSIGN_ROLE)}
        user={user}
      />

      <RecordHistoryPanel
        context={context}
        entity="User"
        entityId={user.id}
      />
    </>
  );
}
