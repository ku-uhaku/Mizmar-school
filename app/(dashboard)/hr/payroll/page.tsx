import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { PayrollList } from "@/modules/hr/components/payroll-list";
import { listPayroll } from "@/modules/hr/queries";
import {
  findOpenSession,
  listOperationCategories,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Paie" };

/**
 * The salaries, behind their own permission — HR_VIEW is not enough. Paying a
 * bulletin writes a décaissement, so it needs TREASURY_DISBURSE on top; that is
 * why the caisse's own session and categories are read here.
 */
export default async function HrPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_PAYROLL)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const period = {
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };

  const [payroll, expenseCategories, openSession] = await Promise.all([
    listPayroll(context, period.year, period.month),
    listOperationCategories(context, "OUT"),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.hr.payroll}
        description={t.hr.payrollHint}
        backHref="/hr"
        backLabel={t.hr.title}
      />

      <PayrollList
        lines={payroll}
        period={period}
        expenseCategories={expenseCategories.map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        hasOpenSession={openSession !== null}
        canDisburse={context.can(PERMISSIONS.TREASURY_DISBURSE)}
      />
    </>
  );
}
