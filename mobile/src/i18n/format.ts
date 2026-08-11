import { intlTagOf, type Locale } from "./locale";

/**
 * Formatting, bound to whichever language the phone is currently reading in.
 *
 * ── Why a factory rather than module-level formatters ───────────────────────
 * The single-language version of this file built its `Intl` instances once, at
 * import time, fixed to `fr-MA`. Three languages means the tag can no longer be
 * a constant — it is `useLocale().locale` — so every formatter is built from it
 * on each call instead of memoised at the top of the module. `Intl` is not slow
 * enough for that to matter on a phone screen with a few dozen rows.
 *
 * `useFormat()` in `./context` is the caller-facing half of this: it wraps
 * `createFormatters` with the current locale so a screen never threads one
 * through by hand.
 */

export function createFormatters(locale: Locale) {
  const intl = intlTagOf(locale);

  const longDateFmt = new Intl.DateTimeFormat(intl, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const shortDateFmt = new Intl.DateTimeFormat(intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const clockFmt = new Intl.DateTimeFormat(intl, {
    hour: "2-digit",
    minute: "2-digit",
    // Not left to the locale: a school's horaires and its bus timetable are
    // both written 07:00 and 17:00, and an English screen showing "5:00 PM"
    // beside a paper schedule reading 17:00 is worse than a fixed clock.
    hourCycle: "h23",
  });
  const monthFmt = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
  });

  return {
    /** An amount from centimes, with the school's currency after it. */
    money(centimes: number): string {
      const amount = (centimes / 100).toLocaleString(intl, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      // The code, not `Intl`'s currency style: that renders MAD as "د.م.‏" in
      // Arabic, and a receipt, a fee grid and this phone should all say the
      // same three letters whatever language the screen is in — see the note
      // on `formatMoney` in lib/i18n/format.ts on the web, which makes the
      // same call.
      return `${amount} MAD`;
    },

    /** "mardi 4 mars" — a day worth naming in full, not just dating. */
    longDate(value: string | Date): string {
      return longDateFmt.format(new Date(value));
    },

    /** "04/03/2026". */
    shortDate(value: string | Date): string {
      return shortDateFmt.format(new Date(value));
    },

    /** "07:12" — an instant from the server as a wall clock. */
    clock(value: string | Date): string {
      return clockFmt.format(new Date(value));
    },

    /** `"2026-03"` → "mars 2026", for a card or column standing for a month. */
    monthLabel(month: string): string {
      const [year, index] = month.split("-");
      if (!year || !index) return month;
      return monthFmt.format(new Date(Number(year), Number(index) - 1, 1));
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;

/** `2026-08-04`, the form the API's `?date=` expects. Not locale-dependent. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One dictionary entry for an enum-like string the API returns. */
export function label(
  dictionary: Record<string, string>,
  value: string | null,
): string {
  if (!value) return "—";
  return dictionary[value] ?? value;
}
