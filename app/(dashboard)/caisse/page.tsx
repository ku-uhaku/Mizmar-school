import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { formatAmount } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  OperationsTable,
  ReceiptsTable,
} from "@/modules/treasury/components/operations-table";
import { SessionBar } from "@/modules/treasury/components/session-bar";
import {
  listOperations,
  listPayments,
  listRegisters,
  treasurySummary,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Caisse" };

/**
 * The caisse landing screen: the state of every till, the day's figures, the
 * receipts and the full ledger. Thin, as every page here is — it authorizes,
 * calls the module's queries and renders.
 */
export default async function TreasuryPage() {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.TREASURY_VIEW)) {
    return <ForbiddenState />;
  }

  const [summary, registers, operations, payments] = await Promise.all([
    treasurySummary(context),
    listRegisters(context),
    listOperations(context),
    listPayments(context, 25),
  ]);

  const money = (centimes: number) => `${formatAmount(centimes, locale)} MAD`;

  return (
    <>
      <PageHeader title={t.treasury.title} description={t.treasury.subtitle} />

      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t.treasury.inDrawer} value={money(summary.drawerCentimes)} />
          <Stat
            label={t.treasury.collectedToday}
            value={money(summary.collectedTodayCentimes)}
          />
          <Stat
            label={t.treasury.disbursedToday}
            value={money(summary.disbursedTodayCentimes)}
          />
          <Stat
            label={t.treasury.chequesPending}
            value={money(summary.chequesPendingCentimes)}
            hint={`${summary.chequesPendingCount}${
              summary.chequesBouncedCount > 0
                ? ` · ${summary.chequesBouncedCount} ${t.treasury.chequesBounced}`
                : ""
            }`}
          />
        </div>

        <section className="grid gap-3">
          <h2 className="text-sm font-medium">{t.treasury.registers}</h2>
          <SessionBar
            registers={registers}
            canManage={context.can(PERMISSIONS.TREASURY_SESSION)}
          />
        </section>

        <section className="grid gap-3">
          <h2 className="text-sm font-medium">{t.treasury.receipts}</h2>
          <ReceiptsTable
            payments={payments}
            canCancel={context.can(PERMISSIONS.TREASURY_CANCEL)}
          />
        </section>

        <section className="grid gap-3">
          <h2 className="text-sm font-medium">{t.treasury.operations}</h2>
          <OperationsTable operations={operations} />
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="grid gap-1 py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
