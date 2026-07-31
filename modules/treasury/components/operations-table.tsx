"use client";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { BanIcon, PrinterIcon, ReceiptTextIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { EmptyState } from "@/components/shell/empty-state";
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
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { cancelPaymentAction } from "@/modules/treasury/actions";
import { OPERATION_KINDS, PAYMENT_METHODS } from "@/modules/treasury/enums";
import type { OperationRow, PaymentRow } from "@/modules/treasury/queries";

/** What the receipts table renders. Aliased so the props read plainly. */
type PaymentSummary = PaymentRow;

/**
 * The Opérations ledger.
 *
 * Cancelled rows are struck through rather than hidden. A ledger that quietly
 * drops what was undone cannot be reconciled against the receipts a school
 * actually issued, and the correcting entry sitting two rows below is the whole
 * explanation of a total that would otherwise look wrong.
 */
export function OperationsTable({
  operations,
}: {
  operations: OperationRow[];
}) {
  const t = useT();
  const locale = useLocale();

  const columns = React.useMemo<ColumnDef<OperationRow, unknown>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: t.treasury.occurredAt,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.occurredAt, locale)}
          </span>
        ),
      },
      {
        accessorKey: "kind",
        header: t.treasury.kind,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.kind === "ENCAISSEMENT"
                ? "default"
                : row.original.kind === "DECAISSEMENT"
                  ? "destructive"
                  : "secondary"
            }
          >
            {
              t.treasuryOptions.kinds[
                row.original.kind as keyof typeof t.treasuryOptions.kinds
              ]
            }
          </Badge>
        ),
      },
      {
        id: "label",
        // The beneficiary and the category are searched on but not shown as
        // their own columns — the ledger is read down the label.
        accessorFn: (row) =>
          `${row.label} ${row.beneficiaryName ?? ""} ${row.categoryName ?? ""} ${
            row.subcategoryName ?? ""
          } ${row.reference ?? ""}`,
        header: t.treasury.label,
        cell: ({ row }) => {
          const operation = row.original;
          return (
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
          );
        },
      },
      {
        accessorKey: "method",
        header: t.treasury.method,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm">
            {
              t.treasuryOptions.methods[
                row.original.method as keyof typeof t.treasuryOptions.methods
              ]
            }
          </span>
        ),
      },
      {
        accessorKey: "amountCentimes",
        header: t.treasury.amount,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.isReversal ? "−" : ""}
            {formatAmount(row.original.amountCentimes, locale)}
          </span>
        ),
      },
      {
        accessorKey: "cashImpactCentimes",
        header: t.treasury.cashImpact,
        meta: { className: "text-end hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.cashImpactCentimes === 0
              ? "—"
              : `${row.original.cashImpactCentimes > 0 ? "+" : ""}${formatAmount(
                  row.original.cashImpactCentimes,
                  locale,
                )}`}
          </span>
        ),
      },
      {
        accessorKey: "createdByName",
        header: t.treasury.recordedBy,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.createdByName}
          </span>
        ),
      },
    ],
    [t, locale],
  );

  /*
    The kind filter used to be a row of tabs, which could only ever answer one
    kind at a time. As a facet it is multi-select, so "encaissements and
    remboursements, nothing else" is one filter rather than two passes — and the
    method and status facets come free beside it.
  */
  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "kind",
        label: t.treasury.kind,
        options: OPERATION_KINDS.map((option) => ({
          value: option,
          label: t.treasuryOptions.kinds[option],
        })),
      },
      {
        columnId: "method",
        label: t.treasury.method,
        options: PAYMENT_METHODS.map((method) => ({
          value: method,
          label: t.treasuryOptions.methods[method],
        })),
      },
    ],
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={operations}
      facets={facets}
      pageSize={20}
      // A reversed movement still happened and still counts toward the drawer —
      // it is dimmed to explain the correcting entry below it, never struck out
      // as if it had not occurred.
      rowClassName={(operation) =>
        operation.status === "CANCELLED" || operation.isReversed
          ? "text-muted-foreground"
          : undefined
      }
      emptyState={
        <EmptyState
          icon={<ReceiptTextIcon className="size-5" />}
          title={t.treasury.noOperations}
        />
      }
    />
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
  const [isCancelling, startCancelling] = React.useTransition();

  function confirmCancel() {
    if (!pending) return;
    startCancelling(async () => {
      const result = await cancelPaymentAction(pending.id, null);
      if (result.status === "success") {
        toast.success(result.message ?? t.treasury.paymentCancelled);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
      setPending(null);
    });
  }

  const columns = React.useMemo<ColumnDef<PaymentSummary, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t.treasury.receipt,
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium",
              row.original.status === "CANCELLED" && "line-through",
            )}
          >
            {row.original.code}
          </span>
        ),
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
          if (!open) setPending(null);
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
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Cancelling is async; letting the dialog close itself would
                // unmount the transition before the toast lands.
                event.preventDefault();
                confirmCancel();
              }}
              disabled={isCancelling}
            >
              {t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
