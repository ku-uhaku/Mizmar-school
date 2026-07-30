import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { UsersManager } from "@/components/users/users-manager";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/utils";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.USER_VIEW)) {
    return <ForbiddenState />;
  }

  const visibleSchoolIds = context.schools.map((school) => school.id);
  const hasOrgReach = context.canOrg(PERMISSIONS.USER_VIEW);

  // Someone with org-wide reach sees every user; a school-scoped admin sees only
  // people who hold a membership in one of their schools.
  const users = await db.user.findMany({
    where: hasOrgReach
      ? { organizationId: context.organization.id }
      : {
          organizationId: context.organization.id,
          memberships: { some: { schoolId: { in: visibleSchoolIds } } },
        },
    orderBy: [{ profile: { lastName: "asc" } }, { email: "asc" }],
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

  return (
    <>
      <PageHeader title={t.user.title} description={t.user.subtitle} />

      <UsersManager
        permissions={{
          canCreate: context.can(PERMISSIONS.USER_CREATE),
          canUpdate: context.can(PERMISSIONS.USER_UPDATE),
          canDelete: context.can(PERMISSIONS.USER_DELETE),
        }}
        users={users.map((user) => ({
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
          // Serialised for the client component; formatted per-locale there.
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          isSelf: user.id === context.user.id,
        }))}
      />
    </>
  );
}
