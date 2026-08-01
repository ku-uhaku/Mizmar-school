/**
 * The weeks of a school year.
 *
 * Pure data — no `server-only`, no `db`, no React — so the picker in the browser
 * and the query on the server work out the same weeks from the same function.
 *
 * ── Why "this week" is not `new Date()` ──────────────────────────────────────
 * A school year runs September to July, and the application is used in August
 * too: enrolling for September, printing last year's certificates, closing the
 * books. On 1 August 2026 the naive current week belongs to no school year at
 * all, and a timetable defaulting to it shows an empty grid dated outside the
 * calendar the school actually keeps — which is exactly the bug this exists to
 * prevent. Every week here is clamped into `[startDate, endDate]`.
 *
 * Weeks are Monday-based and dates are handled at local midnight: the school
 * week starts on Monday in Morocco, and a Sunday-based week would split it.
 */

/** One week of the year, as the picker and the grid both see it. */
export type SchoolWeek = {
  /** 1-based index within the year — "week 12", as a school counts them. */
  index: number;
  /** Monday, at local midnight. The key everything per-week is stored against. */
  start: Date;
  /** Sunday, at local midnight. Inclusive end for display and comparison. */
  end: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight, so a week key never depends on the time part of an input. */
export function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The Monday of the week containing `date`.
 *
 * `getDay()` is 0 for Sunday, so Sunday counts back six days rather than
 * forward one — a Sunday belongs to the week that has just finished, which is
 * how a school reads a timetable printed on the Friday.
 */
export function startOfWeek(date: Date): Date {
  const day = atMidnight(date);
  const weekday = day.getDay();
  const backwards = weekday === 0 ? 6 : weekday - 1;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - backwards);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Every week the year covers, first to last.
 *
 * Built from the Monday of the week the year starts in to the Monday of the
 * week it ends in, inclusive: a year beginning on a Wednesday still has that
 * whole week as its week 1, because the timetable for it exists and the pupils
 * were there.
 */
export function schoolWeeks(yearStart: Date, yearEnd: Date): SchoolWeek[] {
  const first = startOfWeek(yearStart);
  const last = startOfWeek(yearEnd);
  if (last < first) return [];

  const weeks: SchoolWeek[] = [];
  let cursor = first;
  let index = 1;

  // A guard rather than a `while (true)`: a year mis-entered as spanning a
  // decade would otherwise build sixty thousand objects before anyone noticed.
  const MAX_WEEKS = 80;

  while (cursor <= last && index <= MAX_WEEKS) {
    weeks.push({ index, start: cursor, end: addDays(cursor, 6) });
    cursor = addDays(cursor, 7);
    index += 1;
  }

  return weeks;
}

/**
 * The week to show when nobody has picked one.
 *
 * Today's week when today falls inside the year; otherwise the nearest end —
 * the first week before the year has begun, the last week after it has ended.
 * Never null for a year that has any weeks at all, because "no week" is not
 * something the screen can render.
 */
export function currentSchoolWeek(
  weeks: SchoolWeek[],
  today: Date = new Date(),
): SchoolWeek | null {
  if (weeks.length === 0) return null;

  const day = atMidnight(today);
  const found = weeks.find((week) => day >= week.start && day <= week.end);
  if (found) return found;

  return day < weeks[0].start ? weeks[0] : weeks[weeks.length - 1];
}

/**
 * Resolves a `?week=` parameter against the year.
 *
 * A week outside the year — stale bookmark, hand-typed URL, a link from last
 * year — falls back to the current one rather than drawing a grid for a week
 * the school does not have.
 */
export function resolveWeek(
  weeks: SchoolWeek[],
  weekParam: string | undefined,
  today: Date = new Date(),
): SchoolWeek | null {
  if (weekParam) {
    const index = Number(weekParam);
    if (Number.isInteger(index)) {
      const found = weeks.find((week) => week.index === index);
      if (found) return found;
    }
  }
  return currentSchoolWeek(weeks, today);
}

/** `YYYY-MM-DD`, for a week key that survives a round trip through a URL. */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The date a given ISO weekday (1 = Monday) falls on within a week. */
export function dateOfWeekday(week: SchoolWeek, dayOfWeek: number): Date {
  return addDays(week.start, dayOfWeek - 1);
}

/** Whether two dates are the same calendar day, ignoring any time part. */
export function isSameDay(a: Date, b: Date): boolean {
  return atMidnight(a).getTime() === atMidnight(b).getTime();
}

/** Inclusive range test, comparing whole days. */
export function isWithin(date: Date, start: Date, end: Date): boolean {
  const day = atMidnight(date).getTime();
  return day >= atMidnight(start).getTime() && day <= atMidnight(end).getTime();
}

/**
 * How many days of `week` fall inside `[start, end]`.
 *
 * Used to decide whether a holiday swallows a whole week or clips one end of
 * it, which is the difference between "no lessons at all" and "Monday off".
 */
export function daysOverlapping(
  week: SchoolWeek,
  start: Date,
  end: Date,
): number {
  const from = Math.max(week.start.getTime(), atMidnight(start).getTime());
  const to = Math.min(week.end.getTime(), atMidnight(end).getTime());
  if (to < from) return 0;
  return Math.round((to - from) / DAY_MS) + 1;
}
