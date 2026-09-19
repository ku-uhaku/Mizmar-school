import type * as React from "react";

import { cn } from "@/lib/utils";
import { minutesSinceMidnight } from "@/modules/timetable/enums";

/**
 * A week as one strip per day on a shared time axis, each block as wide as it
 * is long.
 *
 * ── Why not a table ─────────────────────────────────────────────────────────
 * A table needs one column per distinct start–end pair, which is only a grid
 * while every day rings the same bell. With 1h30 on Monday to Thursday and 1h on
 * Friday the columns interleave and every day is left with cells it does not
 * have. Here a day has the blocks it has, in proportion, and the hatching is
 * only the time the school really is closed.
 *
 * Presentational only — no state, no hooks, no `server-only` — so the same
 * layout serves the screens and the printed sheets and they cannot drift.
 */

export type WeekAxisItem = {
  key: string;
  startTime: string;
  endTime: string;
  /** Extra classes on the positioned box, which is `p-0.5` and full height. */
  className?: string;
  children: React.ReactNode;
};

export type WeekAxisDay = {
  key: string | number;
  /** The day's heading, in the fixed column at the start of its strip. */
  label: React.ReactNode;
  items: WeekAxisItem[];
};

/**
 * The least width, per minute of the day, the axis is squeezed to on screen.
 * Above it the axis stretches to the container; below it the container scrolls.
 */
const MIN_PX_PER_MINUTE = 1.5;

export function WeekAxis({
  days,
  corner,
  printable = false,
  rowHeightClass = "h-[4.5rem]",
}: {
  days: WeekAxisDay[];
  /** The heading above the day column. */
  corner?: React.ReactNode;
  /**
   * Drawn for paper: no minimum width or sticky column, sizes in millimetres,
   * and a light hatch that survives a photocopier.
   */
  printable?: boolean;
  /** Height of one day's strip. */
  rowHeightClass?: string;
}) {
  const items = days.flatMap((day) => day.items);
  if (items.length === 0) return null;

  // Exactly the earliest start to the latest end — not rounded out to whole
  // hours, whose spare margin was empty hatching that kept the week from
  // using its width.
  const axisStart = Math.min(...items.map((item) => minutesSinceMidnight(item.startTime)));
  const axisEnd = Math.max(...items.map((item) => minutesSinceMidnight(item.endTime)));
  const span = Math.max(1, axisEnd - axisStart);
  const pct = (minutes: number) => `${(minutes / span) * 100}%`;

  // Whole hours strictly inside the span: one on the very edge would have half
  // its label cut off.
  const firstHour = Math.ceil((axisStart + 1) / 60);
  const lastHour = Math.floor((axisEnd - 1) / 60);
  const hours = Array.from(
    { length: Math.max(0, lastHour - firstHour + 1) },
    (_, index) => firstHour + index,
  );

  // Wide enough for "Wednesday" in bold at print size.
  const labelWidth = printable ? "27mm" : "6rem";

  return (
    <div style={printable ? undefined : { minWidth: `calc(6rem + ${span * MIN_PX_PER_MINUTE}px)` }}>
      <div className="flex border-b">
        <div
          className={cn(
            "text-muted-foreground shrink-0 px-3 py-2 text-start text-xs font-medium tracking-wide uppercase",
            !printable && "bg-card sticky start-0 z-10",
          )}
          style={{ width: labelWidth }}
        >
          {corner}
        </div>
        <div className="relative h-8 min-w-0 flex-1">
          {hours.map((hour) => (
            // Logical, like the blocks below, so the ruler and the cells agree in
            // a right-to-left week. A zero-width box centres the label on the
            // tick in either direction, which a translate cannot: it would drift
            // the other way once the axis flips.
            <span
              key={hour}
              className="text-muted-foreground absolute top-2 flex w-0 justify-center text-[10px] tabular-nums"
              style={{ insetInlineStart: pct(hour * 60 - axisStart) }}
            >
              <span dir="ltr" className="whitespace-nowrap">
                {String(hour).padStart(2, "0")}:00
              </span>
            </span>
          ))}
        </div>
      </div>

      {days.map((day) => (
        <div key={day.key} className="flex border-b last:border-0">
          <div
            className={cn(
              "shrink-0 px-3 py-2 text-start text-sm font-medium",
              !printable && "bg-card sticky start-0 z-10",
            )}
            style={{ width: labelWidth }}
          >
            {day.label}
          </div>

          {/* Hatched: the time the school is not open. Blocks sit on top. */}
          <div
            className={cn(
              "relative min-w-0 flex-1",
              rowHeightClass,
              !printable && "text-muted-foreground/15",
            )}
            // Paper gets a flat light grey, not stripes. Print forces colours to
            // print exactly, so a `currentColor` hatch comes out solid black and
            // shows through every tinted lesson; a flat tone stays quiet and
            // survives a photocopier.
            style={
              printable
                ? { backgroundColor: "#f3f3f3" }
                : {
                    backgroundImage:
                      "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 7px)",
                  }
            }
          >
            {day.items.map((item) => {
              const start = minutesSinceMidnight(item.startTime);
              const length = minutesSinceMidnight(item.endTime) - start;
              return (
                <div
                  key={item.key}
                  className={cn("text-foreground absolute inset-y-0.5 p-0.5", item.className)}
                  style={{
                    insetInlineStart: pct(start - axisStart),
                    width: pct(length),
                  }}
                >
                  {item.children}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
