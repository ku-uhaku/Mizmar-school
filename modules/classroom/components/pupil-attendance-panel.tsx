"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheckIcon } from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { ATTENDANCE_STATUSES } from "@/modules/classroom/enums";
import type { PupilAttendance } from "@/modules/classroom/queries";

/**
 * L'assiduité: every register this pupil appears in, and what it adds up to.
 *
 * The four tiles come first because they are the answer to the question the
 * screen is opened with — "how many has this child missed, and were they
 * justified" — and the list underneath is the evidence for it. A parent on the
 * phone disputes a specific Tuesday, which is why the rows carry the date, the
 * lesson and who marked it.
 *
 * Unjustified is called out separately from absent throughout. A school chases
 * the unjustified ones; the rest are already explained.
 */
export function PupilAttendancePanel({
  attendance,
}: {
  attendance: PupilAttendance;
}) {
  const { t, locale } = useI18n();

  const columns = React.useMemo<
    ColumnDef<PupilAttendance["rows"][number], unknown>[]
  >(
    () => [
      {
        accessorKey: "date",
        header: t.classroom.date,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.date, locale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t.classroom.attendanceStatus,
        cell: ({ row }) => {
          const { status, minutesLate } = row.original;
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  status === "ABSENT"
                    ? "destructive"
                    : status === "PRESENT"
                      ? "secondary"
                      : "outline"
                }
              >
                {
                  t.classroomOptions.attendanceStatuses[
                    status as keyof typeof t.classroomOptions.attendanceStatuses
                  ]
                }
              </Badge>
              {status === "LATE" && minutesLate ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {interpolate(t.classroom.minutesLateShort, {
                    count: minutesLate,
                  })}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "justified",
        // A sentinel string rather than the boolean: the facet matches on
        // strings, and "justified / not" is exactly what a reader filters by.
        accessorFn: (row) => (row.isJustified ? "YES" : "NO"),
        header: t.classroom.justified,
        cell: ({ row }) =>
          row.original.status === "PRESENT" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                !row.original.isJustified && "text-destructive border-destructive/40",
              )}
            >
              {row.original.isJustified ? t.common.yes : t.common.no}
            </Badge>
          ),
      },
      {
        id: "subject",
        accessorFn: (row) => row.subjectName ?? "",
        header: t.classroom.lesson,
        meta: { className: "hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm">
            {/* No subject means a whole-day register rather than one lesson. */}
            {row.original.subjectName ?? t.classroom.wholeDay}
          </span>
        ),
      },
      {
        id: "reason",
        accessorFn: (row) => row.reason ?? "",
        header: t.classroom.reason,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.reason ?? "—"}
          </span>
        ),
      },
      {
        id: "recordedBy",
        accessorFn: (row) => row.recordedByName ?? "",
        header: t.classroom.recordedBy,
        meta: { className: "hidden @5xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.recordedByName ?? "—"}
          </span>
        ),
      },
    ],
    [t, locale],
  );

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.classroom.attendanceStatus,
        options: ATTENDANCE_STATUSES.map((status) => ({
          value: status,
          label: t.classroomOptions.attendanceStatuses[status],
        })),
      },
      {
        columnId: "justified",
        label: t.classroom.justified,
        options: [
          { value: "NO", label: t.classroom.unjustified },
          { value: "YES", label: t.common.yes },
        ],
      },
    ],
    [t],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t.classroom.attendanceRate}
          value={
            attendance.attendanceRate === null
              ? "—"
              : `${attendance.attendanceRate}%`
          }
          hint={interpolate(t.classroom.ofMarkedDays, {
            count: formatNumber(
              attendance.tally.present +
                attendance.tally.late +
                attendance.tally.absent +
                attendance.tally.excused,
              locale,
            ),
          })}
          tone={
            attendance.attendanceRate === null
              ? undefined
              : attendance.attendanceRate >= 90
                ? "good"
                : attendance.attendanceRate >= 75
                  ? "warn"
                  : "bad"
          }
        />
        <Tile
          label={t.classroomOptions.attendanceStatuses.ABSENT}
          value={formatNumber(attendance.tally.absent, locale)}
          hint={interpolate(t.classroom.unjustifiedCount, {
            count: attendance.unjustifiedAbsences,
          })}
          tone={attendance.unjustifiedAbsences > 0 ? "bad" : undefined}
        />
        <Tile
          label={t.classroomOptions.attendanceStatuses.LATE}
          value={formatNumber(attendance.tally.late, locale)}
          hint={interpolate(t.classroom.unjustifiedCount, {
            count: attendance.unjustifiedLates,
          })}
          tone={attendance.unjustifiedLates > 0 ? "warn" : undefined}
        />
        <Tile
          label={t.classroomOptions.attendanceStatuses.EXCUSED}
          value={formatNumber(attendance.tally.excused, locale)}
          hint={t.classroom.excusedHint}
        />
      </div>

      <DataTable
        columns={columns}
        data={attendance.rows}
        facets={facets}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<CalendarCheckIcon className="size-5" />}
            title={t.classroom.noAttendanceYet}
            description={t.classroom.noAttendanceHint}
          />
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
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
