import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listStaffOptions } from "@/modules/hr/queries";
import { DisbursementForm } from "@/modules/treasury/components/disbursement-form";
import {
  findOpenSession,
  listBanks,
  listOperationCategories,
  listOperationMotifs,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Décaissement" };

export default async function DecaissementPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_DISBURSE)) {
    return <ForbiddenState />;
  }

  const [categories, motifs, banks, openSession, staffOptions] =
    await Promise.all([
      // Only the rubriques money may actually go out under — see categoryAllows.
      listOperationCategories(context, "OUT"),
      listOperationMotifs(context),
      listBanks(context),
      findOpenSession(context),
      // Only offered to readers who may see the staff list; the name field stands
      // on its own for everybody else.
      context.can(PERMISSIONS.HR_VIEW)
        ? listStaffOptions(context)
        : Promise.resolve([]),
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
        staffOptions={staffOptions}
        hasOpenSession={openSession !== null}
      />
    </>
  );
}
