import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { SectionHeading } from "@/components/shell/section-heading";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { parsePeriod } from "@/lib/period";
import { PERMISSIONS } from "@/lib/permissions";
import {
  OperationsTable,
  ReceiptsTable,
} from "@/modules/treasury/components/operations-table";
import { SessionBar } from "@/modules/treasury/components/session-bar";
import { TreasuryDashboard } from "@/modules/treasury/components/treasury-dashboard";
import {
  listOperationsPage,
  listPaymentsPage,
  listRegisters,
  treasurySummary,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Caisse" };

/**
 * The caisse landing screen: the day's money and the way into the four things a
 * bursar does with it, then the state of every till, the receipts and the full
 * ledger. Thin, as every page here is — it authorizes, calls the module's
 * queries and renders.
 */
export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();
  const params = await searchParams;

  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  // The overview's window. Only the two flow tiles follow it — see
  // `lib/period.ts` — and it is deliberately not one of the tables' `from`/`to`:
  // narrowing the ledger is a different question from reading the day's takings.
  const period = parsePeriod(single("period"));

  const [summary, registers, operations, payments] = await Promise.all([
    treasurySummary(context, period),
    listRegisters(context),
    // The ledger's window, its filters and its order are all decided here — see
    // the note on `listOperationsPage`.
    listOperationsPage(context, {
      kinds: single("kind") ? [single("kind")!] : undefined,
      methods: single("method") ? [single("method")!] : undefined,
      search: single("search"),
      from: single("from"),
      to: single("to"),
      page: Number(single("page") ?? 1) || 1,
    }),
    // The receipts have their own window, filters and position in the query
    // string — both tables are on this screen, so neither may move the other.
    listPaymentsPage(context, {
      methods: single("rmethod") ? [single("rmethod")!] : undefined,
      statuses: single("rstatus") ? [single("rstatus")!] : undefined,
      search: single("rsearch"),
      from: single("rfrom"),
      to: single("rto"),
      page: Number(single("rpage") ?? 1) || 1,
    }),
  ]);

  return (
    <>
      <PageHeader title={t.treasury.title} description={t.treasury.subtitle} />

      <div className="grid gap-5">
        <TreasuryDashboard
          summary={summary}
          period={period}
          permissions={{
            canCollect: context.can(PERMISSIONS.TREASURY_COLLECT),
            canDisburse: context.can(PERMISSIONS.TREASURY_DISBURSE),
            canTransfer: context.can(PERMISSIONS.TREASURY_TRANSFER),
            canCheques: context.can(PERMISSIONS.TREASURY_CHEQUES),
          }}
        />

        <section className="grid gap-3">
          <SectionHeading label={t.treasury.registers} />
          <SessionBar
            registers={registers}
            canManage={context.can(PERMISSIONS.TREASURY_SESSION)}
          />
        </section>

        <section className="grid gap-3">
          <SectionHeading label={t.treasury.receipts} />
          <ReceiptsTable
            page={payments}
            canCancel={context.can(PERMISSIONS.TREASURY_CANCEL)}
          />
        </section>

        <section className="grid gap-3">
          <SectionHeading label={t.treasury.operations} />
          <OperationsTable
            page={operations}
            canCancel={context.can(PERMISSIONS.TREASURY_CANCEL)}
          />
        </section>
      </div>
    </>
  );
}
