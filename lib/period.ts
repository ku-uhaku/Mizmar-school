/**
 * The window a screen's flow figures are read over: a day, a week, a month or a
 * year.
 *
 * Pure data — no `server-only`, no `db`, no React — so the segmented control in
 * the browser and the query on the server work out the same boundaries from the
 * same function. It lives here rather than in a module because two of them ask
 * the question (the dashboard's section cards and the caisse's tiles) and
 * neither owns it.
 *
 * ── What a period is *not* for ───────────────────────────────────────────────
 * A stock — how many pupils are enrolled, how much cash is in the drawer, how
 * many cheques are held — is true as of now and has no window. Only a *flow*
 * (money taken, money paid out) is period-scoped, and only those figures move
 * when the control does. Putting a period on a headcount would print four
 * different numbers for one true one.
 */

export const PERIODS = ["day", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

/** What a screen shows before anybody chooses: the working day. */
export const DEFAULT_PERIOD: Period = "day";

/**
 * A period out of the query string.
 *
 * Anything unrecognised falls back to the default rather than throwing: this
 * reads a value from the URL, and a stale or hand-edited link should show the
 * day's figures, not an error page.
 */
export function parsePeriod(value: string | string[] | undefined): Period {
  return typeof value === "string" &&
    (PERIODS as readonly string[]).includes(value)
    ? (value as Period)
    : DEFAULT_PERIOD;
}

/**
 * The half-open range `[from, to)` a period covers.
 *
 * Half-open on purpose: a movement dated at the very last millisecond of the
 * month belongs to that month, and an inclusive upper bound built from
 * "23:59:59" loses it.
 *
 * Dates are handled at local midnight throughout. A cashier's day ends when the
 * school closes, not when UTC rolls over, and a UTC-based boundary would move
 * an evening receipt into the wrong day.
 */
export function periodRange(
  period: Period,
  now: Date = new Date(),
  /**
   * The year in context, when there is one. A school's "année" is September to
   * July, never January to December — a bursar asking for the year's takings
   * means the year they are running, and a calendar year would cut it in half.
   */
  schoolYear?: { startDate: Date; endDate: Date } | null,
): { from: Date; to: Date } {
  const midnight = startOfDay(now);

  switch (period) {
    case "day":
      return { from: midnight, to: addDays(midnight, 1) };

    case "week": {
      // Monday-based, like every other week in the app — see
      // modules/timetable/weeks.ts. `getDay()` is 0 for Sunday, so a Sunday
      // counts back six days rather than forward one: it belongs to the week
      // that has just finished.
      const weekday = midnight.getDay();
      const monday = addDays(midnight, weekday === 0 ? -6 : 1 - weekday);
      return { from: monday, to: addDays(monday, 7) };
    }

    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from: first,
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    }

    case "year":
      return schoolYear
        ? {
            from: startOfDay(schoolYear.startDate),
            // The year's last day is inclusive as the school states it, so the
            // exclusive bound is the morning after it.
            to: addDays(startOfDay(schoolYear.endDate), 1),
          }
        : {
            from: new Date(now.getFullYear(), 0, 1),
            to: new Date(now.getFullYear() + 1, 0, 1),
          };
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
