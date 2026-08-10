import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listSchoolRoles } from "@/modules/access/queries";
import { StaffList } from "@/modules/hr/components/staff-list";
import { listLinkableUsers, listStaff } from "@/modules/hr/queries";

export const metadata: Metadata = { title: "Personnel" };

export default async function HrStaffPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  const canManage = context.can(PERMISSIONS.HR_MANAGE);

  const [staff, linkableUsers, schoolRoles] = await Promise.all([
    listStaff(context),
    // Only loaded for a reader who may actually link an account to a record.
    canManage ? listLinkableUsers(context, null) : Promise.resolve([]),
    // Likewise for the roles a newly minted login may be granted — a reader
    // without USER_CREATE is never shown the switch that uses them.
    context.can(PERMISSIONS.USER_CREATE)
      ? listSchoolRoles(context)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={t.hr.staff}
        description={t.hr.staffHint}
        backHref="/hr"
        backLabel={t.hr.title}
      />

      <StaffList
        staff={staff}
        linkableUsers={linkableUsers}
        schoolRoles={schoolRoles}
        canCreateAccount={context.can(PERMISSIONS.USER_CREATE)}
        permissions={{
          canManage,
          canPayroll: context.can(PERMISSIONS.HR_PAYROLL),
          canDelete: context.can(PERMISSIONS.HR_DELETE),
        }}
      />
    </>
  );
}
