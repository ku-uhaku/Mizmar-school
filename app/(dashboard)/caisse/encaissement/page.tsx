import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { PaymentConsole } from "@/modules/treasury/components/payment-console";
import {
  findOpenSession,
  findPayableFamily,
  listFamilyOptions,
  listBanks,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Encaissement" };

/**
 * The chosen family travels in the URL rather than in client state: what a
 * household owes is a permission-scoped server read, and keeping it in the
 * address means a reload — or a link sent to a colleague — lands on the same
 * schedule instead of an empty screen.
 */
export default async function EncaissementPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TREASURY_COLLECT)) {
    return <ForbiddenState />;
  }

  const { family: familyId } = await searchParams;

  const [families, family, banks, openSession] = await Promise.all([
    listFamilyOptions(context),
    familyId ? findPayableFamily(context, familyId) : Promise.resolve(null),
    listBanks(context),
    findOpenSession(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.treasury.encaissement}
        description={t.treasury.encaissementSubtitle}
      />

      <PaymentConsole
        families={families}
        family={family}
        banks={banks}
        hasOpenSession={openSession !== null}
      />
    </>
  );
}
