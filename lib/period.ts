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
  /**
   * Every year the school in context has, so "année" can reach back to the
   * morning after the previous one closed. See the `year` case.
   */
  schoolYears?: readonly { startDate: Date; endDate: Date }[],
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

    case "year": {
      if (!schoolYear) {
        return {
          from: new Date(now.getFullYear(), 0, 1),
          to: new Date(now.getFullYear() + 1, 0, 1),
        };
      }

      const stated = {
        from: startOfDay(schoolYear.startDate),
        // The year's last day is inclusive as the school states it, so the
        // exclusive bound is the morning after it.
        to: addDays(startOfDay(schoolYear.endDate), 1),
      };

      /*
        The teaching dates are not the whole year's worth of money.

        A school takes money for September all through July and August — the
        frais d'inscription, the first instalment, a re-enrolment settled over
        the summer — and every one of those receipts is stamped with the year it
        is *for*, not the year the calendar happened to be in. Reading "année"
        over 1 September → 30 June alone dropped them, so a receipt written in
        August showed under "jour" and vanished under "année": the wider control
        printed the smaller number. Same story at the far end, for a receipt
        taken after the year closes.

        So the window is the administrative year, not the teaching one: it runs
        from the morning after the previous year closed to the evening this one
        does, and it always contains today. That leaves no day of the twelve
        belonging to no year, and nothing the four controls can hide between
        them: "année" is now a superset of "jour", "semaine" and "mois" whatever
        the date, which is the invariant the segmented control implies.
      */
      const previousEnd = previousYearEnd(schoolYears, stated.from);
      const from = previousEnd
        ? addDays(startOfDay(previousEnd), 1)
        : stated.from;

      return union({ from, to: stated.to }, {
        // Whatever "day", "week" and "month" can reach from here. The year is a
        // superset of the three narrower windows by definition, and a summer
        // spent taking next year's fees is exactly when that stops being true
        // of the teaching dates alone.
        from: minDate(
          periodRange("week", now).from,
          periodRange("month", now).from,
        ),
        to: maxDate(periodRange("week", now).to, periodRange("month", now).to),
      });
    }
  }
}

/**
 * The end of the latest year that closed before this one opened, if the school
 * has one.
 *
 * Deliberately the *previous* year rather than simply "the beginning of time":
 * extending the first year's window backwards without a bound would sweep in
 * whatever a school entered while it was still setting itself up, and
 * extending a later year's would double-count the year before it — the two
 * windows must not overlap, or a receipt is in the takings of two years.
 */
function previousYearEnd(
  schoolYears: readonly { startDate: Date; endDate: Date }[] | undefined,
  currentStart: Date,
): Date | null {
  let latest: Date | null = null;
  for (const year of schoolYears ?? []) {
    const end = startOfDay(year.endDate);
    if (end < currentStart && (latest === null || end > latest)) latest = end;
  }
  return latest;
}

function union(
  a: { from: Date; to: Date },
  b: { from: Date; to: Date },
): { from: Date; to: Date } {
  return { from: minDate(a.from, b.from), to: maxDate(a.to, b.to) };
}

function minDate(a: Date, b: Date): Date {
  return a <= b ? a : b;
}

function maxDate(a: Date, b: Date): Date {
  return a >= b ? a : b;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
