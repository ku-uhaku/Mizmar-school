import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { DisbursementForm } from "@/modules/treasury/components/disbursement-form";
import {
  findOpenSession,
  listExpenseCategories,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Décaissement" };

export default async function DecaissementPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_DISBURSE)) {
    return <ForbiddenState />;
  }

  const [categories, openSession] = await Promise.all([
    listExpenseCategories(context),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.treasury.decaissement}
        description={t.treasury.decaissementSubtitle}
      />

      <DisbursementForm
        categories={categories}
        hasOpenSession={openSession !== null}
      />
    </>
  );
}
