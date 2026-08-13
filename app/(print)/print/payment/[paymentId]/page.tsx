import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  interpolate,
} from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { findReceipt } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Reçu" };

/**
 * The receipt a family walks out with.
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

  // The school's currency, so a document never contradicts the screen it was
  // printed from.
  const money = (centimes: number) =>
    formatMoney(centimes, locale, context.settings.currencyCode);

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.receipt}
      reference={receipt.code}
      backHref="/caisse"
      locale={locale}
      t={t}
      signature={t.treasury.title}
    >
      {/* A voided receipt stays readable — somebody holding the paper copy has
          to be able to look it up and be told it no longer stands. */}
      {receipt.status !== "POSTED" ? (
        <div className="mb-4 border-2 border-current p-2 text-center">
          <p className="text-sm font-bold">{t.print.receiptCancelled}</p>
          {/* The motif and the name, on the paper. A parent disputing a voided
              receipt is holding this sheet, and "cancelled" on its own is what
              makes them come back to the desk to ask why. */}
          {receipt.cancelReason ? (
            <p className="mt-1 text-[11px] font-normal">
              {receipt.cancelReason}
            </p>
          ) : null}
          {receipt.cancelledByName || receipt.cancelledAt ? (
            <p className="mt-0.5 text-[10px] font-normal">
              {[
                receipt.cancelledByName
                  ? `${t.treasury.cancelledBy} ${receipt.cancelledByName}`
                  : null,
                receipt.cancelledAt
                  ? formatDateTime(receipt.cancelledAt, locale)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <Row label={t.print.receiptFor} value={receipt.familyName ?? "—"} />
        <Row
          label={t.print.issuedOn}
          value={formatDateTime(receipt.paidAt, locale)}
        />
        <Row label={t.family.code} value={receipt.familyCode ?? "—"} />
        <Row label={t.treasury.register} value={receipt.registerName ?? "—"} />
      </dl>

      <p className="mb-2 text-xs font-semibold">{t.print.settles}</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>{t.assessment.pupil}</th>
            <th>{t.assessment.class}</th>
            <th>{t.enrolment.feeType}</th>
            <th>{t.print.dueOn}</th>
            <th className="text-end">{t.treasury.amount}</th>
          </tr>
        </thead>
        <tbody>
          {receipt.allocations.map((allocation, index) => (
            <tr key={`${allocation.studentCode}-${index}`}>
              <td>
                {allocation.studentName}
                <span className="block text-[9px] opacity-60" dir="ltr">
                  {allocation.studentCode}
                </span>
              </td>
              <td>{allocation.className ?? "—"}</td>
              <td>{allocation.feeTypeName}</td>
              <td className="tabular-nums">
                {formatDate(allocation.dueDate, locale)}
              </td>
              <td className="text-end tabular-nums">
                {money(allocation.amountCentimes)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="text-end font-semibold">
              {t.print.total}
            </td>
            <td className="text-end font-semibold tabular-nums">
              {money(receipt.totalCentimes)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-5 mb-2 text-xs font-semibold">{t.print.tenders}</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>{t.treasury.method}</th>
            <th>{t.treasury.reference}</th>
            <th className="text-end">{t.treasury.amount}</th>
          </tr>
        </thead>
        <tbody>
          {receipt.tenders.map((tender, index) => (
            <tr key={index}>
              <td>
                {
                  t.treasuryOptions.methods[
                    tender.method as keyof typeof t.treasuryOptions.methods
                  ]
                }
              </td>
              <td dir="ltr">
                {[
                  tender.chequeNumber,
                  tender.bankName,
                  tender.reference,
                  tender.chequeDueOn
                    ? formatDate(tender.chequeDueOn, locale)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td className="text-end tabular-nums">
                {money(tender.amountCentimes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {receipt.notes ? (
        <p className="mt-4 text-[10px] opacity-70">{receipt.notes}</p>
      ) : null}

      <p className="mt-4 text-[10px] opacity-60">
        {interpolate(t.treasury.linesSettled, {
          settled: receipt.allocations.length,
          total: receipt.allocations.length,
        })}{" "}
        · {receipt.createdByName}
      </p>
    </PrintDocument>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dotted py-0.5">
      <dt className="opacity-70">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
