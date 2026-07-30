"use client";

import * as React from "react";
import { CalendarXIcon, PlusIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { interpolate } from "@/lib/i18n/format";
import { MAX_LESSON_SPAN } from "@/modules/timetable/enums";
import { TimetableCellDialog } from "@/modules/timetable/components/timetable-cell-dialog";
import type {
  TimetableCell,
  TimetableGrid as TimetableGridData,
} from "@/modules/timetable/queries";

export type TimetableChoices = {
  subjects: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    colorHex: string | null;
  }[];
  teachers: { id: string; label: string }[];
  rooms: { id: string; code: string; name: string | null }[];
  terms: { id: string; name: string; number: number }[];
  groups: { id: string; label: string }[];
  teacherBySubject: Record<string, string>;
};

/**
 * The week: days down the side, periods across the top.
 *
 * That orientation, rather than the reverse, because a Moroccan week has six
 * days and a dozen periods — days as rows keeps the grid taller than it is
 * wide, which is the shape a screen has. Each cell is a button: an empty one
 * places a lesson, a filled one edits it.
 *
 * Cells with no slot at all are drawn as closed rather than empty. Saturday
 * afternoon is not a free period a school forgot to fill; it is a day that
 * ends at noon, and a grid that cannot say so invites lessons that cannot
 * happen.
 */
export function TimetableGrid({
  grid,
  schoolClassId,
  choices,
  canManage,
}: {
  grid: TimetableGridData;
  schoolClassId: string;
  choices: TimetableChoices;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = React.useState<{
    timeSlotId: string;
    dayOfWeek: number;
    cell: TimetableCell;
    /** How many consecutive periods are free to extend into from here. */
    maxSpan: number;
    /** Days that run this same period, so the lesson can be repeated onto them. */
    repeatableDays: number[];
  } | null>(null);

  if (grid.columns.length === 0) {
    return (
      <EmptyState
        icon={<CalendarXIcon className="size-5" />}
        title={t.timetable.noSlots}
        description={t.timetable.noSlotsHint}
      />
    );
  }

  const teachablePeriods = grid.rows.reduce(
    (total, row) =>
      total +
      Object.values(row.cells).filter(
        (cell) => cell.timeSlotId !== null && !cell.isBreak,
      ).length,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {interpolate(t.timetable.weekCoverage, {
            filled: grid.entryCount,
            total: teachablePeriods,
          })}
        </Badge>
        <Badge variant="outline">
          {
            t.timetable.scheduleKinds[
              grid.scheduleKind as keyof typeof t.timetable.scheduleKinds
            ]
          }
        </Badge>
      </div>

      {/* The grid scrolls on its own; the page never scrolls sideways. */}
      <div className="bg-card overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="bg-card text-muted-foreground sticky start-0 z-10 min-w-24 px-3 py-2 text-start text-xs font-medium tracking-wide uppercase"
              >
                {t.timetable.scheduleKind}
              </th>
              {grid.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "min-w-32 px-2 py-2 text-center",
                    column.isBreak && "bg-muted/40",
                  )}
                >
                  <span
                    className="block text-xs font-medium tabular-nums"
                    dir="ltr"
                  >
                    {column.startTime}
                  </span>
                  <span
                    className="text-muted-foreground block text-[10px] tabular-nums"
                    dir="ltr"
                  >
                    {column.endTime}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.dayOfWeek} className="border-b last:border-0">
                <th
                  scope="row"
                  className="bg-card sticky start-0 z-10 px-3 py-2 text-start text-sm font-medium"
                >
                  <span className="hidden lg:inline">
                    {
                      t.timetable.days[
                        String(row.dayOfWeek) as keyof typeof t.timetable.days
                      ]
                    }
                  </span>
                  <span className="lg:hidden">
                    {
                      t.timetable.daysShort[
                        String(
                          row.dayOfWeek,
                        ) as keyof typeof t.timetable.daysShort
                      ]
                    }
                  </span>
                </th>

                {grid.columns.map((column, columnIndex) => {
                  const cell = row.cells[column.key];

                  // A continuation period is drawn by the block that started
                  // earlier — its `colSpan` already covers this column.
                  if (cell.covered) return null;

                  return (
                    <td
                      key={column.key}
                      className="p-1 align-top"
                      colSpan={cell.entry?.span ?? 1}
                    >
                      <Cell
                        cell={cell}
                        canManage={canManage}
                        onOpen={() => {
                          if (!cell.timeSlotId) return;
                          setEditing({
                            timeSlotId: cell.timeSlotId,
                            dayOfWeek: row.dayOfWeek,
                            cell,
                            maxSpan: spanRoom(grid, row.dayOfWeek, columnIndex, cell),
                            repeatableDays: daysRunning(grid, column.key),
                          });
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && editing ? (
        <TimetableCellDialog
          key={editing.timeSlotId}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          schoolClassId={schoolClassId}
          timeSlotId={editing.timeSlotId}
          dayOfWeek={editing.dayOfWeek}
          entry={editing.cell.entry}
          choices={choices}
          maxSpan={editing.maxSpan}
          repeatableDays={editing.repeatableDays}
        />
      ) : null}
    </div>
  );
}

/**
 * How far a lesson starting here could run before it hits a break, the end of
 * the day, or somebody else's lesson.
 *
 * Computed from the grid already on screen rather than fetched, so the duration
 * options in the dialog can never offer a period that is not there. The block's
 * own continuation periods do not count as occupied — otherwise a double period
 * could never be edited without first being shortened.
 */
function spanRoom(
  grid: TimetableGridData,
  dayOfWeek: number,
  fromIndex: number,
  cell: TimetableCell,
): number {
  const row = grid.rows.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  if (!row) return 1;

  const ownIds = new Set(cell.entry?.entryIds ?? []);
  let room = 0;

  for (let index = fromIndex; index < grid.columns.length; index += 1) {
    const candidate = row.cells[grid.columns[index].key];
    if (!candidate || candidate.timeSlotId === null || candidate.isBreak) break;

    const occupiedByOther =
      index > fromIndex &&
      ((candidate.entry !== null && !ownIds.has(candidate.entry.id)) ||
        (candidate.covered && !ownIds.has(cell.entry?.id ?? "")));
    if (occupiedByOther) break;

    room += 1;
    if (room >= MAX_LESSON_SPAN) break;
  }

  return Math.max(1, room);
}

/** The days whose bell schedule runs this same period. */
function daysRunning(grid: TimetableGridData, columnKey: string): number[] {
  return grid.rows
    .filter((row) => {
      const cell = row.cells[columnKey];
      return cell && cell.timeSlotId !== null && !cell.isBreak;
    })
    .map((row) => row.dayOfWeek);
}

function Cell({
  cell,
  canManage,
  onOpen,
}: {
  cell: TimetableCell;
  canManage: boolean;
  onOpen: () => void;
}) {
  const { t } = useI18n();

  // The school does not teach then — not the same as an unfilled period.
  if (cell.timeSlotId === null) {
    return (
      <div className="bg-muted/30 text-muted-foreground/50 flex h-16 items-center justify-center rounded-md text-[10px]">
        {t.timetable.closed}
      </div>
    );
  }

  if (cell.isBreak) {
    return (
      <div className="bg-muted/50 text-muted-foreground flex h-16 items-center justify-center rounded-md text-[10px]">
        {t.timetable.breakLabel}
      </div>
    );
  }

  const entry = cell.entry;

  const body = entry ? (
    <>
      <span className="block truncate text-xs font-semibold">
        {entry.subjectShort}
        {/* A double period says so on its face — the width alone is easy to
            misread on a grid whose columns are not all the same size. */}
        {entry.span > 1 ? (
          <span className="text-muted-foreground ms-1 font-normal">
            ×{entry.span}
          </span>
        ) : null}
      </span>
      {entry.teacherName ? (
        <span className="text-muted-foreground block truncate text-[10px]">
          {entry.teacherName}
        </span>
      ) : null}
      <span className="text-muted-foreground flex items-center justify-center gap-1 text-[10px]">
        {entry.roomCode ? <span dir="ltr">{entry.roomCode}</span> : null}
        {entry.groupLabel ? <span>· {entry.groupLabel}</span> : null}
      </span>
    </>
  ) : (
    <PlusIcon className="text-muted-foreground/40 size-4" />
  );

  const className = cn(
    "flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md px-1.5 text-center transition-colors",
    entry ? "bg-muted/60" : "border border-dashed",
  );

  if (!canManage) {
    return (
      <div
        className={className}
        style={
          entry?.colorHex
            ? { backgroundColor: `${entry.colorHex}22` }
            : undefined
        }
      >
        {entry ? body : <span className="sr-only">{t.timetable.free}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        className,
        "hover:bg-muted focus-visible:ring-ring/50 cursor-pointer focus-visible:ring-3 focus-visible:outline-none",
      )}
      style={
        entry?.colorHex ? { backgroundColor: `${entry.colorHex}22` } : undefined
      }
      aria-label={entry ? t.timetable.editLesson : t.timetable.addLesson}
    >
      {body}
    </button>
  );
}
