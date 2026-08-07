import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrinterIcon } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { SectionHeading } from "@/components/shell/section-heading";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { OperationsTable } from "@/modules/treasury/components/operations-table";
import {
  asSingleOperationsPage,
  findSessionDetail,
  listOperations,
} from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Session de caisse" };

/**
 * One opening of a till, end to end: who opened it and with what float, who
 * closed it and what they counted, and every movement posted in between —
 * the detail `listSessions`' own row never showed, and the printable version
 * of it (see the "Imprimer / PDF" link) for whoever needs a paper copy.
 */
export default async function CashSessionPage({
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

  const operations = await listOperations(context, { sessionId });
  const money = (centimes: number) =>
    formatMoney(centimes, locale, context.settings.currencyCode);

  return (
    <>
      <PageHeader
        title={session.registerName}
        description={formatDate(session.openedAt, locale)}
        backHref="/caisse/registers"
        backLabel={t.treasury.registers}
        meta={
          <Badge variant={session.status === "OPEN" ? "default" : "outline"}>
            {
              t.treasuryOptions.sessionStatuses[
                session.status as keyof typeof t.treasuryOptions.sessionStatuses
              ]
            }
          </Badge>
        }
      >
        <Button asChild variant="outline">
          <Link href={`/print/caisse/session/${session.id}`}>
            <PrinterIcon />
            {t.print.download}
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t.treasury.sessionDetails}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Field label={t.treasury.openedBy} value={session.openedByName} />
              <Field
                label={t.treasury.openedAt}
                value={formatDate(session.openedAt, locale)}
              />
              <Field
                label={t.treasury.closedBy}
                value={
                  session.wasAutoClosed
                    ? t.treasury.sessionAutoClosed
                    : (session.closedByName ?? "—")
                }
              />
              <Field
                label={t.treasury.closedAt}
                value={
                  session.closedAt ? formatDate(session.closedAt, locale) : "—"
                }
              />
              <Field
                label={t.treasury.openingFloat}
                value={money(session.openingFloatCentimes)}
              />
              <Field
                label={t.treasury.counted}
                value={
                  session.countedCentimes !== null
                    ? money(session.countedCentimes)
                    : "—"
                }
              />
              <Field
                label={t.treasury.expected}
                value={
                  session.expectedCentimes !== null
                    ? money(session.expectedCentimes)
                    : "—"
                }
              />
              <Field
                label={t.treasury.variance}
                value={
                  session.varianceCentimes !== null
                    ? money(session.varianceCentimes)
                    : "—"
                }
              />
            </dl>
            {session.notes ? (
              <p className="text-muted-foreground mt-4 text-sm">
                {session.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-3">
          <SectionHeading label={t.treasury.operations} />
          <OperationsTable
            page={asSingleOperationsPage(operations)}
            canCancel={context.can(PERMISSIONS.TREASURY_CANCEL)}
            filterable={false}
          />
        </section>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
