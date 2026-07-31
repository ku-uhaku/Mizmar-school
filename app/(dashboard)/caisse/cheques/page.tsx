import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ChequeTable } from "@/modules/treasury/components/cheque-table";
import { listCheques } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Suivi chèques" };

export default async function ChequesPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_CHEQUES)) {
    return <ForbiddenState />;
  }

  const cheques = await listCheques(context);

  return (
    <>
      <PageHeader
        title={t.treasury.cheques}
        description={t.treasury.chequesSubtitle}
      />

      <ChequeTable
        cheques={cheques}
        canManage={context.can(PERMISSIONS.TREASURY_CHEQUES)}
      />
    </>
  );
}
