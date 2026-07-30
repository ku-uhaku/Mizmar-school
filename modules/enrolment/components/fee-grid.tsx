"use client";

import * as React from "react";
import { MousePointerClickIcon, RefreshCwIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { centimesToDirhams } from "@/modules/classes/enums";
import { regenerateFeesAction } from "@/modules/enrolment/actions";
import { FeeCellDialog } from "@/modules/enrolment/components/fee-cell-dialog";
import type {
  FeeCell,
  FeeGrid as FeeGridData,
  FeeGridRow,
} from "@/modules/enrolment/queries";

/**
 * The échéancier as the bursar reads it: charges down the side, months across
 * the top, what is payable in the cell.
 *
 * A grid rather than a list of lines because the question asked of it is
 * two-dimensional — "what does this family pay in January", "what does the bus
 * cost over the year" — and a flat list answers neither without arithmetic.
 * Clicking a cell opens the one place an amount or a reduction is changed.
 *
 * Totals come from the server (see `loadFeeGrid`) rather than being re-added
 * here: two implementations of the same sum eventually disagree, and this one
 * is a parent's bill.
 */
export function FeeGrid({
  grid,
  enrollmentId,
  discounts,
  canManage,
}: {
  grid: FeeGridData;
  enrollmentId: string;
  discounts: {
    id: string;
    code: string;
    name: string;
    kind: string;
    percentBps: number | null;
    amountCentimes: number | null;
  }[];
  canManage: boolean;
}) {
  const { t, locale } = useI18n();
  // The row is carried alongside the cell so the dialog can be told how many
  // later instalments of the *same charge* a reduction could be carried to.
  const [editing, setEditing] = React.useState<{
    cell: FeeCell;
    followingCount: number;
  } | null>(null);
  const [rebuilding, setRebuilding] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run(replace: boolean) {
    startTransition(async () => {
      const result = await regenerateFeesAction(enrollmentId, replace);
      if (result.status === "success") {
        toast.success(result.message ?? t.enrolment.feesGenerated);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
      setRebuilding(false);
    });
  }

  const money = (centimes: number) =>
    formatNumber(centimesToDirhams(centimes), locale);

  if (grid.rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<WalletIcon className="size-5" />}
            title={t.enrolment.feesEmpty}
            description={t.enrolment.feesEmptyHint}
            action={
              canManage ? (
                <Button size="sm" onClick={() => run(false)} disabled={pending}>
                  <RefreshCwIcon className={cn(pending && "animate-spin")} />
                  {t.enrolment.generateFees}
                </Button>
              ) : undefined
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b">
        <div className="min-w-0">
          <CardTitle>{t.enrolment.fees}</CardTitle>
          <CardDescription>{t.enrolment.feesSubtitle}</CardDescription>
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(false)}
              disabled={pending}
            >
              <RefreshCwIcon className={cn(pending && "animate-spin")} />
              {t.enrolment.generateFees}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRebuilding(true)}
              disabled={pending}
            >
              {t.enrolment.rebuildFees}
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {/* The grid scrolls on its own; the page never scrolls sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th
                  scope="col"
                  className="bg-card sticky start-0 z-10 min-w-44 px-4 py-2.5 text-start text-xs font-medium tracking-wide uppercase"
                >
                  {t.enrolment.feeType}
                </th>
                {grid.months.map((month) => (
                  <th
                    key={month.key}
                    scope="col"
                    className="text-muted-foreground min-w-24 px-2 py-2.5 text-center text-xs font-medium"
                  >
                    <span className="block">
                      {
                        t.enrolmentOptions.months[
                          String(
                            month.month,
                          ) as keyof typeof t.enrolmentOptions.months
                        ]
                      }
                    </span>
                    <span className="block text-[10px] tabular-nums opacity-70">
                      {month.year}
                    </span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="min-w-28 px-4 py-2.5 text-end text-xs font-medium tracking-wide uppercase"
                >
                  {t.enrolment.rowTotal}
                </th>
              </tr>
            </thead>

            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.feeTypeId} className="border-b last:border-0">
                  <th
                    scope="row"
                    className="bg-card sticky start-0 z-10 px-4 py-2 text-start font-normal"
                  >
                    <span className="block truncate font-medium">
                      {row.name}
                    </span>
                    <span
                      className="text-muted-foreground block truncate text-xs"
                      dir="ltr"
                    >
                      {row.code}
                    </span>
                  </th>

                  {grid.months.map((month) => {
                    const cells = row.cells[month.key] ?? [];

                    if (cells.length === 0) {
                      return (
                        <td
                          key={month.key}
                          className="text-muted-foreground/40 px-2 py-2 text-center"
                        >
                          {t.enrolment.noCharge}
                        </td>
                      );
                    }

                    return (
                      <td key={month.key} className="px-1 py-1 align-middle">
                        <div className="flex flex-col gap-1">
                          {cells.map((cell) => (
                            <FeeCellButton
                              key={cell.id}
                              cell={cell}
                              money={money}
                              canManage={canManage}
                              onEdit={() =>
                                setEditing({
                                  cell,
                                  followingCount: followingDueCount(row, cell),
                                })
                              }
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-4 py-2 text-end font-medium tabular-nums">
                    {money(row.totalCentimes)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="bg-muted/40 border-t">
                <th
                  scope="row"
                  className="bg-muted/40 sticky start-0 z-10 px-4 py-2.5 text-start text-xs font-medium tracking-wide uppercase"
                >
                  {t.enrolment.monthTotal}
                </th>
                {grid.months.map((month) => (
                  <td
                    key={month.key}
                    className="px-2 py-2.5 text-center text-xs font-medium tabular-nums"
                  >
                    {grid.monthTotals[month.key]
                      ? money(grid.monthTotals[month.key])
                      : "—"}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-end font-semibold tabular-nums">
                  {money(grid.grandTotalCentimes)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* What the colours mean, and that a cell is clickable at all. A grid
            this dense reads as a report unless it says otherwise. */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs">
          {canManage ? (
            <span className="flex items-center gap-1.5">
              <MousePointerClickIcon className="size-3.5" />
              {t.enrolment.legendClick}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="bg-primary/10 size-3 rounded-sm" />
            {t.enrolment.legendReduced}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="line-through">
              000
            </span>
            {t.enrolment.legendNotDue}
          </span>
        </div>

        <dl className="grid gap-2 border-t px-4 py-3 text-sm sm:grid-cols-3">
          <Total
            label={t.enrolment.beforeDiscount}
            value={`${money(grid.baseGrandTotalCentimes)} MAD`}
          />
          <Total
            label={t.enrolment.totalDiscount}
            value={`− ${money(grid.discountTotalCentimes)} MAD`}
          />
          <Total
            label={t.enrolment.grandTotal}
            value={`${money(grid.grandTotalCentimes)} MAD`}
            strong
          />
        </dl>
      </CardContent>

      {canManage && editing ? (
        <FeeCellDialog
          // Remounted per cell so its inputs start from that cell's figures.
          key={editing.cell.id}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          cell={editing.cell}
          discounts={discounts}
          followingCount={editing.followingCount}
        />
      ) : null}

      <AlertDialog open={rebuilding} onOpenChange={setRebuilding}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.enrolment.rebuildTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.enrolment.rebuildBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                run(true);
              }}
              disabled={pending}
            >
              {t.enrolment.rebuildFees}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/**
 * Later instalments of the same charge that a reduction could be carried to.
 *
 * Counted from the row the cell sits in rather than fetched, so the dialog can
 * say "and the 6 months after it" the moment the cell is clicked. Only DUE
 * lines count — `repriceFollowingLines` skips the rest for the same reason.
 */
function followingDueCount(row: FeeGridRow, cell: FeeCell): number {
  return Object.values(row.cells)
    .flat()
    .filter(
      (other) => other.periodIndex > cell.periodIndex && other.status === "DUE",
    ).length;
}

/**
 * One amount in the grid. A button rather than a cell with an edit icon: the
 * whole cell is the target, which is what makes a dense grid usable.
 */
function FeeCellButton({
  cell,
  money,
  canManage,
  onEdit,
}: {
  cell: FeeCell;
  money: (centimes: number) => string;
  canManage: boolean;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const reduced = cell.amountCentimes < cell.baseAmountCentimes;
  const inactive = cell.status !== "DUE";

  const content = (
    <>
      <span
        className={cn(
          "block tabular-nums",
          inactive && "line-through opacity-60",
        )}
      >
        {money(cell.amountCentimes)}
      </span>
      {reduced && !inactive ? (
        <span className="text-muted-foreground block text-[10px] tabular-nums line-through">
          {money(cell.baseAmountCentimes)}
        </span>
      ) : null}
      {inactive ? (
        <span className="text-muted-foreground block text-[10px]">
          {
            t.enrolmentOptions.lineStatuses[
              cell.status as keyof typeof t.enrolmentOptions.lineStatuses
            ]
          }
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "w-full rounded-md px-2 py-1.5 text-center text-sm transition-colors",
    reduced && !inactive && "bg-primary/10 text-primary font-medium",
    !reduced && !inactive && "hover:bg-muted",
    inactive && "text-muted-foreground",
  );

  if (!canManage) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        className,
        "hover:bg-muted focus-visible:ring-ring/50 cursor-pointer focus-visible:ring-3 focus-visible:outline-none",
      )}
      aria-label={interpolate(t.enrolment.instalment, {
        index: cell.periodIndex,
      })}
    >
      {content}
    </button>
  );
}

function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 sm:block">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
        )}
        dir="ltr"
      >
        {value}
      </dd>
    </div>
  );
}
