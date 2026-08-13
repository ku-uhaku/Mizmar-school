"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon, HistoryIcon } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/empty-state";
import { formatDateTime, formatMoney } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { SessionRow } from "@/modules/treasury/queries";

/**
 * Every opening of every till, closed or still open — the record `listSessions`
 * has always kept but nothing rendered until now. A "Détails" link per row is
 * the way in to the full breakdown (and its printable version): this table is
 * deliberately just the roster, not the drawer's contents.
 */
export function SessionsHistory({ sessions }: { sessions: SessionRow[] }) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();

  const columns = React.useMemo<ColumnDef<SessionRow, unknown>[]>(
    () => [
      {
        accessorKey: "registerName",
        header: t.treasury.register,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.registerName}</span>
        ),
      },
      {
        accessorKey: "openedAt",
        header: t.treasury.openedAt,
        cell: ({ row }) => (
          <div className="text-sm">
            <div className="whitespace-nowrap">
              {formatDateTime(row.original.openedAt, locale)}
            </div>
            <div className="text-muted-foreground text-xs">
              {row.original.openedByName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "closedAt",
        header: t.treasury.closedAt,
        cell: ({ row }) =>
          row.original.closedAt ? (
            <div className="text-sm">
              <div className="whitespace-nowrap">
                {formatDateTime(row.original.closedAt, locale)}
              </div>
              <div className="text-muted-foreground text-xs">
                {row.original.wasAutoClosed
                  ? t.treasury.sessionAutoClosed
                  : row.original.closedByName}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "varianceCentimes",
        header: t.treasury.variance,
        meta: { className: "text-end" },
        cell: ({ row }) => {
          const variance = row.original.varianceCentimes;
          if (variance === null) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className={cn(
                "tabular-nums",
                variance < 0 && "text-destructive",
                variance > 0 && "text-amber-600 dark:text-amber-500",
              )}
            >
              {formatMoney(variance, locale, currency)}
            </span>
          );
        },
      },
      {
        accessorKey: "operationCount",
        header: t.treasury.operations,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.operationCount}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t.treasury.status,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "OPEN" ? "default" : "outline"}>
            {
              t.treasuryOptions.sessionStatuses[
                row.original.status as keyof typeof t.treasuryOptions.sessionStatuses
              ]
            }
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/caisse/registers/sessions/${row.original.id}`}>
                <EyeIcon />
                {t.treasury.sessionDetails}
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t, locale, currency],
  );

  return (
    <DataTable
      columns={columns}
      data={sessions}
      emptyState={
        <EmptyState
          icon={<HistoryIcon className="size-5" />}
          title={t.treasury.noSessions}
        />
      }
    />
  );
}
