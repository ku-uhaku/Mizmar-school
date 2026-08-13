import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { formatDateTime, formatMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { findSessionDetail, listOperations } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Relevé de caisse" };

/**
 * The paper version of a till's session: what it opened with, what it closed
 * with, and every movement in between — the "PDF" is this page through the
 * browser's own print dialog, exactly as a receipt is. See the note on
 * `PrintDocument` for why that beats a second, PDF-library rendering path.
 */
export default async function CashSessionReceiptPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const session = await findSessionDetail(context, sessionId);
  if (!session) notFound();

  const operations = await listOperations(context, { sessionId }, 500);
  const money = (centimes: number) =>
    formatMoney(centimes, locale, context.settings.currencyCode);

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.cashSession}
      subtitle={session.registerName}
      reference={session.registerCode}
      backHref="/caisse/registers"
      locale={locale}
      t={t}
      signature={t.treasury.title}
    >
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <Row label={t.treasury.openedBy} value={session.openedByName} />
        <Row
          label={t.treasury.openedAt}
          value={formatDateTime(session.openedAt, locale)}
        />
        <Row
          label={t.treasury.closedBy}
          value={
            session.wasAutoClosed
              ? t.treasury.sessionAutoClosed
              : (session.closedByName ?? "—")
          }
        />
        <Row
          label={t.treasury.closedAt}
          value={
            session.closedAt ? formatDateTime(session.closedAt, locale) : "—"
          }
        />
        <Row
          label={t.treasury.openingFloat}
          value={money(session.openingFloatCentimes)}
        />
        <Row
          label={t.treasury.counted}
          value={
            session.countedCentimes !== null
              ? money(session.countedCentimes)
              : "—"
          }
        />
        <Row
          label={t.treasury.expected}
          value={
            session.expectedCentimes !== null
              ? money(session.expectedCentimes)
              : "—"
          }
        />
        <Row
          label={t.treasury.variance}
          value={
            session.varianceCentimes !== null
              ? money(session.varianceCentimes)
              : "—"
          }
        />
      </dl>

      <p className="mb-2 text-xs font-semibold">
        {t.treasury.operations} ({operations.length})
      </p>
      <table className="print-table">
        <thead>
          <tr>
            <th>{t.treasury.occurredAt}</th>
            <th>{t.treasury.label}</th>
            <th>{t.treasury.method}</th>
            <th className="text-end">{t.treasury.amount}</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id}>
              <td className="tabular-nums whitespace-nowrap">
                {formatDateTime(operation.occurredAt, locale)}
              </td>
              <td>
                {operation.label}
                {operation.beneficiaryName ? (
                  <span className="block text-[9px] opacity-60">
                    {operation.beneficiaryName}
                  </span>
                ) : null}
              </td>
              <td>
                {
                  t.treasuryOptions.methods[
                    operation.method as keyof typeof t.treasuryOptions.methods
                  ]
                }
              </td>
              <td className="text-end tabular-nums">
                {money(operation.cashImpactCentimes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {session.notes ? (
        <p className="mt-4 text-[10px] opacity-70">{session.notes}</p>
      ) : null}
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
