import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { DisbursementForm } from "@/modules/treasury/components/disbursement-form";
import { SUPPLIER_KINDS } from "@/modules/treasury/enums";
import {
  listBanks,
  listOpenDrawers,
  listOperationCategories,
  listOperationMotifs,
  listSuppliers,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Décaissement" };

export default async function DecaissementPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_DISBURSE)) {
    return <ForbiddenState />;
  }

  const [categories, motifs, banks, drawers, suppliers] = await Promise.all([
    // Only the rubriques money may actually go out under — see categoryKindsFor.
    listOperationCategories(context, "OUT"),
    listOperationMotifs(context),
    listBanks(context),
    // Every till open today, not merely the caller's: a cash payout names the
    // drawer the notes came out of — see `listOpenDrawers`.
    listOpenDrawers(context),
    // Every declared fournisseur, whatever its kind: this one screen covers the
    // lot now, so narrowing it would hide half the catalogue.
    listSuppliers(context, SUPPLIER_KINDS),
  ]);

  return (
    <>
      <PageHeader
        title={t.treasury.decaissement}
        description={t.treasury.decaissementSubtitle}
      />

      <DisbursementForm
        categories={categories}
        motifs={motifs}
        banks={banks}
        suppliers={suppliers}
        drawers={drawers}
      />
    </>
  );
}
