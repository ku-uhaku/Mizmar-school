import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print/print-button";
import { ForbiddenState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { ReceiptSlip } from "@/modules/treasury/components/receipt-slip";
import { findReceipt } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Reçu" };

/**
 * The receipt a family walks out with — and the copy the caisse keeps.
 *
 * Two A5 slips on one A4 sheet, identical but for which copy each says it is,
 * with a cut line between them. A receipt is handed over and a school has to be
 * able to produce its own copy of what it handed over; printing one sheet and
 * cutting it is how every desk already does this, and it costs one press of the
 * button instead of two.
 *
 * It prints what the money *settled*, line by line, rather than a total: a
 * receipt is quoted back at the school months later, and "3 000 dirhams" on its
 * own settles no argument about which instalments it covered.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const receipt = await findReceipt(context, paymentId);
  if (!receipt) notFound();

  const slip = {
    receipt,
    letterhead: letterheadFrom(context),
    // The school's currency, so a document never contradicts the screen it was
    // printed from.
    currencyCode: context.settings.currencyCode,
    locale,
    t,
  };

  return (
    <div className="print-duplicate">
      {/* Screen only — never printed. See `.print-toolbar` in globals.css. */}
      <div className="print-toolbar">
        <Button asChild variant="ghost" size="sm">
          <Link href="/caisse">{t.common.back}</Link>
        </Button>
        <PrintButton label={t.print.download} />
      </div>

      <article className="print-sheet">
        <ReceiptSlip {...slip} copyLabel={t.print.copyForFamily} />
        <ReceiptSlip {...slip} copyLabel={t.print.copyForOffice} />
      </article>
    </div>
  );
}
