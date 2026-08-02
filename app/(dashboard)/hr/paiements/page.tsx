import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listStaffOptions } from "@/modules/hr/queries";
import { StaffPaymentForm } from "@/modules/treasury/components/staff-payment-form";
import {
  findOpenSession,
  listOperationCategories,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Paiements personnel" };

/**
 * Paying a member of staff something that is not a bulletin.
 *
 * Salaries and avances have screens of their own, because both are *owed*
 * before they are paid and carry a document. This is for what is not: a
 * reimbursement, an indemnité, a one-off. It names the employee's row rather
 * than a typed string, so the ledger and the payroll refer to the same person.
 */
export default async function StaffPaymentsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_DISBURSE) || !context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  const [staffOptions, categories, openSession] = await Promise.all([
    listStaffOptions(context),
    listOperationCategories(context, "OUT"),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.treasury.staffPayments}
        description={t.treasury.staffPaymentsHint}
        backHref="/hr"
        backLabel={t.hr.title}
      />

      <StaffPaymentForm
        staffOptions={staffOptions}
        categories={categories.map((category) => ({
          id: category.id,
          label: category.name,
        }))}
        hasOpenSession={openSession !== null}
      />
    </>
  );
}
