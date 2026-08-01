import type { Dictionary } from "@/lib/i18n/types";
import type { SlotColumn } from "@/modules/timetable/queries";

/**
 * A week, laid out for paper.
 *
 * Deliberately not the on-screen `TimetableGrid`. That one is a drag target: it
 * carries click handlers, hover affordances, an editing dialog and colour
 * fills, none of which survive a printer and two of which cost ink. This draws
 * the same week as a plain table with a hairline border, which is what a grid
 * pinned to a staffroom wall actually needs.
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
                >
                  {cell.lines.map((line, lineIndex) => (
                    <span
                      key={line + lineIndex}
                      className={
                        lineIndex === 0
                          ? "block font-medium"
                          : "block text-[8pt]"
                      }
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
