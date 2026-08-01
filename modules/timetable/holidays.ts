import type { WeekContext } from "@/modules/timetable/queries";
import { addDays, toDateKey } from "@/modules/timetable/weeks";

/**
 * Which days of the week on screen are holidays, and what each one is called.
 *
 * Pure, and keyed by ISO weekday (1 = Monday) because that is what the grid's
 * rows are keyed by — the grid never learns a date, only which of its six rows
 * to dim. Comparing `YYYY-MM-DD` strings works because they sort
 * lexicographically, which is the whole reason the week context serialises
 * dates that way rather than shipping `Date` objects across the boundary.
 *
 * A day covered by two overlapping holidays takes the first one declared. That
 * is a data-entry problem rather than a modelling one, and picking a winner
 * beats rendering both names in a cell two centimetres wide.
 */
export function holidaysByWeekday(context: WeekContext): Record<number, string> {
  const { current, holidays } = context;
  if (!current || holidays.length === 0) return {};

  const monday = new Date(`${current.start}T00:00:00`);
  const byDay: Record<number, string> = {};

  for (let offset = 0; offset < 7; offset += 1) {
    const key = toDateKey(addDays(monday, offset));
    const holiday = holidays.find(
      (candidate) => candidate.startDate <= key && candidate.endDate >= key,
    );
    if (holiday) byDay[offset + 1] = holiday.name;
  }

  return byDay;
}
