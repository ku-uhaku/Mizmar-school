"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { LayersIcon, SettingsIcon } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { ClassRow } from "@/modules/classes/queries";

/**
 * The classes of the year, with how full each one is.
 *
 * Fill is the column that matters: a director opens this screen to find the
 * class with room in it, so the number is shown against its cap rather than on
 * its own.
 */
export function ClassesManager({ classes }: { classes: ClassRow[] }) {
  const { t, locale } = useI18n();

  const columns = React.useMemo<ColumnDef<ClassRow, unknown>[]>(
    () => [
      {
        id: "class",
        // Everything a reader might type: the code, the class's own name, the
        // level in short form and in both languages, and the cycle. The box is
        // a single `includesString` pass over the accessor values, so a name
        // that is not in one of them is a name the search cannot find.
        accessorFn: (row) =>
          `${row.code} ${row.name ?? ""} ${row.levelLabel} ${row.levelOptionLabel} ${row.cycleName}`,
        header: t.schoolClass.classColumn,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/classes/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.code}
            </Link>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.name ?? row.original.levelName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "levelLabel",
        header: t.schoolClass.level,
        // The code stays the badge — it is what a school talks in and what the
        // filter matches on — with both names under it, since half the staff
        // read the niveau in Arabic and the code alone says nothing to a parent.
        cell: ({ row }) => (
          <div className="min-w-0">
            <Badge variant="secondary">{row.original.levelLabel}</Badge>
            <p className="text-muted-foreground mt-1 truncate text-xs">
              {row.original.levelNameLabel}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "cycleName",
        header: t.schoolClass.cycle,
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate text-sm">
            {row.original.cycleName}
          </span>
        ),
      },
      {
        id: "fill",
        accessorFn: (row) => row.enrolled,
        header: t.schoolClass.enrolled,
        cell: ({ row }) => {
          const { enrolled, capacity } = row.original;
          const over = capacity !== null && enrolled > capacity;

          return (
            <span
              className={cn(
                "tabular-nums",
                over && "text-destructive font-medium",
              )}
              dir="ltr"
            >
              {capacity === null
                ? formatNumber(enrolled, locale)
                : interpolate(t.schoolClass.fill, { enrolled, capacity })}
            </span>
          );
        },
      },
      {
        accessorKey: "mainTeacherName",
        header: t.schoolClass.mainTeacher,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.mainTeacherName ?? (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "roomCode",
        header: t.schoolClass.room,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) =>
          row.original.roomCode ? (
            <span dir="ltr">{row.original.roomCode}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "assignmentCount",
        header: t.schoolClass.teaching,
        meta: { className: "hidden @5xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.assignmentCount, locale)}
          </span>
        ),
      },
      {
        accessorKey: "timetableCount",
        header: t.schoolClass.lessons,
        meta: { className: "hidden @5xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.timetableCount, locale)}
          </span>
        ),
      },
    ],
    [t, locale],
  );

  const facets = React.useMemo<FacetDef[]>(() => {
    /*
      One option per level, in the order the rows arrive — which the query
      sorts by cycle then by year, so the headings the filter draws stay
      contiguous. `value` remains the short code, because that is what the
      column holds and therefore what the filter compares against; only the
      label reads in both languages.
    */
    const levels = new Map<string, { value: string; label: string; group: string }>();
    for (const schoolClass of classes) {
      if (levels.has(schoolClass.levelLabel)) continue;
      levels.set(schoolClass.levelLabel, {
        value: schoolClass.levelLabel,
        label: schoolClass.levelOptionLabel,
        group: schoolClass.cycleName,
      });
    }

    const cycles = [...new Set(classes.map((schoolClass) => schoolClass.cycleName))];

    return [
      ...(cycles.length > 1
        ? [
            {
              columnId: "cycleName",
              label: t.schoolClass.cycle,
              options: cycles.map((cycle) => ({ value: cycle, label: cycle })),
            },
          ]
        : []),
      ...(levels.size > 1
        ? [
            {
              columnId: "levelLabel",
              label: t.schoolClass.level,
              options: [...levels.values()],
            },
          ]
        : []),
    ];
  }, [classes, t]);

  const configureButton = (
    <Button asChild variant="outline">
      <Link href="/configuration/classes/classes">
        <SettingsIcon />
        {t.configuration.title}
      </Link>
    </Button>
  );

  return (
    <DataTable
      columns={columns}
      data={classes}
      searchPlaceholder={t.schoolClass.searchPlaceholder}
      facets={facets}
      pageSize={15}
      emptyState={
        <EmptyState
          icon={<LayersIcon className="size-5" />}
          title={t.schoolClass.noClasses}
          description={t.schoolClass.noClassesHint}
          action={configureButton}
        />
      }
      toolbar={configureButton}
    />
  );
}
