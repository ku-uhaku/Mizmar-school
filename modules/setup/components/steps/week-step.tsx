"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { interpolate } from "@/lib/i18n/format";
import { slotsForBell, weeklyTeachingMinutes } from "@/modules/setup/bell";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/**
 * The week the bell step just described, drawn as the timetable will draw it.
 *
 * Read-only on purpose: it asks nothing and posts nothing. The previous step
 * asks eight numbers and previews a single day, which is enough to check that
 * the periods ring at the right times and not enough to see the *shape* of the
 * week — that Wednesday ends at noon, that Saturday has no afternoon, that the
 * grid is nine half-days rather than ten. That shape is what a school actually
 * recognises, and it is the same grid `/timetable` prints once the year is laid.
 *
 * It reads `setup.bell.plan`, the same reading `slotsForBell` is given at
 * submit, so what is drawn here is what is written.
 */
export function WeekStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const plan = setup.bell.plan;

  const slots = React.useMemo(() => {
    if (plan.teachingDays.length === 0) return [];
    try {
      return slotsForBell(plan);
    } catch {
      // A half-typed time is not an error worth drawing — the schema catches it
      // on submit, and until then the grid simply has nothing to draw.
      return [];
    }
  }, [plan]);

  /*
    One row per period, the days that have it collected into it.

    Keyed on `position` rather than on the time: every day is laid from the same
    start with the same period length, so position 5 is the same hour on every
    day that has one — and a day that has no afternoon is exactly a day missing
    those positions, which is the hole the grid is here to show.
  */
  const rows = React.useMemo(() => {
    const byPosition = new Map<
      number,
      { position: number; startTime: string; endTime: string; isBreak: boolean; days: Set<number> }
    >();

    for (const slot of slots) {
      if (slot.scheduleKind !== "STANDARD") continue;
      const row = byPosition.get(slot.position) ?? {
        position: slot.position,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: slot.isBreak === true,
        days: new Set<number>(),
      };
      row.days.add(slot.dayOfWeek);
      byPosition.set(slot.position, row);
    }

    return [...byPosition.values()].sort((a, b) => a.position - b.position);
  }, [slots]);

  const ramadanCount = slots.filter((slot) => slot.scheduleKind === "RAMADAN").length;
  const weeklyHours = weeklyTeachingMinutes(plan) / 60;
  const dayLabel = (day: number) => t.configOptions.days[String(day) as "1"];

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t.setup.week.empty}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Wide on a phone, so the grid scrolls inside itself rather than the page. */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-muted-foreground px-3 py-2 text-start text-xs font-medium">
                {t.setup.week.period}
              </th>
              {plan.teachingDays.map((day) => (
                <th key={day} className="px-3 py-2 text-center text-xs font-medium">
                  {dayLabel(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.position} className={row.isBreak ? "bg-muted/30" : undefined}>
                <th className="text-muted-foreground border-t px-3 py-2 text-start text-xs font-normal whitespace-nowrap">
                  {row.isBreak ? (
                    t.setup.bell.break
                  ) : (
                    <span dir="ltr">
                      {row.startTime}–{row.endTime}
                    </span>
                  )}
                </th>
                {plan.teachingDays.map((day) => (
                  <td key={day} className="border-t px-3 py-2 text-center">
                    {row.days.has(day) ? (
                      <span
                        aria-label={`${dayLabel(day)} ${row.startTime}`}
                        className={
                          row.isBreak
                            ? "bg-muted-foreground/30 inline-block h-2 w-full max-w-16 rounded-full"
                            : "bg-primary/70 inline-block h-4 w-full max-w-16 rounded"
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-1">
        <p className="text-sm font-medium">
          {interpolate(t.setup.bell.weeklyHours, {
            hours: Number.isInteger(weeklyHours) ? weeklyHours : weeklyHours.toFixed(1),
          })}
        </p>
        <p className="text-muted-foreground text-xs">
          {interpolate(t.setup.bell.slotCount, { count: slots.length })}
        </p>
        {plan.freeAfternoonDays.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {interpolate(t.setup.week.freeAfternoon, {
              days: plan.freeAfternoonDays.map(dayLabel).join(", "),
            })}
          </p>
        ) : null}
        {ramadanCount > 0 ? (
          <p className="text-muted-foreground text-xs">
            {interpolate(t.setup.week.ramadan, { count: ramadanCount })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
