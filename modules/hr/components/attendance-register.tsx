"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { IDLE } from "@/lib/action-state";
import {
  markAttendanceAction,
  markDayInBulkAction,
} from "@/modules/hr/actions";
import { ATTENDANCE_STATUSES, isChargeableAbsence } from "@/modules/hr/enums";
import type { RegisterEntry } from "@/modules/hr/queries";
import { useToastedTransition } from "@/components/form/use-toasted-transition";

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
  const router = useRouter();
  const { isPending, run } = useToastedTransition();

  const unmarked = entries.filter((entry) => entry.status === null);

  const mark = React.useCallback(
    (
      entry: RegisterEntry,
      status: string,
      patch: { isJustified?: boolean; minutesLate?: number } = {},
    ) => {
      const formData = new FormData();
      formData.set("staffId", entry.staffId);
      formData.set("date", date);
      formData.set("status", status);
      if (patch.isJustified ?? entry.isJustified) {
        formData.set("isJustified", "on");
      }
      formData.set(
        "minutesLate",
        String(patch.minutesLate ?? entry.minutesLate),
      );
      if (entry.notes) formData.set("notes", entry.notes);
      run(() => markAttendanceAction(IDLE, formData));
    },
    [date, run],
  );

  function markEveryoneElse() {
    const formData = new FormData();
    formData.set("date", date);
    formData.set("status", "PRESENT");
    for (const entry of unmarked) formData.append("staffIds", entry.staffId);
    run(() => markDayInBulkAction(IDLE, formData));
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
        cell: ({ row }) => {
          const entry = row.original;
          // Only a marked day can be justified or not: an unmarked one is
          // "nobody has said yet", which is a different answer.
          if (entry.status === null) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          const status = entry.status;
          return (
            <Switch
              checked={entry.isJustified}
              disabled={!canMark || isPending}
              onCheckedChange={(checked) =>
                mark(entry, status, { isJustified: checked })
              }
              aria-label={t.hr.justified}
            />
          );
        },
      },
      {
        accessorKey: "minutesLate",
        header: t.hr.minutesLate,
        meta: { className: "text-end hidden @2xl/table:table-cell" },
        /*
          Editable, not merely shown. The column exists so that "twice, by four
          minutes" and "twice, by an hour" are not the same row — and until
          there was a box, every LATE mark was recorded as nought minutes,
          because nothing in the app could ever set it.
        */
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.status !== "LATE") {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          if (!canMark) {
            return (
              <span className="tabular-nums">{entry.minutesLate}</span>
            );
          }
          return (
            <Input
              type="number"
              min="0"
              max="600"
              dir="ltr"
              className="ms-auto w-20 text-end"
              disabled={isPending}
              defaultValue={entry.minutesLate}
              aria-label={t.hr.minutesLate}
              // On blur rather than on change: a register is marked at speed,
              // and a round trip per keystroke would fight the typing.
              onBlur={(event) => {
                const minutes = Number(event.target.value);
                if (!Number.isFinite(minutes) || minutes === entry.minutesLate) {
                  return;
                }
                mark(entry, "LATE", { minutesLate: Math.max(0, minutes) });
              }}
            />
          );
        },
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
          {/* The URL, not component state: the server holds the day's register,
              so a reload has to land on the day being marked. Navigated rather
              than assigned to `location`, which threw the whole document away
              and lost the reader's place in the list. */}
          <Input
            id="registerDate"
            type="date"
            dir="ltr"
            defaultValue={date}
            className="w-44"
            onChange={(event) => {
              const value = event.target.value;
              if (value) router.push(`/hr/attendance?date=${value}`);
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

      {/* Only unjustified days are totalled for the bursar, which is the whole
          reason the switch is there — worth saying once, above the table. */}
      <p className="text-muted-foreground text-xs">{t.hr.justifiedHint}</p>

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
