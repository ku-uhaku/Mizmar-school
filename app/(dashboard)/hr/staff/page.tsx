import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { StaffList } from "@/modules/hr/components/staff-list";
import { listStaff } from "@/modules/hr/queries";

export const metadata: Metadata = { title: "Personnel" };

export default async function HrStaffPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  // The list only lists. Hiring is `/hr/staff/new`, which loads its own
  // choices, and correcting a record is the fiche — see `StaffDialog` for why
  // editing is only offered from the screen that has read every column.
  const staff = await listStaff(context);

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
        permissions={{
          canManage: context.can(PERMISSIONS.HR_MANAGE),
          canPayroll: context.can(PERMISSIONS.HR_PAYROLL),
          canDelete: context.can(PERMISSIONS.HR_DELETE),
        }}
      />
    </>
  );
}
