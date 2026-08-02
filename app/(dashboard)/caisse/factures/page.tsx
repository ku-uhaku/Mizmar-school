import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { QuickSpendForm } from "@/modules/treasury/components/quick-spend-form";
import { BILLED_SUPPLIER_KINDS } from "@/modules/treasury/enums";
import { findOpenSession, listSuppliers } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Factures" };

/**
 * Factures et charges: the water, the electricity, the telephone, the rent.
 *
 * A screen of its own rather than the décaissement form, because settling a
 * monthly bill asks four questions and that form asks twelve — see the note on
 * `QuickSpendForm`. The rubrique comes off the supplier, so the manager never
 * chooses one.
 */
export default async function BillsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_DISBURSE)) {
    return <ForbiddenState />;
  }

  const [suppliers, openSession] = await Promise.all([
    listSuppliers(context, BILLED_SUPPLIER_KINDS),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.treasury.bills}
        description={t.treasury.billsHint}
        backHref="/caisse"
        backLabel={t.treasury.title}
      />

      <QuickSpendForm
        mode="BILL"
        suppliers={suppliers}
        staffOptions={[]}
        categories={[]}
        hasOpenSession={openSession !== null}
      />
    </>
  );
}
