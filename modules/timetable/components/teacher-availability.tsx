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
import { DAY_SESSIONS, formatDuration } from "@/modules/timetable/enums";
import { WeekAxis } from "@/modules/timetable/components/week-axis";
import type {
  AvailabilityGrid,
  AvailabilitySlot,
} from "@/modules/timetable/queries";

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
 * Clicking a day, or a half-day button, toggles the whole line, because every
 * real arrangement is a half-day or a fixed morning and nobody should have to
 * click eight cells to say so.
 *
 * Each day is a strip of the slots it really has, on a shared time axis: a 1h
 * Friday beside 1h30 Mondays no longer leaves the other days with cells that do
 * not exist.
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
        grid.slots.filter((slot) => slot.blocked).map((slot) => slot.timeSlotId),
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

  const worked = grid.totalPeriods - blocked.size;

  // One strip per day, made of the slots that day really has. Days do not have
  // to share their periods: 1h30 on Monday and 1h on Friday is an ordinary week.
  const days = React.useMemo(() => {
    const byDay = new Map<number, AvailabilitySlot[]>();
    for (const slot of grid.slots) {
      byDay.set(slot.dayOfWeek, [...(byDay.get(slot.dayOfWeek) ?? []), slot]);
    }
    return [...byDay.entries()].sort(([a], [b]) => a - b);
  }, [grid.slots]);

  /** The half-days the week has, for setting "every morning" in one click. */
  const sessions = DAY_SESSIONS.filter((session) =>
    grid.slots.some((slot) => slot.session === session),
  );

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

          {canManage && sessions.length > 0 ? (
            // A half-day is how an arrangement is actually described — "not on
            // Wednesday afternoon", "mornings only" — so it is one click here
            // rather than a cell per day.
            <div className="flex flex-wrap items-center gap-1.5">
              {sessions.map((session) => (
                <Button
                  key={session}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggle(
                      grid.slots
                        .filter((slot) => slot.session === session)
                        .map((slot) => slot.timeSlotId),
                    )
                  }
                >
                  {t.configOptions.sessions[session]}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <WeekAxis
              corner={t.timetable.day}
              rowHeightClass="h-14"
              days={days.map(([dayOfWeek, daySlots]) => ({
                key: dayOfWeek,
                label: (
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => toggle(daySlots.map((slot) => slot.timeSlotId))}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium whitespace-nowrap disabled:cursor-default"
                  >
                    {
                      t.timetable.daysShort[
                        String(dayOfWeek) as keyof typeof t.timetable.daysShort
                      ]
                    }
                  </button>
                ),
                items: daySlots.map((slot) => {
                  const off = blocked.has(slot.timeSlotId);
                  return {
                    key: slot.timeSlotId,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    children: (
                      <button
                        type="button"
                        disabled={!canManage}
                        aria-pressed={!off}
                        onClick={() => toggle([slot.timeSlotId], !off)}
                        className={cn(
                          "flex h-full w-full flex-col items-center justify-center rounded-md border px-1 text-xs leading-tight transition-colors disabled:cursor-default",
                          off
                            ? "bg-muted text-muted-foreground border-dashed"
                            : "border-success/40 bg-success/10 text-success",
                        )}
                      >
                        <span dir="ltr" className="text-[10px] tabular-nums opacity-70">
                          {slot.startTime} · {formatDuration(slot.minutes)}
                        </span>
                        <span className="truncate">
                          {off ? t.timetable.notWorking : t.timetable.working}
                        </span>
                      </button>
                    ),
                  };
                }),
              }))}
            />
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
