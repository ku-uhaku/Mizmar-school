"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { setTeacherAvailabilityAction } from "@/modules/timetable/actions";
import type { AvailabilityGrid } from "@/modules/timetable/queries";

/**
 * A teacher's horaire: the periods of the week they work.
 *
 * ── Why a grid and not a list of rows ───────────────────────────────────────
 * The underlying table is one row per blocked period, and editing it that way —
 * which is what the configuration screen offers — means eight separate rows to
 * say "she does not work Monday morning", and no way to see the shape of
 * somebody's week at a glance. A head of studies negotiates half-days, so the
 * screen has to show half-days.
 *
 * Availability is stated positively here and stored negatively: the cells you
 * leave on are the periods worked, and what is saved is the complement. That
 * matches how the arrangement is actually described ("I'm free except Wednesday
 * afternoon") while keeping `TeacherUnavailability` as the sparse table it
 * should be — a full-time teacher stores no rows at all.
 *
 * Clicking a day or a period header toggles the whole row or column, because
 * every real arrangement is a half-day or a fixed morning and nobody should
 * have to click eight cells to say so.
 */
export function TeacherAvailability({
  teacherId,
  teacherName,
  scheduleKind,
  grid,
  canManage,
}: {
  teacherId: string;
  teacherName: string;
  scheduleKind: string;
  grid: AvailabilityGrid;
  canManage: boolean;
}) {
  const t = useT();
  const router = useRouter();

  const [state, formAction] = useActionState(
    setTeacherAvailabilityAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => router.refresh() });

  /**
   * The periods this teacher does *not* work — what actually gets stored.
   *
   * Seeded once. Switching teacher or bell schedule navigates, and the page
   * remounts this component on a key of the two, so the state is rebuilt by
   * React rather than resynchronised in an effect.
   */
  const [blocked, setBlocked] = React.useState<Set<string>>(
    () =>
      new Set(
        grid.rows.flatMap((row) =>
          Object.values(row.cells)
            .filter((cell) => cell?.blocked)
            .map((cell) => cell!.timeSlotId),
        ),
      ),
  );

  const toggle = (slotIds: string[], makeBlocked?: boolean) => {
    setBlocked((current) => {
      const next = new Set(current);
      // A header toggles the whole line to whichever state it is not already
      // wholly in, so a second click undoes the first.
      const target =
        makeBlocked ?? !slotIds.every((id) => current.has(id));
      for (const id of slotIds) {
        if (target) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const slotsOf = (predicate: (cell: { timeSlotId: string }) => boolean) =>
    grid.rows
      .flatMap((row) => Object.values(row.cells))
      .filter((cell): cell is { timeSlotId: string; blocked: boolean } =>
        Boolean(cell),
      )
      .filter(predicate)
      .map((cell) => cell.timeSlotId);

  const worked = grid.totalPeriods - blocked.size;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b">
        <div className="min-w-0">
          <CardTitle>{teacherName}</CardTitle>
          <CardDescription>{t.timetable.availabilityHint}</CardDescription>
        </div>
        <Badge variant={blocked.size > 0 ? "outline" : "secondary"}>
          {interpolate(t.timetable.periodsWorked, {
            worked,
            total: grid.totalPeriods,
          })}
        </Badge>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="teacherId" value={teacherId} />
          <input type="hidden" name="scheduleKind" value={scheduleKind} />
          {[...blocked].map((id) => (
            <input key={id} type="hidden" name="blockedSlotIds" value={id} />
          ))}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-muted-foreground p-1.5 text-start text-xs font-medium">
                    {t.timetable.day}
                  </th>
                  {grid.columns.map((column) => (
                    <th key={column.key} className="p-1">
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() =>
                          toggle(
                            slotsOf((cell) =>
                              grid.rows.some(
                                (row) =>
                                  row.cells[column.key]?.timeSlotId ===
                                  cell.timeSlotId,
                              ),
                            ),
                          )
                        }
                        className="text-muted-foreground hover:text-foreground w-full text-xs font-medium whitespace-nowrap disabled:cursor-default"
                        dir="ltr"
                      >
                        {column.startTime}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {grid.rows.map((row) => {
                  const daySlots = Object.values(row.cells)
                    .filter(Boolean)
                    .map((cell) => cell!.timeSlotId);

                  return (
                    <tr key={row.dayOfWeek} className="border-t">
                      <th className="p-1 text-start">
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => toggle(daySlots)}
                          className="text-muted-foreground hover:text-foreground text-xs font-medium whitespace-nowrap disabled:cursor-default"
                        >
                          {
                            t.timetable.daysShort[
                              String(
                                row.dayOfWeek,
                              ) as keyof typeof t.timetable.daysShort
                            ]
                          }
                        </button>
                      </th>

                      {grid.columns.map((column) => {
                        const cell = row.cells[column.key];
                        if (!cell) {
                          // The school does not teach this period on this day.
                          return (
                            <td key={column.key} className="p-1">
                              <div className="bg-muted/30 h-9 rounded-md" />
                            </td>
                          );
                        }

                        const off = blocked.has(cell.timeSlotId);
                        return (
                          <td key={column.key} className="p-1">
                            <button
                              type="button"
                              disabled={!canManage}
                              aria-pressed={!off}
                              onClick={() =>
                                toggle([cell.timeSlotId], !off)
                              }
                              className={cn(
                                "h-9 w-full rounded-md border text-xs transition-colors disabled:cursor-default",
                                off
                                  ? "bg-muted text-muted-foreground border-dashed"
                                  : "border-success/40 bg-success/10 text-success",
                              )}
                            >
                              {off ? t.timetable.notWorking : t.timetable.working}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canManage ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBlocked(new Set())}
              >
                {t.timetable.availableAllWeek}
              </Button>
              <SubmitButton>{t.common.save}</SubmitButton>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
