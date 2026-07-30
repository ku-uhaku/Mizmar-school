import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { UserForm } from "@/components/users/user-form";
import { displayName, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loadUserFormChoices } from "@/lib/queries/user-form-data";
import { toDateInputValue } from "@/lib/utils";

export const metadata: Metadata = { title: "Modifier l'utilisateur" };

export default async function EditUserPage(props: PageProps<"/users/[userId]">) {
  const { userId } = await props.params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.USER_UPDATE)) {
    return <ForbiddenState />;
  }

  const hasOrgReach = context.canOrg(PERMISSIONS.USER_UPDATE);
  const visibleSchoolIds = context.schools.map((school) => school.id);

  // Mirrors assertCanActOnUser in the action: a school-scoped admin may only
  // reach users inside their schools, and never one who outranks them.
  const user = await db.user.findFirst({
    where: hasOrgReach
      ? { id: userId, organizationId: context.organization.id }
      : {
          id: userId,
          organizationId: context.organization.id,
          memberships: { some: { schoolId: { in: visibleSchoolIds } } },
          isSuperAdmin: false,
          orgRoleId: null,
        },
    include: {
      profile: true,
      orgRole: { select: { id: true, name: true } },
      memberships: {
        where: hasOrgReach ? {} : { schoolId: { in: visibleSchoolIds } },
        include: {
          school: { select: { id: true, name: true } },
          role: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const { schools, orgRoles, schoolRoles } = await loadUserFormChoices(context);

  return (
    <>
      <PageHeader
        title={displayName(user)}
        description={t.user.editUser}
        backHref="/users"
        backLabel={t.nav.users}
      />
      <UserForm
        schools={schools}
        orgRoles={orgRoles}
        schoolRoles={schoolRoles}
        canManageSuperAdmin={context.isSuperAdmin}
        canAssignOrgRole={context.canOrg(PERMISSIONS.USER_ASSIGN_ROLE)}
        user={{
          id: user.id,
          email: user.email,
          firstName: user.profile?.firstName ?? "",
          lastName: user.profile?.lastName ?? "",
          phone: user.profile?.phone ?? null,
          jobTitle: user.profile?.jobTitle ?? null,
          avatarUrl: user.profile?.avatarUrl ?? null,
          birthDate: toDateInputValue(user.profile?.birthDate),
          isActive: user.isActive,
          isSuperAdmin: user.isSuperAdmin,
          orgRoleId: user.orgRole?.id ?? null,
          orgRoleName: user.orgRole?.name ?? null,
          memberships: user.memberships.map((membership) => ({
            schoolId: membership.school.id,
            schoolName: membership.school.name,
            roleId: membership.role.id,
            roleName: membership.role.name,
          })),
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          isSelf: user.id === context.user.id,
        }}
      />
    </>
  );
}
