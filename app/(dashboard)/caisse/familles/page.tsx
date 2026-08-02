import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { FamilyPayments } from "@/modules/treasury/components/family-payments";
import { listFamilyPayments } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Situation des familles" };

/**
 * Every household's payment situation for the year in context.
 *
 * The caisse dashboard shows the last receipts, which answers "what came in
 * today". This answers the other question — "who has not paid" — which cannot
 * be read off a list of receipts because the families that owe money are
 * precisely the ones with no receipt on it.
 */
export default async function FamilyPaymentsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const families = await listFamilyPayments(context);

  return (
    <>
      <PageHeader
        title={t.treasury.familyPayments}
        description={t.treasury.familyPaymentsHint}
        backHref="/caisse"
        backLabel={t.treasury.title}
      />

      <FamilyPayments families={families} />
    </>
  );
}
