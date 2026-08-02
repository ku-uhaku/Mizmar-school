"use client";

import Link from "next/link";

import * as React from "react";
import {
  BanknoteArrowDownIcon,
  CheckCircle2Icon,
  ClockIcon,
  ListTreeIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";

import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useMoney } from "@/components/providers/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { PaymentConsole } from "@/modules/treasury/components/payment-console";
import { ReceiptsTable } from "@/modules/treasury/components/operations-table";
import {
  PAYMENT_STATE_STYLES,
  standingStateOf,
  type PaymentState,
} from "@/modules/treasury/payment-state";
import type {
  BankOption,
  FamilyStanding,
  PayableFamily,
  PaymentRow,
  PaymentStanding,
  ServiceStanding,
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
 *
 * The receipts already taken are listed underneath, the same table the caisse
 * ledger draws — so a duplicate can be reprinted, or a receipt written in error
 * cancelled, without leaving the child's file to hunt for it in /caisse.
 */
export function StudentPaymentPanel({
  standing,
  family,
  familyId,
  canCollect,
  canCancel,
  payments,
  payable,
  banks,
  hasOpenSession,
}: {
  standing: PaymentStanding;
  /** Null when the viewer has no dossier to read, or the child has none. */
  family: FamilyStanding | null;
  /** Null when the child has no dossier familial — there is nobody to bill. */
  familyId: string | null;
  canCollect: boolean;
  canCancel: boolean;
  /** Receipts that settled this pupil's lines — see `listStudentPayments`. */
  payments: PaymentRow[];
  /**
   * The household's payable schedule, when the reader may collect. Loaded with
   * the file rather than on demand: a sheet that fetched on open was one more
   * thing to go wrong between a parent handing over cash and a receipt, and the
   * desk needs the till on the same screen as the balance.
   */
  payable: PayableFamily | null;
  banks: BankOption[];
  hasOpenSession: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [showSiblings, setShowSiblings] = React.useState(false);

  const money = useMoney();

  const state = standingStateOf(standing);
  const hasSiblings = (family?.siblings.length ?? 0) > 0;

  /**
   * The breakdown table's rows: this pupil's charges, then — only when the
   * fratrie switch is on — each sibling's underneath.
   *
   * The pupil comes first whatever the alphabet says: this is their file, and a
   * table that opened on a brother's cantine would be answering a question
   * nobody asked.
   */
  const serviceRows = React.useMemo(() => {
    const rows = standing.byService.map((service) => ({
      key: `self:${service.feeTypeId}`,
      pupil: t.treasury.thisPupil,
      service,
    }));

    if (!showSiblings || !family) return rows;

    for (const sibling of family.siblings) {
      for (const service of sibling.standing.byService) {
        rows.push({
          key: `${sibling.studentId}:${service.feeTypeId}`,
          pupil: sibling.studentName,
          service,
        });
      }
    }

    return rows;
  }, [standing.byService, showSiblings, family, t.treasury.thisPupil]);

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
    <div className="grid gap-4">
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

          {/*
            The breakdown, inside the card the totals are in rather than beside
            it: "what do we still owe" and "on what" are one question asked in
            two breaths, and putting the second in its own card down the page
            made the parent at the desk wait while somebody scrolled.

            The fratrie lands in this same table when the switch above is on —
            one household, one grid to read down — which is why the pupil is a
            column rather than a heading.
          */}
          <ServiceBreakdown
            rows={serviceRows}
            money={money}
            showPupil={showSiblings && hasSiblings}
          />

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

      {/*
      What has already been collected against this child, above the till rather
      than below it: the question at the desk is as often "we paid in October,
      can I have the receipt again" as it is "here is the money". Print works on
      cancelled receipts too, and cancelling is gated on TREASURY_CANCEL — a
      secretary who may take money may not unwrite it.
    */}
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <ReceiptTextIcon className="text-muted-foreground size-4" />
          <h3 className="text-sm font-medium">{t.treasury.receipts}</h3>
          {payments.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {payments.length}
            </Badge>
          ) : null}
        </div>
        <ReceiptsTable payments={payments} canCancel={canCancel} />
      </div>

      {/*
      The till itself, on the pupil's file rather than behind a link to
      /caisse/encaissement. A secretary with a parent at the desk is already
      looking at the child; sending them elsewhere to find the household they
      were just looking at — and then back — was the whole problem.

      Same component as the caisse screen, in its embedded mode: the allocation
      rules and the tender arithmetic have one implementation. See PaymentConsole.
    */}
      {canCollect && familyId && payable ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <BanknoteArrowDownIcon className="text-muted-foreground size-4" />
            <h3 className="text-sm font-medium">{t.treasury.encaissement}</h3>
          </div>
          <PaymentConsole
            // The picker is dropped in this mode — the household is decided by
            // whose file this is.
            families={[]}
            family={payable}
            banks={banks}
            hasOpenSession={hasOpenSession}
            embedded
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * What is owed, charge by charge.
 *
 * A table and not a second set of bars: the desk conversation is about exact
 * dirhams — "the bus is settled, it's the cantine that's short 400" — and a
 * proportion cannot be read out over the phone. The bar above already carries
 * the glance.
 *
 * The pupil column appears only with the fratrie, because with one child every
 * cell in it says the same thing and a column of the same word is a column that
 * has to be read to be discarded. `Reste` is the last and heaviest column: it is
 * the number the whole card exists to produce.
 */
function ServiceBreakdown({
  rows,
  money,
  showPupil,
}: {
  rows: {
    key: string;
    pupil: string;
    service: ServiceStanding;
  }[];
  money: (centimes: number) => string;
  showPupil: boolean;
}) {
  const t = useT();

  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (sum, row) => ({
      charged: sum.charged + row.service.chargedCentimes,
      paid: sum.paid + row.service.paidCentimes,
      outstanding: sum.outstanding + row.service.outstandingCentimes,
    }),
    { charged: 0, paid: 0, outstanding: 0 },
  );

  return (
    <Card className="bg-background/60 gap-0 py-0">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ListTreeIcon className="text-muted-foreground size-3.5" />
        <h4 className="text-xs font-medium">{t.treasury.byService}</h4>
      </div>

      {/* Its own scroller: five money columns on a narrow phone must not push
        the card — and the page behind it — sideways. */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t.treasury.service}</TableHead>
              {showPupil ? <TableHead>{t.treasury.pupil}</TableHead> : null}
              <TableHead className="text-end">{t.treasury.charged}</TableHead>
              <TableHead className="text-end">
                {t.treasury.alreadyPaid}
              </TableHead>
              <TableHead className="text-end">{t.treasury.remaining}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map(({ key, pupil, service }) => (
              <TableRow key={key}>
                <TableCell className="font-medium">
                  {service.feeTypeName}
                </TableCell>
                {showPupil ? (
                  <TableCell className="text-muted-foreground">
                    {pupil}
                  </TableCell>
                ) : null}
                <TableCell className="text-end tabular-nums">
                  {money(service.chargedCentimes)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(service.paidCentimes)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-end font-semibold tabular-nums",
                    // Late is said in colour *and* in the badge above; nothing
                    // here is carried by colour alone.
                    service.overdueCentimes > 0
                      ? "text-destructive"
                      : service.outstandingCentimes === 0
                        ? "text-success"
                        : undefined,
                  )}
                >
                  {service.outstandingCentimes === 0
                    ? t.treasuryOptions.paymentStates.SETTLED
                    : money(service.outstandingCentimes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={showPupil ? 2 : 1}>
                {t.treasury.standingTotal}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {money(totals.charged)}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {money(totals.paid)}
              </TableCell>
              <TableCell className="text-end font-semibold tabular-nums">
                {money(totals.outstanding)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
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
