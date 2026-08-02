import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { AdvanceList } from "@/modules/hr/components/advance-list";
import { listAdvances, listStaffOptions } from "@/modules/hr/queries";
import {
  findOpenSession,
  listOperationCategories,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Avances" };

/**
 * Les avances sur salaire, behind HR_PAYROLL — an advance is a movement against
 * somebody's wage, and whoever marks the register has no business seeing it.
 *
 * Handing the money over needs TREASURY_DISBURSE on top, which is why the
 * caisse's own session and rubriques are read here: the payout writes a
 * décaissement exactly as paying a bulletin does.
 */
export default async function HrAdvancesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_PAYROLL)) {
    return <ForbiddenState />;
  }

  const [advances, staff, expenseCategories, openSession] = await Promise.all([
    listAdvances(context),
    listStaffOptions(context),
    listOperationCategories(context, "OUT"),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.hr.advances}
        description={t.hr.advancesHint}
        backHref="/hr"
        backLabel={t.hr.title}
      />

      <AdvanceList
        advances={advances}
        staff={staff}
        expenseCategories={expenseCategories.map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        hasOpenSession={openSession !== null}
        canManage={context.can(PERMISSIONS.HR_PAYROLL)}
        canDisburse={context.can(PERMISSIONS.TREASURY_DISBURSE)}
      />
    </>
  );
}
