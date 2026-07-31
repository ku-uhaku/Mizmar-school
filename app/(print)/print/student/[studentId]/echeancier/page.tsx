import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { formatMonth, formatMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { findEnrolment, loadFeeGrid } from "@/modules/enrolment/queries";
import { findStudent } from "@/modules/students/queries";
import { studentPaymentStanding } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Échéancier" };

/**
 * The year's fee schedule, as the family is given it at enrolment.
 *
 * Fee types down the side and months across the top — the same grid the bursar
 * edits on screen, so a parent querying a figure and the person answering are
 * looking at the same shape. What has actually been paid is summarised at the
 * bottom, because the question at the desk is always "how much is left".
 */
export default async function SchedulePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  // Money: gated on the treasury view, not merely on being able to see a pupil.
  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const student = await findStudent(context, studentId);
  if (!student) notFound();

  const enrolment = await findEnrolment(context, student.id);
  if (!enrolment) notFound();

  const [grid, standing] = await Promise.all([
    loadFeeGrid(context, enrolment.id),
    studentPaymentStanding(context, student.id),
  ]);
  if (!grid) notFound();

  // The school's currency, so a document never contradicts the screen it was
  // printed from.
  const money = (centimes: number) =>
    formatMoney(centimes, locale, context.settings.currencyCode);

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.schedule}
      subtitle={`${student.firstName} ${student.lastName} · ${enrolment.className ?? enrolment.levelName}`}
      reference={student.code}
      backHref={`/students/${student.id}`}
      locale={locale}
      t={t}
    >
      <table className="print-table">
        <thead>
          <tr>
            <th>{t.enrolment.feeType}</th>
            {grid.months.map((month) => (
              <th key={month.key} className="text-end capitalize">
                {formatMonth(month.year, month.month, locale)}
              </th>
            ))}
            <th className="text-end">{t.print.total}</th>
          </tr>
        </thead>

        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.feeTypeId}>
              <td className="font-medium">{row.name}</td>
              {grid.months.map((month) => {
                const cells = row.cells[month.key] ?? [];
                const total = cells.reduce(
                  (sum, cell) => sum + cell.amountCentimes,
                  0,
                );
                return (
                  <td key={month.key} className="text-end tabular-nums">
                    {total === 0 ? "—" : money(total)}
                  </td>
                );
              })}
              <td className="text-end font-medium tabular-nums">
                {money(row.totalCentimes)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td className="font-semibold">{t.print.total}</td>
            {grid.months.map((month) => (
              <td
                key={month.key}
                className="text-end font-semibold tabular-nums"
              >
                {money(grid.monthTotals[month.key] ?? 0)}
              </td>
            ))}
            <td className="text-end font-semibold tabular-nums">
              {money(grid.grandTotalCentimes)}
            </td>
          </tr>
        </tfoot>
      </table>

      <dl className="mt-5 ms-auto grid w-72 gap-1 text-[11px]">
        <Row
          label={t.treasury.charged}
          value={money(standing.chargedCentimes)}
        />
        <Row
          label={t.treasury.alreadyPaid}
          value={money(standing.paidCentimes)}
        />
        <Row
          label={t.treasury.owes}
          value={money(standing.outstandingCentimes)}
          strong
        />
      </dl>

      {grid.discountTotalCentimes > 0 ? (
        <p className="mt-3 text-[10px] opacity-70">
          {t.enrolment.discount}: {money(grid.discountTotalCentimes)}
        </p>
      ) : null}
    </PrintDocument>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 border-b border-dotted py-0.5 ${
        strong ? "font-semibold" : ""
      }`}
    >
      <dt className="opacity-70">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
