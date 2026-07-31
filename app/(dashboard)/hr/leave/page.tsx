import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { LeaveList } from "@/modules/hr/components/leave-list";
import { listLeave, listStaffOptions } from "@/modules/hr/queries";

export const metadata: Metadata = { title: "Congés" };

export default async function HrLeavePage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  const [leave, staffOptions] = await Promise.all([
    listLeave(context),
    listStaffOptions(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.hr.leave}
        description={t.hr.leaveHint}
        backHref="/hr"
        backLabel={t.hr.title}
      />

      <LeaveList
        requests={leave}
        staffOptions={staffOptions}
        canRequest={context.can(PERMISSIONS.HR_ATTENDANCE)}
        canDecide={context.can(PERMISSIONS.HR_MANAGE)}
      />
    </>
  );
}
