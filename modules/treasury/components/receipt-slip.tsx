import {
  formatDate,
  formatDateTime,
  formatMoney,
  interpolate,
} from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import { isDisplayableImage } from "@/lib/images";
import type { PrintLetterhead } from "@/components/print/print-document";
import type { Receipt, ReceiptAllocation } from "@/modules/treasury/queries";

/** One pupil's charge on one receipt, however many instalments it settled. */
type SettledLine = {
  key: string;
  studentName: string;
  className: string | null;
  feeTypeName: string;
  count: number;
  firstDue: string;
  lastDue: string;
  amountCentimes: number;
};

/**
 * The allocations gathered into one line per pupil and charge.
 *
 * ── Why a receipt cannot simply list what it settled ─────────────────────────
 * A family settling the year in one payment settles *every instalment of every
 * charge for every child* — the demo's own receipts run to a hundred and
 * thirty-four allocations. Printed one per row that is four sheets of paper for
 * one transaction, and no parent reads it.
 *
 * Grouping loses nothing a receipt is for: "Scolarité, 10 échéances, sept. —
 * juin, 12 000,00" answers "which instalments did this cover" exactly as the
 * hundred and thirty-four rows did, and it answers it at a glance. The
 * per-instalment detail remains on the pupil's échéancier, which is the
 * document that exists to carry it.
 *
 * Insertion order is kept — the query returns the allocations in the order the
 * schedule holds them, and re-sorting here would put a receipt's lines in a
 * different order from the screen the cashier just read.
 */
function settledLines(allocations: ReceiptAllocation[]): SettledLine[] {
  const lines = new Map<string, SettledLine>();

  for (const allocation of allocations) {
    const key = `${allocation.studentCode}::${allocation.feeTypeName}`;
    const found = lines.get(key);

    if (!found) {
      lines.set(key, {
        key,
        studentName: allocation.studentName,
        className: allocation.className,
        feeTypeName: allocation.feeTypeName,
        count: 1,
        firstDue: allocation.dueDate,
        lastDue: allocation.dueDate,
        amountCentimes: allocation.amountCentimes,
      });
      continue;
    }

    found.count += 1;
    found.amountCentimes += allocation.amountCentimes;
    if (allocation.dueDate < found.firstDue) found.firstDue = allocation.dueDate;
    if (allocation.dueDate > found.lastDue) found.lastDue = allocation.dueDate;
  }

  return [...lines.values()];
}

/**
 * One half of the receipt sheet — an A5 slip.
 *
 * ── Why a receipt is its own document rather than a `PrintDocument` ──────────
 * Everything else the app prints is a *page*: a class list, an attestation, a
 * session statement, each with a letterhead repeated across however many sheets
 * it runs to. A receipt is not that. It is a small, dense, single-sided slip
 * that has to be produced twice — once for the family and once for the till —
 * and the fixed header and footer that make a three-page class list work are
 * exactly what stop two of anything sharing one sheet.
 *
 * So the letterhead is drawn inline and kept to four lines, the type is set a
 * size down, and the whole thing is built to fit inside 148.5mm.
 *
 * It is rendered twice by the page, differing only in `copyLabel`.
 */
export function ReceiptSlip({
  receipt,
  letterhead,
  copyLabel,
  currencyCode,
  locale,
  t,
}: {
  receipt: Receipt;
  letterhead: PrintLetterhead;
  /** Which copy this is — "Exemplaire famille" / "Exemplaire caisse". */
  copyLabel: string;
  currencyCode: string;
  locale: Locale;
  t: Dictionary;
}) {
  const money = (centimes: number) => formatMoney(centimes, locale, currencyCode);
  const lines = settledLines(receipt.allocations);

  const contact = [letterhead.addressLine, letterhead.city, letterhead.phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="print-slip">
      <header className="flex items-start gap-3">
        {isDisplayableImage(letterhead.logoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={letterhead.logoUrl as string}
            alt=""
            className="size-10 shrink-0 object-contain"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-[10pt] leading-tight font-semibold">
            {letterhead.schoolName ?? letterhead.organizationName}
          </p>
          {letterhead.schoolName ? (
            <p className="text-[7pt] opacity-70">
              {letterhead.organizationName}
            </p>
          ) : null}
          {contact ? (
            <p className="text-[7pt] opacity-70">{contact}</p>
          ) : null}
        </div>

        <div className="shrink-0 text-end">
          <p className="text-[10pt] font-bold tracking-tight uppercase">
            {t.print.receipt}
          </p>
          {/* The number a parent quotes back months later, so it leads. */}
          <p className="text-[9pt] font-semibold tabular-nums" dir="ltr">
            {receipt.code}
          </p>
          <p className="text-[7pt] tabular-nums opacity-70">
            {formatDateTime(receipt.paidAt, locale)}
          </p>
        </div>
      </header>

      <div className="mt-2 mb-2 flex items-center justify-between gap-2 border-y border-current py-1">
        <span className="text-[7.5pt] font-medium opacity-80">
          {t.print.receiptFor}{" "}
          <span className="font-semibold opacity-100">
            {receipt.familyName ?? "—"}
          </span>
          {receipt.familyCode ? (
            <span className="tabular-nums opacity-70" dir="ltr">
              {" "}
              · {receipt.familyCode}
            </span>
          ) : null}
        </span>
        <span className="print-copy-label">{copyLabel}</span>
      </div>

      {/* A voided receipt stays readable — somebody holding the paper has to be
        able to look it up and be told it no longer stands. */}
      {receipt.status !== "POSTED" ? (
        <p className="mb-2 border border-current px-2 py-1 text-center text-[8pt] font-bold">
          {t.print.receiptCancelled}
          {receipt.cancelReason ? (
            <span className="block font-normal">{receipt.cancelReason}</span>
          ) : null}
        </p>
      ) : null}

      {/* Set smaller only when it has to be — see `.print-slip-table`. */}
      <table
        className={`print-slip-table${lines.length > 8 ? " is-dense" : ""}`}
      >
        <thead>
          <tr>
            <th>{t.assessment.pupil}</th>
            <th>{t.enrolment.feeType}</th>
            <th>{t.print.dueOn}</th>
            <th className="text-end">{t.treasury.amount}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key}>
              <td>
                {line.studentName}
                {line.className ? (
                  <span className="opacity-60"> · {line.className}</span>
                ) : null}
              </td>
              <td>
                {line.feeTypeName}
                {/* The count rides with the charge rather than under the dates:
                  a second line per row is fourteen extra lines on a receipt
                  like this one, which is the difference between half a sheet
                  and a whole one. */}
                {line.count > 1 ? (
                  <span className="opacity-60">
                    {" "}
                    ({interpolate(t.print.instalmentCount, {
                      count: line.count,
                    })})
                  </span>
                ) : null}
              </td>
              <td className="tabular-nums whitespace-nowrap">
                {line.count === 1
                  ? formatDate(line.firstDue, locale)
                  : `${formatDate(line.firstDue, locale)} — ${formatDate(line.lastDue, locale)}`}
              </td>
              <td className="text-end tabular-nums whitespace-nowrap">
                {money(line.amountCentimes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The figure a parent checks, set to be read across a desk. */}
      <dl className="print-slip-total">
        <dt>{t.print.total}</dt>
        <dd>{money(receipt.totalCentimes)}</dd>
      </dl>

      {/* How it was paid, on one line per tender rather than a second table —
        an A5 half has no room for two sets of column headings. */}
      <p className="mt-2 text-[8pt]">
        <span className="opacity-70">{t.print.tenders} </span>
        {receipt.tenders
          .map((tender) =>
            [
              t.treasuryOptions.methods[
                tender.method as keyof typeof t.treasuryOptions.methods
              ],
              [tender.chequeNumber, tender.bankName, tender.reference]
                .filter(Boolean)
                .join(" "),
              tender.chequeDueOn
                ? formatDate(tender.chequeDueOn, locale)
                : null,
              money(tender.amountCentimes),
            ]
              .filter(Boolean)
              .join(" · "),
          )
          .join("  |  ")}
      </p>

      {receipt.notes ? (
        <p className="mt-1 text-[7pt] opacity-70">{receipt.notes}</p>
      ) : null}

      {/* Pinned to the foot of the slip — see `.print-slip-foot`. */}
      <div className="print-slip-foot flex items-end justify-between gap-4">
        <p className="text-[7pt] opacity-60">
          {receipt.registerName ? `${receipt.registerName} · ` : ""}
          {receipt.createdByName}
        </p>
        <div className="w-40 text-center">
          {/* Deliberately empty: it is signed by hand, on paper. */}
          <div className="mt-4 border-t border-current pt-0.5 text-[7pt] opacity-70">
            {t.print.signatureAndStamp}
          </div>
        </div>
      </div>
    </section>
  );
}
