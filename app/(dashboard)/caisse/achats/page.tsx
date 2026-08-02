import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { QuickSpendForm } from "@/modules/treasury/components/quick-spend-form";
import { PURCHASE_SUPPLIER_KINDS } from "@/modules/treasury/enums";
import { findOpenSession, listSuppliers } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Achats" };

/**
 * Achats: what the school bought, and from whom — a box of pens, a computer.
 *
 * The same shape as the factures screen and deliberately so: the difference is
 * that a purchase happens on a *day* rather than covering a month, so no period
 * is asked for. Everything else — the beneficiary, the rubrique, the label —
 * still comes off the supplier's own row.
 */
export default async function PurchasesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_DISBURSE)) {
    return <ForbiddenState />;
  }

  const [suppliers, openSession] = await Promise.all([
    listSuppliers(context, PURCHASE_SUPPLIER_KINDS),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.treasury.purchases}
        description={t.treasury.purchasesHint}
        backHref="/caisse"
        backLabel={t.treasury.title}
      />

      <QuickSpendForm
        mode="PURCHASE"
        suppliers={suppliers}
        staffOptions={[]}
        categories={[]}
        hasOpenSession={openSession !== null}
      />
    </>
  );
}
