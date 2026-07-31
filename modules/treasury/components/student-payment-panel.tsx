"use client";

import Link from "next/link";
import * as React from "react";
import {
  BanknoteArrowDownIcon,
  CheckCircle2Icon,
  ClockIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";

import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useMoney } from "@/components/providers/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  PAYMENT_STATE_STYLES,
  standingStateOf,
  type PaymentState,
} from "@/modules/treasury/payment-state";
import type {
  FamilyStanding,
  PaymentStanding,
} from "@/modules/treasury/queries";

/**
 * Where a pupil stands against their échéancier, on their own file.
 *
 * The parcours above can only say "up to date" or not, and that is not enough
 * once part payment is in play: a family that has paid 800 of a 1 200 instalment
 * is neither settled nor untouched, and the secretary on the phone needs the
 * figure, not the flag. So the tick lives in the stepper and the amounts live
 * here, coloured by `payment-state.ts` so that amber means the same thing on
 * every screen in the app.
 *
 * The fratrie is behind a switch and off by default. Most of the time the
 * question is about this child; when a parent is at the desk it is about the
 * household, and then one payment settles all of them — which is why ticking it
 * also switches the collect button to the family.
 *
 * `overdue` is called out separately from `outstanding` on purpose — see the
 * note on `PaymentStanding.overdueCentimes`. Most of the year's fees are
 * outstanding in October and none of them are late.
 */
export function StudentPaymentPanel({
  standing,
  family,
  familyId,
  canCollect,
}: {
  standing: PaymentStanding;
  /** Null when the viewer has no dossier to read, or the child has none. */
  family: FamilyStanding | null;
  /** Null when the child has no dossier familial — there is nobody to bill. */
  familyId: string | null;
  canCollect: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [showSiblings, setShowSiblings] = React.useState(false);

  const money = useMoney();

  const state = standingStateOf(standing);
  const hasSiblings = (family?.siblings.length ?? 0) > 0;
  // Only meaningful once the fratrie is on screen: otherwise the button would
  // silently collect for children the reader cannot see.
  const collectingForFamily = showSiblings && hasSiblings;

  if (standing.totalLines === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          {t.treasury.noScheduleYet}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border", PAYMENT_STATE_STYLES[state].surface)}>
      <CardContent className="grid gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{t.treasury.standing}</h3>
            <StateBadge state={state} standing={standing} money={money} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasSiblings ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-siblings"
                  checked={showSiblings}
                  onCheckedChange={setShowSiblings}
                />
                <Label
                  htmlFor="show-siblings"
                  className="cursor-pointer text-xs font-normal"
                >
                  <UsersIcon className="size-3.5" />
                  {interpolate(t.treasury.showSiblings, {
                    count: family?.siblings.length ?? 0,
                  })}
                </Label>
              </div>
            ) : null}

            {canCollect && familyId ? (
              <Button
                asChild
                size="sm"
                variant={state === "OVERDUE" ? "default" : "outline"}
              >
                <Link href={`/caisse/encaissement?family=${familyId}`}>
                  <BanknoteArrowDownIcon className="size-4" />
                  {collectingForFamily
                    ? t.treasury.collectForFamily
                    : t.treasury.collectNow}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <StandingBar standing={standing} state={state} money={money} />

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row
            label={t.treasury.charged}
            value={money(standing.chargedCentimes)}
          />
          <Row
            label={t.treasury.alreadyPaid}
            value={money(standing.paidCentimes)}
            tone={standing.paidCentimes > 0 ? "good" : undefined}
          />
          <Row
            label={t.treasury.owes}
            value={money(standing.outstandingCentimes)}
            strong
          />
          <Row
            label={t.treasury.overdue}
            value={money(standing.overdueCentimes)}
            tone={standing.overdueCentimes > 0 ? "bad" : undefined}
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

        {showSiblings && family && hasSiblings ? (
          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              {t.treasury.siblings} · {family.familyName}
            </p>

            <ul className="grid gap-3">
              {family.siblings.map((sibling) => {
                const siblingState = standingStateOf(sibling.standing);
                return (
                  <li key={sibling.studentId}>
                    <Link
                      href={`/students/${sibling.studentId}`}
                      className="hover:bg-muted/50 -mx-2 block rounded-md px-2 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {sibling.studentName}
                          </span>
                          {sibling.className ? (
                            <Badge variant="outline" className="shrink-0">
                              {sibling.className}
                            </Badge>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            PAYMENT_STATE_STYLES[siblingState].text,
                          )}
                        >
                          {sibling.standing.totalLines === 0
                            ? t.treasury.noScheduleYet
                            : `${money(sibling.standing.paidCentimes)} / ${money(
                                sibling.standing.chargedCentimes,
                              )}`}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <StandingBar
                          standing={sibling.standing}
                          state={siblingState}
                          money={money}
                          compact
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-3 grid gap-2 border-t pt-3 text-sm">
              <Row
                label={t.treasury.familyTotal}
                value={`${money(family.paidCentimes)} / ${money(
                  family.chargedCentimes,
                )}`}
                strong
              />
              <Row
                label={t.treasury.familyOwes}
                value={money(family.outstandingCentimes)}
                tone={family.overdueCentimes > 0 ? "bad" : undefined}
                strong
              />
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * A single bar rather than a table: the one thing a reader wants from a glance
 * is the proportion settled, and four numbers in a row make that arithmetic
 * they have to do themselves.
 */
function StandingBar({
  standing,
  state,
  money,
  compact,
}: {
  standing: PaymentStanding;
  state: PaymentState;
  money: (centimes: number) => string;
  compact?: boolean;
}) {
  const t = useT();

  const paidRatio =
    standing.chargedCentimes === 0
      ? 0
      : Math.min(100, (standing.paidCentimes / standing.chargedCentimes) * 100);

  return (
    <div
      className={cn(
        "bg-muted overflow-hidden rounded-full",
        compact ? "h-1.5" : "h-2",
      )}
      role="img"
      aria-label={`${t.treasuryOptions.paymentStates[state]} · ${interpolate(
        t.treasury.paidOfCharged,
        {
          paid: money(standing.paidCentimes),
          charged: money(standing.chargedCentimes),
        },
      )}`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          PAYMENT_STATE_STYLES[state].bar,
        )}
        style={{ width: `${paidRatio}%` }}
      />
    </div>
  );
}

/** The state, said in words and in colour — never in colour alone. */
function StateBadge({
  state,
  standing,
  money,
}: {
  state: PaymentState;
  standing: PaymentStanding;
  money: (centimes: number) => string;
}) {
  const t = useT();

  if (state === "OVERDUE") {
    return (
      <Badge variant="destructive" className="gap-1">
        <TriangleAlertIcon className="size-3" />
        {interpolate(t.treasury.overdueBy, {
          amount: money(standing.overdueCentimes),
        })}
      </Badge>
    );
  }

  if (state === "SETTLED") {
    return (
      <Badge variant="outline" className="text-success border-success/40 gap-1">
        <CheckCircle2Icon className="size-3" />
        {t.treasuryOptions.paymentStates.SETTLED}
      </Badge>
    );
  }

  if (state === "PARTIAL") {
    return (
      <Badge variant="outline" className="text-warning border-warning/40 gap-1">
        <ClockIcon className="size-3" />
        {t.treasuryOptions.paymentStates.PARTIAL}
      </Badge>
    );
  }

  return <Badge variant="secondary">{t.treasury.upToDate}</Badge>;
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
  tone?: "bad" | "good";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong && "font-semibold",
          tone === "bad" && "text-destructive font-semibold",
          tone === "good" && "text-success",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
