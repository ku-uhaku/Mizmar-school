"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheckIcon } from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  markAttendanceAction,
  markDayInBulkAction,
} from "@/modules/hr/actions";
import { ATTENDANCE_STATUSES, isChargeableAbsence } from "@/modules/hr/enums";
import type { RegisterEntry } from "@/modules/hr/queries";
import { useToastedTransition } from "@/modules/hr/components/field";

/** "Not marked yet" as a facet value — see the note on the status column. */
const UNMARKED = "__unmarked__";

/**
 * Le pointage: one day, everybody, marked in place.
 *
 * The whole table posts a mark per row rather than opening a dialog, because
 * marking a register is thirty small decisions in two minutes and a dialog per
 * person would make it a morning's work. Changing the day is a link, not client
 * state: the server holds the register, so a reload has to land on the same day.
 */
export function AttendanceRegister({
  entries,
  date,
  canMark,
}: {
  entries: RegisterEntry[];
  /** `YYYY-MM-DD` — the day being marked. */
  date: string;
  canMark: boolean;
}) {
  const t = useT();
  const { isPending, run } = useToastedTransition();

  const unmarked = entries.filter((entry) => entry.status === null);

  const mark = React.useCallback(
    (entry: RegisterEntry, status: string, isJustified?: boolean) => {
      const formData = new FormData();
      formData.set("staffId", entry.staffId);
      formData.set("date", date);
      formData.set("status", status);
      if (isJustified ?? entry.isJustified) formData.set("isJustified", "on");
      formData.set("minutesLate", String(entry.minutesLate));
      if (entry.notes) formData.set("notes", entry.notes);
      run(() => markAttendanceAction({ status: "idle" }, formData));
    },
    [date, run],
  );

  function markEveryoneElse() {
    const formData = new FormData();
    formData.set("date", date);
    formData.set("status", "PRESENT");
    for (const entry of unmarked) formData.append("staffIds", entry.staffId);
    run(() => markDayInBulkAction({ status: "idle" }, formData));
  }

  const columns = React.useMemo<ColumnDef<RegisterEntry, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.staffName} ${row.staffCode}`,
        header: t.hr.employee,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.staffName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.staffCode} ·{" "}
              {
                t.hrOptions.jobRoles[
                  row.original.jobRole as keyof typeof t.hrOptions.jobRoles
                ]
              }
            </p>
          </div>
        ),
      },
      {
        id: "status",
        // A null status is "nobody has said yet", which is the whole point of
        // the screen — it gets a sentinel so it can be filtered for.
        accessorFn: (row) => row.status ?? UNMARKED,
        header: t.hr.attendanceStatus,
        cell: ({ row }) => {
          const entry = row.original;
          const chargeable =
            entry.status !== null &&
            isChargeableAbsence(entry.status, entry.isJustified);

          if (canMark) {
            return (
              <Select
                value={entry.status ?? ""}
                onValueChange={(value) => mark(entry, value)}
                disabled={isPending}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t.hr.unmarked} />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t.hrOptions.attendanceStatuses[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          return entry.status === null ? (
            <Badge variant="outline">{t.hr.unmarked}</Badge>
          ) : (
            <Badge variant={chargeable ? "destructive" : "secondary"}>
              {
                t.hrOptions.attendanceStatuses[
                  entry.status as keyof typeof t.hrOptions.attendanceStatuses
                ]
              }
            </Badge>
          );
        },
      },
      {
        id: "justified",
        accessorFn: (row) => row.isJustified,
        header: t.hr.justified,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === null ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : (
            <Switch
              checked={row.original.isJustified}
              disabled={!canMark || isPending}
              onCheckedChange={(checked) =>
                mark(row.original, row.original.status ?? "ABSENT", checked)
              }
              aria-label={t.hr.justified}
            />
          ),
      },
      {
        accessorKey: "minutesLate",
        header: t.hr.minutesLate,
        meta: { className: "text-end hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.status === "LATE" ? row.original.minutesLate : "—"}
          </span>
        ),
      },
    ],
    [t, canMark, isPending, mark],
  );

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.hr.attendanceStatus,
        options: [
          { value: UNMARKED, label: t.hr.unmarked },
          ...ATTENDANCE_STATUSES.map((status) => ({
            value: status,
            label: t.hrOptions.attendanceStatuses[status],
          })),
        ],
      },
    ],
    [t],
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Label htmlFor="registerDate">{t.hr.day}</Label>
          {/* A link rather than a controlled input: the server holds the day's
              register, so the URL has to be what says which day it is. */}
          <Input
            id="registerDate"
            type="date"
            dir="ltr"
            defaultValue={date}
            className="w-44"
            onChange={(event) => {
              const value = event.target.value;
              if (value) window.location.search = `?date=${value}`;
            }}
          />
        </div>

        {canMark && unmarked.length > 0 ? (
          <div className="grid justify-items-end gap-1">
            <Button size="sm" onClick={markEveryoneElse} disabled={isPending}>
              {t.hr.markEveryoneElse}
            </Button>
            <p className="text-muted-foreground text-xs">{t.hr.bulkHint}</p>
          </div>
        ) : null}
      </div>

      {/*
        A page size well past a school's payroll, because marking a register is
        a single pass down the list: paginating it would hide the people still
        to be marked behind a "next" button.
      */}
      <DataTable
        columns={columns}
        data={entries}
        facets={facets}
        pageSize={100}
        emptyState={
          <EmptyState
            icon={<CalendarCheckIcon className="size-5" />}
            title={t.hr.noStaff}
          />
        }
      />
    </div>
  );
}
