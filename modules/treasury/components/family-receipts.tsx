"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { PrinterIcon, ReceiptTextIcon } from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { PaymentRow } from "@/modules/treasury/queries";

/**
 * Every receipt written for one household this year.
 *
 * On the dossier rather than only on each child's file because that is where
 * the question is asked: a parent at the desk says "j'ai payé en novembre", and
 * the answer is a receipt made out to the *household*, which may have settled
 * three children's instalments at once. The per-pupil breakdown stays on each
 * child's own payment tab, where it belongs.
 *
 * Cancelled receipts are shown, struck through rather than hidden: a voided
 * receipt still has a number somebody is holding a copy of, and a list that
 * silently dropped it could not explain the gap in the sequence.
 */
export function FamilyReceipts({ receipts }: { receipts: PaymentRow[] }) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();

  const money = React.useCallback(
    (centimes: number) => formatMoney(centimes, locale, currency),
    [locale, currency],
  );

  const columns = React.useMemo<ColumnDef<PaymentRow, unknown>[]>(
    () => [
      {
        id: "code",
        accessorFn: (row) => row.code,
        header: t.treasury.receiptNumber,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              row.original.status === "CANCELLED" &&
                "text-muted-foreground line-through",
            )}
            dir="ltr"
          >
            {row.original.code}
          </span>
        ),
      },
      {
        id: "paidAt",
        accessorFn: (row) => row.paidAt,
        header: t.treasury.paidAt,
        cell: ({ row }) => (
          <span className="text-sm" dir="ltr">
            {formatDate(new Date(row.original.paidAt), locale)}
          </span>
        ),
      },
      {
        id: "amount",
        accessorFn: (row) => row.totalCentimes,
        header: t.treasury.amount,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              row.original.status === "CANCELLED" &&
                "text-muted-foreground line-through",
            )}
          >
            {money(row.original.totalCentimes)}
          </span>
        ),
      },
      {
        id: "method",
        accessorFn: (row) => row.methods.join(" "),
        header: t.treasury.method,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.methods.map((method) => (
              <Badge key={method} variant="outline" className="text-[10px]">
                {t.treasuryOptions.methods[
                  method as keyof typeof t.treasuryOptions.methods
                ] ?? method}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "lines",
        accessorFn: (row) => row.allocationCount,
        header: t.treasury.settledLines,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {row.original.allocationCount}
          </span>
        ),
      },
      {
        id: "takenBy",
        accessorFn: (row) => row.createdByName,
        header: t.treasury.takenBy,
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate text-xs">
            {row.original.createdByName}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: t.treasury.standing,
        cell: ({ row }) =>
          row.original.status === "CANCELLED" ? (
            <Badge variant="destructive">{t.treasury.cancelled}</Badge>
          ) : (
            <Badge className="bg-success text-background hover:bg-success">
              {t.treasury.posted}
            </Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            {/* The full receipt: every line it settled, which child, which
              month — and the browser's own "Save as PDF" behind the print
              dialog. Offered on cancelled receipts too, because somebody
              holding the paper copy needs to look it up and be told it was
              undone. */}
            <Button asChild variant="ghost" size="icon-sm">
              <Link
                href={`/print/payment/${row.original.id}`}
                aria-label={t.print.receipt}
                title={t.print.receipt}
              >
                <PrinterIcon />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t, locale, money],
  );

  if (receipts.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptTextIcon />}
        title={t.treasury.noReceipts}
        description={t.treasury.noReceiptsHint}
      />
    );
  }

  // Cancelled receipts are shown but never counted: the money went back.
  const collected = receipts
    .filter((receipt) => receipt.status !== "CANCELLED")
    .reduce((sum, receipt) => sum + receipt.totalCentimes, 0);

  return (
    <div className="grid gap-4">
      <div className="bg-card ring-foreground/10 flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1">
        <ReceiptTextIcon className="text-muted-foreground size-5" />
        <div className="flex-1">
          <p className="text-muted-foreground text-xs">
            {t.treasury.collected}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {money(collected)}
          </p>
        </div>
        <span className="text-muted-foreground text-xs">
          {interpolate(t.treasury.receiptCount, { count: receipts.length })}
        </span>
      </div>

      <DataTable data={receipts} columns={columns} />
    </div>
  );
}
