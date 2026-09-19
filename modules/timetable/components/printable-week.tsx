import type { Dictionary } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import { WeekAxis } from "@/modules/timetable/components/week-axis";

/**
 * A week, laid out for paper.
 *
 * Deliberately not the on-screen `TimetableGrid`. That one is a drag target: it
 * carries click handlers, hover affordances and an editing dialog, none of
 * which survive a printer. This draws the same week with a hairline border,
 * which is what a grid pinned to a staffroom wall actually needs — it does keep
 * the subject's colour, at the same light tint the screen uses, so the sheet on
 * the wall is still readable at a glance.
 *
 * Days are rows and time runs across, matching the screen — a teacher reading
 * their own copy has already learnt where Tuesday is, and turning the axes on
 * paper would make the two disagree.
 *
 * ── Blocks, not columns ─────────────────────────────────────────────────────
 * Each day carries its own blocks with their own start and end, laid on a shared
 * time axis by `WeekAxis`. A week whose Friday is shorter than its Monday, or
 * whose periods are 45 minutes, prints as it is rung instead of as a grid full
 * of holes.
 */

/** One block, already reduced to the two or three lines that get printed. */
export type PrintableCell = {
  /** Empty means a free period. */
  lines: string[];
  isBreak: boolean;
  /**
   * Called off for this week only — the subject prints struck through rather
   * than disappearing. A blank cell is indistinguishable from a period nobody
   * has filled in yet, which is the opposite of what a cancellation says.
   */
  cancelled?: boolean;
  /** Same subject colour as the on-screen grid; null for a free period. */
  colorHex?: string | null;
};

/** A block and where it sits: a lesson may run over several consecutive slots. */
export type PrintableItem = PrintableCell & {
  key: string;
  startTime: string;
  endTime: string;
};

export type PrintableWeek = {
  rows: { dayOfWeek: number; items: PrintableItem[] }[];
};

export function PrintableWeekTable({
  week,
  t,
}: {
  week: PrintableWeek;
  t: Dictionary;
}) {
  return (
    <div className="print-week">
      <WeekAxis
        printable
        corner={t.timetable.day}
        rowHeightClass="h-[18mm]"
        days={week.rows.map((row) => ({
          key: row.dayOfWeek,
          label: (
            <span className="print-week-day">
              {
                t.timetable.days[
                  String(row.dayOfWeek) as keyof typeof t.timetable.days
                ]
              }
            </span>
          ),
          items: row.items.map((item) => ({
            key: item.key,
            startTime: item.startTime,
            endTime: item.endTime,
            children: (
              <div
                className={cn(
                  "print-week-cell",
                  item.isBreak && "print-week-break",
                )}
                style={
                  item.colorHex
                    ? {
                        // A gradient, not a background colour: it lays the
                        // tint over the cell's opaque white instead of
                        // replacing it, so the grey of the closed hours can
                        // never show through a lesson.
                        backgroundImage: `linear-gradient(${item.colorHex}22, ${item.colorHex}22)`,
                        borderInlineStart: `2px solid ${item.colorHex}`,
                      }
                    : undefined
                }
              >
                {item.lines.map((line, lineIndex) => (
                  <span
                    key={line + lineIndex}
                    className={cn(
                      lineIndex === 0 ? "print-week-subject" : "print-week-meta",
                      // The subject is struck; the word saying so is not.
                      lineIndex === 0 &&
                        item.cancelled &&
                        "print-week-cancelled",
                    )}
                  >
                    {line}
                  </span>
                ))}
                {/* The block's own clock reading. The ruler above only marks
                  whole hours, and a sheet on a wall has no hover to ask. LTR
                  even in Arabic: a clock reading, not a phrase. */}
                {item.isBreak ? null : (
                  <span dir="ltr" className="print-week-meta print-week-time">
                    {item.startTime}–{item.endTime}
                  </span>
                )}
              </div>
            ),
          })),
        }))}
      />
    </div>
  );
}
