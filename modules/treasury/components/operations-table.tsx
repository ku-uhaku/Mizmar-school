"use client";

import Link from "next/link";

import { usePathname, useSearchParams } from "next/navigation";

import type { ColumnDef } from "@tanstack/react-table";
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
  ReceiptTextIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shell/empty-state";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocale, useT } from "@/components/providers/i18n-provider";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  cancelOperationAction,
  cancelPaymentAction,
} from "@/modules/treasury/actions";
import { OperationsFilters } from "@/modules/treasury/components/operations-filters";
import type {
  OperationRow,
  OperationsPage,
  PaymentRow,
} from "@/modules/treasury/queries";

/** What the receipts table renders. Aliased so the props read plainly. */
type PaymentSummary = PaymentRow;

/** Moves the ledger's window, keeping every filter already in the URL. */
function OperationsPagination({ page }: { page: OperationsPage }) {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (page.pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">
        {interpolate(t.treasury.operationPage, {
          page: page.page,
          pages: page.pageCount,
        })}
      </span>
      <Button
        asChild={page.page > 1}
        variant="outline"
        size="icon"
        disabled={page.page <= 1}
        aria-label={t.common.previous}
      >
        {page.page > 1 ? (
          <Link href={hrefFor(page.page - 1)}>
            <ChevronLeftIcon className="rtl:rotate-180" />
          </Link>
        ) : (
          <ChevronLeftIcon className="rtl:rotate-180" />
        )}
      </Button>
      <Button
        asChild={page.page < page.pageCount}
        variant="outline"
        size="icon"
        disabled={page.page >= page.pageCount}
        aria-label={t.common.next}
      >
        {page.page < page.pageCount ? (
          <Link href={hrefFor(page.page + 1)}>
            <ChevronRightIcon className="rtl:rotate-180" />
          </Link>
        ) : (
          <ChevronRightIcon className="rtl:rotate-180" />
        )}
      </Button>
    </div>
  );
}

/**
 * The Opérations ledger.
 *
 * Cancelled rows are struck through rather than hidden. A ledger that quietly
 * drops what was undone cannot be reconciled against the receipts a school
 * actually issued, and the correcting entry sitting two rows below is the whole
 * explanation of a total that would otherwise look wrong.
 *
 * ── Why this is not the app's `DataTable` ────────────────────────────────────
 * That component filters, sorts and pages in the browser, which it says of
 * itself is right for a screen holding one organisation's schools and wrong for
 * a table with no ceiling. The ledger is the second such table after the audit
 * trail: it grows by a line per movement, so it was being cut to the newest 200
 * rows and everything older simply disappeared — including, on a school whose
 * receipts carry future dates, a décaissement written this morning. The Cancel
 * action lives on the row, so a movement the ledger could not show was also a
 * movement nobody could correct.
 *
 * Everything is decided on the server now and read from the URL — see
 * `listOperationsPage` and `OperationsFilters`.
 */
export function OperationsTable({
  page,
  canCancel = false,
  filterable = true,
}: {
  page: OperationsPage;
  /** `TREASURY_CANCEL`. Receipts are cancelled from the receipts table instead. */
  canCancel?: boolean;
  /**
   * Off for a list that is already narrowed to one thing — a session's own
   * operations. Filters that wrote to that URL would be silently ignored, which
   * is worse than not offering them.
   */
  filterable?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = React.useState<OperationRow | null>(null);
  const [reason, setReason] = React.useState("");
  const [isCancelling, startCancelling] = React.useTransition();

  // Mirrors `cancelOperationSchema` — the server is the rule, this only saves
  // the bursar discovering it by having the dialog rejected.
  const MIN_REASON = 10;
  const reasonIsUsable = reason.trim().length >= MIN_REASON;

  function closeDialog() {
    setPending(null);
    setReason("");
  }

  function confirmCancel() {
    if (!pending || !reasonIsUsable) return;
    startCancelling(async () => {
      const result = await cancelOperationAction(pending.id, reason.trim());
      if (result.status === "success") {
        toast.success(result.message ?? t.treasury.operationCancelled);
        closeDialog();
        return;
      }
      // Kept open on failure, so the motif just typed is not lost.
      toast.error(result.message ?? t.errors.unexpected);
    });
  }

  // An empty ledger and a filter that matched nothing are different stories,
  // and the difference is only knowable from the URL now that the narrowing
  // happens on the server.
  const searchParams = useSearchParams();
  const isFiltered = ["search", "kind", "method", "from", "to"].some((key) =>
    searchParams.get(key),
  );

  /** True when the row can still be undone from here. */
  const cancellable = (operation: OperationRow) =>
    /*
      Offered on exactly what can be undone here: a movement that still stands,
      is not itself a correcting entry, and is not a receipt — a receipt has
      fees hanging off it, so it is cancelled from the receipts table where the
      family and the sum are named.
    */
    canCancel &&
    operation.status === "POSTED" &&
    !operation.isReversal &&
    !operation.isReversed &&
    operation.paymentId === null;

  const rows = page.rows;

  return (
    <>
      {filterable ? <OperationsFilters /> : null}

      {rows.length === 0 ? (
        <Card className="py-0">
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={
              !filterable || !isFiltered
                ? t.treasury.noOperations
                : t.treasury.noOperationMatches
            }
          />
        </Card>
      ) : (
        <>
          <div className="@container/table bg-card overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.treasury.occurredAt}</TableHead>
                    <TableHead>{t.treasury.kind}</TableHead>
                    <TableHead>{t.treasury.label}</TableHead>
                    <TableHead className="hidden @3xl/table:table-cell">
                      {t.treasury.method}
                    </TableHead>
                    <TableHead className="text-end">{t.treasury.amount}</TableHead>
                    <TableHead className="hidden text-end @2xl/table:table-cell">
                      {t.treasury.cashImpact}
                    </TableHead>
                    <TableHead className="hidden @4xl/table:table-cell">
                      {t.treasury.recordedBy}
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((operation) => (
                    <TableRow
                      key={operation.id}
                      // A reversed movement still happened and still counts toward
                      // the drawer — it is dimmed to explain the correcting entry
                      // below it, never struck out as if it had not occurred.
                      className={cn(
                        (operation.status === "CANCELLED" ||
                          operation.isReversed) &&
                          "text-muted-foreground",
                      )}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(operation.occurredAt, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            operation.kind === "ENCAISSEMENT"
                              ? "default"
                              : operation.kind === "DECAISSEMENT"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {
                            t.treasuryOptions.kinds[
                              operation.kind as keyof typeof t.treasuryOptions.kinds
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <span
                            className={cn(
                              operation.status === "CANCELLED" && "line-through",
                            )}
                          >
                            {operation.label}
                          </span>
                          {operation.beneficiaryName || operation.categoryName ? (
                            <p className="text-muted-foreground truncate text-xs">
                              {[
                                operation.beneficiaryName,
                                operation.categoryName,
                                operation.subcategoryName,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          {operation.isReversal ? (
                            <Badge variant="outline" className="mt-1">
                              {t.treasury.reversalOf}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm @3xl/table:table-cell">
                        {
                          t.treasuryOptions.methods[
                            operation.method as keyof typeof t.treasuryOptions.methods
                          ]
                        }
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {operation.isReversal ? "−" : ""}
                        {formatAmount(operation.amountCentimes, locale)}
                      </TableCell>
                      <TableCell className="hidden text-end tabular-nums @2xl/table:table-cell">
                        {operation.cashImpactCentimes === 0
                          ? "—"
                          : `${operation.cashImpactCentimes > 0 ? "+" : ""}${formatAmount(
                              operation.cashImpactCentimes,
                              locale,
                            )}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs @4xl/table:table-cell">
                        {operation.createdByName}
                      </TableCell>
                      <TableCell>
                        {cancellable(operation) ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t.treasury.cancelOperation}
                              onClick={() => setPending(operation)}
                            >
                              <BanIcon />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
            <span>
              {interpolate(t.treasury.operationCount, { count: page.total })}
            </span>
            <OperationsPagination page={page} />
          </div>
        </>
      )}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isCancelling) closeDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.treasury.cancelOperationTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.treasury.cancelOperationBody, {
                label: pending?.label ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* The sum being undone, stated plainly: the label alone does not tell
              a bursar which of two similar movements is in front of them. */}
          {pending ? (
            <div className="flex items-baseline justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {pending.beneficiaryName ?? pending.categoryName ?? "—"}
              </span>
              <span className="font-medium tabular-nums">
                {formatAmount(pending.amountCentimes, locale)}
              </span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="cancel-operation-reason">
              {t.treasury.cancelReasonLabel}
            </Label>
            <Textarea
              id="cancel-operation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t.treasury.cancelReasonPlaceholder}
              rows={3}
              maxLength={300}
              disabled={isCancelling}
              aria-describedby="cancel-operation-hint"
              autoFocus
            />
            <p
              id="cancel-operation-hint"
              className="text-xs text-muted-foreground"
            >
              {t.treasury.cancelReasonHint}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmCancel();
              }}
              disabled={isCancelling || !reasonIsUsable}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isCancelling ? t.common.saving : t.treasury.cancelOperation}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The receipts list.
 *
 * Cancelling is handled in here rather than through a callback prop: this is
 * rendered from a Server Component, which cannot hand a function across the
 * boundary. The confirmation is not ceremony — cancelling puts money back on a
 * family's account, and the dialog names the receipt it is about to undo.
 */
export function ReceiptsTable({
  payments,
  canCancel,
}: {
  payments: PaymentSummary[];
  canCancel: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = React.useState<PaymentSummary | null>(null);
  const [reason, setReason] = React.useState("");
  const [isCancelling, startCancelling] = React.useTransition();

  // Mirrors `cancelPaymentSchema`. The server is the rule; this only stops the
  // cashier discovering the rule by having the dialog rejected.
  const MIN_REASON = 10;
  const reasonIsUsable = reason.trim().length >= MIN_REASON;

  function closeDialog() {
    setPending(null);
    setReason("");
  }

  function confirmCancel() {
    if (!pending || !reasonIsUsable) return;
    startCancelling(async () => {
      const result = await cancelPaymentAction(pending.id, reason.trim());
      if (result.status === "success") {
        toast.success(result.message ?? t.treasury.paymentCancelled);
        closeDialog();
        return;
      }
      // Kept open on failure: the motif the cashier just typed is the one thing
      // in this dialog that is expensive to retype, and a closed dialog loses it.
      toast.error(result.message ?? t.errors.unexpected);
    });
  }

  const columns = React.useMemo<ColumnDef<PaymentSummary, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t.treasury.receipt,
        cell: ({ row }) => {
          const payment = row.original;
          if (payment.status !== "CANCELLED") {
            return <span className="font-medium">{payment.code}</span>;
          }

          // A struck-out receipt used to say only that it was struck out. The
          // motif and the name travel on the row, so the answer to "who did
          // this and why" is a hover away instead of a trip to whoever was on
          // the desk that morning.
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium line-through decoration-destructive/60 underline-offset-2 cursor-help">
                  {payment.code}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs space-y-1">
                <p className="font-medium">{t.treasury.cancellationTrail}</p>
                {payment.cancelReason ? (
                  <p className="text-xs">{payment.cancelReason}</p>
                ) : null}
                <p className="text-xs opacity-80">
                  {payment.cancelledByName ?? "—"}
                  {payment.cancelledAt
                    ? ` · ${formatDate(payment.cancelledAt, locale)}`
                    : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "family",
        accessorFn: (row) => row.familyName ?? "",
        header: t.treasury.family,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.familyName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "paidAt",
        header: t.treasury.paidAt,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.paidAt, locale)}
          </span>
        ),
      },
      {
        id: "method",
        // A receipt can be settled with more than one method; the joined string
        // is what the facet matches on, so "CASH + CHEQUE" is its own value.
        accessorFn: (row) => row.methods.join(" + "),
        header: t.treasury.method,
        meta: { className: "hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.methods
              .map(
                (method) =>
                  t.treasuryOptions.methods[
                    method as keyof typeof t.treasuryOptions.methods
                  ],
              )
              .join(" + ")}
          </span>
        ),
      },
      {
        accessorKey: "totalCentimes",
        header: t.treasury.amount,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span
            className={cn(
              "tabular-nums",
              row.original.status === "CANCELLED" && "line-through",
            )}
          >
            {formatAmount(row.original.totalCentimes, locale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const payment = row.original;
          const cancelled = payment.status === "CANCELLED";

          return (
            <div className="flex justify-end gap-1">
              {/* Offered on cancelled receipts too: somebody holding the paper
                  copy needs to be able to reprint it and see the void stamped
                  across it. */}
              <Button asChild variant="ghost" size="icon-sm">
                <Link
                  href={`/print/payment/${payment.id}`}
                  aria-label={t.print.receipt}
                >
                  <PrinterIcon />
                </Link>
              </Button>
              {canCancel && !cancelled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.treasury.cancelPayment}
                  onClick={() => setPending(payment)}
                >
                  <BanIcon />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, locale, canCancel],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={payments}
        pageSize={20}
        rowClassName={(payment) =>
          payment.status === "CANCELLED" ? "text-muted-foreground" : undefined
        }
        emptyState={
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={t.treasury.noReceipts}
          />
        }
      />

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isCancelling) closeDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.treasury.cancelPaymentTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.treasury.cancelPaymentBody, {
                code: pending?.code ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* The sum being put back, stated plainly. The receipt code alone does
              not tell a cashier which of two similar receipts is in front of
              them, and this is the number the family will hear about. */}
          {pending ? (
            <div className="flex items-baseline justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {pending.familyName ?? "—"}
              </span>
              <span className="font-medium tabular-nums">
                {formatAmount(pending.totalCentimes, locale)}
              </span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              {t.treasury.cancelReasonLabel}
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t.treasury.cancelReasonPlaceholder}
              rows={3}
              maxLength={300}
              disabled={isCancelling}
              aria-describedby="cancel-reason-hint"
              // Autofocus is right here and wrong on most dialogs: the note is
              // the only thing to fill in, and the cashier has a parent waiting.
              autoFocus
            />
            <p
              id="cancel-reason-hint"
              className="text-xs text-muted-foreground"
            >
              {t.treasury.cancelReasonHint}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Cancelling is async; letting the dialog close itself would
                // unmount the transition before the toast lands.
                event.preventDefault();
                confirmCancel();
              }}
              disabled={isCancelling || !reasonIsUsable}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isCancelling ? t.common.saving : t.treasury.cancelPayment}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
