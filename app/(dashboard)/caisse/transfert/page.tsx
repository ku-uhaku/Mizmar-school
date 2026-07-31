import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { TransferForm } from "@/modules/treasury/components/transfer-form";
import { listRegisters } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Transfert" };

export default async function TransfertPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_TRANSFER)) {
    return <ForbiddenState />;
  }

  const registers = await listRegisters(context);

  return (
    <>
      <PageHeader
        title={t.treasury.transfert}
        description={t.treasury.transfertSubtitle}
      />

      <TransferForm registers={registers} />
    </>
  );
}
