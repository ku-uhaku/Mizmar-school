"use client";

import Link from "next/link";
import { BanknoteArrowDownIcon, TriangleAlertIcon } from "lucide-react";

import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { PaymentStanding } from "@/modules/treasury/queries";

/**
 * Where one pupil stands against their échéancier, on their own file.
 *
 * The parcours above can only say "up to date" or not, and that is not enough
 * once part payment is in play: a family that has paid 800 of a 1 200 instalment
 * is neither settled nor untouched, and the secretary on the phone needs the
 * figure, not the flag. So the tick lives in the stepper and the amounts live
 * here.
 *
 * `overdue` is called out separately from `outstanding` on purpose — see the
 * note on `PaymentStanding.overdueCentimes`. Most of the year's fees are
 * outstanding in October and none of them are late.
 */
export function StudentPaymentPanel({
  standing,
  familyId,
  canCollect,
}: {
  standing: PaymentStanding;
  /** Null when the child has no dossier familial — there is nobody to bill. */
  familyId: string | null;
  canCollect: boolean;
}) {
  const t = useT();
  const locale = useLocale();

  const money = (centimes: number) => `${formatAmount(centimes, locale)} MAD`;
  const behind = standing.overdueCentimes > 0;

  if (standing.totalLines === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          {t.treasury.noScheduleYet}
        </CardContent>
      </Card>
    );
  }

  const paidRatio =
    standing.chargedCentimes === 0
      ? 0
      : Math.min(100, (standing.paidCentimes / standing.chargedCentimes) * 100);

  return (
    <Card>
      <CardContent className="grid gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{t.treasury.standing}</h3>
            {behind ? (
              <Badge variant="destructive" className="gap-1">
                <TriangleAlertIcon className="size-3" />
                {interpolate(t.treasury.overdueBy, {
                  amount: money(standing.overdueCentimes),
                })}
              </Badge>
            ) : (
              <Badge variant="secondary">{t.treasury.upToDate}</Badge>
            )}
          </div>

          {canCollect && familyId ? (
            <Button asChild size="sm" variant={behind ? "default" : "outline"}>
              <Link href={`/caisse/encaissement?family=${familyId}`}>
                <BanknoteArrowDownIcon className="size-4" />
                {t.treasury.collectNow}
              </Link>
            </Button>
          ) : null}
        </div>

        {/*
          A single bar rather than a table: the one thing a reader wants from a
          glance is the proportion settled, and four numbers in a row make that
          arithmetic they have to do themselves.
        */}
        <div
          className="bg-muted h-2 overflow-hidden rounded-full"
          role="img"
          aria-label={interpolate(t.treasury.paidOfCharged, {
            paid: money(standing.paidCentimes),
            charged: money(standing.chargedCentimes),
          })}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              behind ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${paidRatio}%` }}
          />
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label={t.treasury.charged} value={money(standing.chargedCentimes)} />
          <Row label={t.treasury.alreadyPaid} value={money(standing.paidCentimes)} />
          <Row
            label={t.treasury.owes}
            value={money(standing.outstandingCentimes)}
            strong
          />
          <Row
            label={t.treasury.overdue}
            value={money(standing.overdueCentimes)}
            tone={behind ? "bad" : undefined}
          />
        </dl>

        <p className="text-muted-foreground text-xs">
          {interpolate(t.treasury.linesSettled, {
            settled: standing.settledLines,
            total: standing.totalLines,
          })}
          {standing.lastPaidAt
            ? ` · ${t.treasury.lastPaid} ${formatDate(standing.lastPaidAt, locale)}`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "bad";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong && "font-semibold",
          tone === "bad" && "text-destructive font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
