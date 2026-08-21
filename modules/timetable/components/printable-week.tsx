import type { Dictionary } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import type { SlotColumn } from "@/modules/timetable/queries";

/**
 * A week, laid out for paper.
 *
 * Deliberately not the on-screen `TimetableGrid`. That one is a drag target: it
 * carries click handlers, hover affordances and an editing dialog, none of
 * which survive a printer. This draws the same week as a plain table with a
 * hairline border, which is what a grid pinned to a staffroom wall actually
 * needs — it does keep the subject's colour, at the same light tint the
 * screen uses, so the sheet on the wall is still readable at a glance.
 *
 * Days are rows and periods are columns, matching the screen — a teacher
 * reading their own copy has already learnt where Tuesday is, and turning the
 * axes on paper would make the two disagree.
 */

/** One cell, already reduced to the two or three lines that get printed. */
export type PrintableCell = {
  /** Empty means a free period, or one the school does not teach. */
  lines: string[];
  /** Periods this lesson runs over — the `colSpan` of a double period. */
  span: number;
  /** Covered by the block that started earlier in the day; skipped entirely. */
  covered: boolean;
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

export type PrintableWeek = {
  columns: SlotColumn[];
  rows: { dayOfWeek: number; cells: PrintableCell[] }[];
};

export function PrintableWeekTable({
  week,
  t,
}: {
  week: PrintableWeek;
  t: Dictionary;
}) {
  return (
    <table className="print-table print-week">
      <thead>
        <tr>
          <th className="print-week-day">{t.timetable.day}</th>
          {week.columns.map((column) => (
            <th key={column.key} className="text-center">
              {/* LTR on the times even in Arabic: "08:00" is a clock reading,
                not a phrase, and the bidi algorithm would otherwise flip the
                two halves of the range around the dash. */}
              <span dir="ltr">
                {column.startTime}
                <br />
                {column.endTime}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {week.rows.map((row) => (
          <tr key={row.dayOfWeek}>
            <th scope="row" className="print-week-day">
              {
                t.timetable.days[
                  String(row.dayOfWeek) as keyof typeof t.timetable.days
                ]
              }
            </th>
            {row.cells.map((cell, index) =>
              // The first cell of a double period spans over the ones after it,
              // so those must not be drawn at all — see `covered`.
              cell.covered ? null : (
                <td
                  key={week.columns[index]?.key ?? index}
                  colSpan={cell.span}
                  className={
                    cell.isBreak
                      ? "print-week-break text-center"
                      : "text-center"
                  }
                  style={
                    cell.colorHex
                      ? {
                          backgroundColor: `${cell.colorHex}22`,
                          borderInlineStart: `2px solid ${cell.colorHex}`,
                        }
                      : undefined
                  }
                >
                  {cell.lines.map((line, lineIndex) => (
                    <span
                      key={line + lineIndex}
                      className={cn(
                        lineIndex === 0
                          ? "print-week-subject"
                          : "print-week-meta",
                        // The subject is struck; the word saying so is not.
                        lineIndex === 0 &&
                          cell.cancelled &&
                          "print-week-cancelled",
                      )}
                    >
                      {line}
                    </span>
                  ))}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
