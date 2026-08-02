"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { UsersIcon, WalletIcon } from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { FamilyPaymentRow } from "@/modules/treasury/queries";

/**
 * La situation des familles: what every household of the year has been charged,
 * what it has paid, and what it is actually behind on.
 *
 * ── Two different numbers, and only one of them is a problem ────────────────
 * `outstanding` is what is left to pay over the year — nine instalments means
 * every family owes most of it in September, and none of them is late. `overdue`
 * is the part whose due date has passed, and that is the column a bursar chases.
 * Showing only the first would put the whole school on the chasing list on the
 * first day of term; showing only the second would hide what the year is worth.
 *
 * The status facet is derived rather than stored, for the same reason a pupil's
 * parcours is: a flag that can disagree with the schedule lines underneath it is
 * worse than no flag.
 */
export function FamilyPayments({ families }: { families: FamilyPaymentRow[] }) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();

  const money = React.useCallback(
    (centimes: number) => formatMoney(centimes, locale, currency),
    [locale, currency],
  );

  /** Where a household stands, in one word. */
  const statusOf = React.useCallback((row: FamilyPaymentRow) => {
    if (row.overdueCentimes > 0) return "LATE";
    if (row.chargedCentimes === 0) return "NOTHING_DUE";
    if (row.outstandingCentimes === 0) return "SETTLED";
    return "ON_TRACK";
  }, []);

  const columns = React.useMemo<ColumnDef<FamilyPaymentRow, unknown>[]>(
    () => [
      {
        id: "family",
        accessorFn: (row) => `${row.familyName} ${row.familyCode}`,
        header: t.treasury.beneficiaryName,
        cell: ({ row }) => (
          <Link
            href={`/families/${row.original.familyId}`}
            className="hover:text-primary block min-w-0"
          >
            <p className="truncate text-sm font-medium">
              {row.original.familyName}
            </p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.original.familyCode}
              {row.original.phone ? ` · ${row.original.phone}` : ""}
            </p>
          </Link>
        ),
      },
      {
        id: "children",
        accessorFn: (row) => row.childCount,
        header: t.treasury.enrolledChildren,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {row.original.childCount}
          </span>
        ),
      },
      {
        id: "charged",
        accessorFn: (row) => row.chargedCentimes,
        header: t.treasury.charged,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {money(row.original.chargedCentimes)}
          </span>
        ),
      },
      {
        id: "paid",
        accessorFn: (row) => row.paidCentimes,
        header: t.treasury.collected,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {money(row.original.paidCentimes)}
          </span>
        ),
      },
      {
        id: "outstanding",
        accessorFn: (row) => row.outstandingCentimes,
        header: t.treasury.outstanding,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {money(row.original.outstandingCentimes)}
          </span>
        ),
      },
      {
        id: "overdue",
        accessorFn: (row) => row.overdueCentimes,
        header: t.treasury.overdue,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm tabular-nums",
              row.original.overdueCentimes > 0
                ? "text-destructive font-medium"
                : "text-muted-foreground",
            )}
          >
            {money(row.original.overdueCentimes)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => statusOf(row),
        header: t.treasury.standing,
        cell: ({ row }) => {
          const status = statusOf(row.original);
          return (
            <Badge
              variant={
                status === "LATE"
                  ? "destructive"
                  : status === "SETTLED"
                    ? "secondary"
                    : "outline"
              }
              className={cn(
                status === "SETTLED" &&
                  "bg-success text-background hover:bg-success",
              )}
            >
              {
                t.treasuryOptions.familyStandings[
                  status as keyof typeof t.treasuryOptions.familyStandings
                ]
              }
            </Badge>
          );
        },
      },
      {
        id: "lastPaid",
        accessorFn: (row) => row.lastPaidAt ?? "",
        header: t.treasury.lastPaid,
        cell: ({ row }) =>
          row.original.lastPaidAt ? (
            <span className="text-muted-foreground text-xs" dir="ltr">
              {formatDate(new Date(row.original.lastPaidAt), locale)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
    ],
    [t, locale, money, statusOf],
  );

  const facets: FacetDef[] = [
    {
      columnId: "status",
      label: t.treasury.standing,
      options: (["LATE", "ON_TRACK", "SETTLED", "NOTHING_DUE"] as const).map(
        (status) => ({
          value: status,
          label: t.treasuryOptions.familyStandings[status],
        }),
      ),
    },
  ];

  // The three figures a director asks for before opening any one household.
  const totals = families.reduce(
    (sum, row) => ({
      charged: sum.charged + row.chargedCentimes,
      paid: sum.paid + row.paidCentimes,
      overdue: sum.overdue + row.overdueCentimes,
      late: sum.late + (row.overdueCentimes > 0 ? 1 : 0),
    }),
    { charged: 0, paid: 0, overdue: 0, late: 0 },
  );

  if (families.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon />}
        title={t.treasury.noFamilies}
        description={t.treasury.noFamiliesHint}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label={t.treasury.charged} value={money(totals.charged)} />
        <Tile label={t.treasury.collected} value={money(totals.paid)} />
        <Tile
          label={t.treasury.outstanding}
          value={money(Math.max(0, totals.charged - totals.paid))}
        />
        <Tile
          label={t.treasury.overdue}
          value={money(totals.overdue)}
          hint={interpolate(t.treasury.familiesLate, { count: totals.late })}
          alarming={totals.overdue > 0}
        />
      </div>

      <DataTable data={families} columns={columns} facets={facets} />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  alarming,
}: {
  label: string;
  value: string;
  hint?: string;
  alarming?: boolean;
}) {
  return (
    <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <WalletIcon className="size-3.5" />
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          alarming && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
