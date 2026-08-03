import type { Locale } from "@/lib/i18n/config";

/**
 * Fills `{placeholder}` slots in a dictionary string.
 *
 *   interpolate("{count} of {total}", { count: 3, total: 9 }) // "3 of 9"
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const INTL_LOCALES: Record<Locale, string> = {
  fr: "fr-MA",
  en: "en-GB",
  // Arabic with Latin digits — Moroccan administrative documents use these, and
  // they keep dates and counts legible alongside the Latin-script data.
  ar: "ar-MA-u-nu-latn",
};

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale];
}

export function formatDate(
  value: Date | string | null | undefined,
  locale: Locale,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(
  value: Date | string | null | undefined,
  locale: Locale,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/**
 * A number with a fixed number of decimals — "45,0", "10,9".
 *
 * For quantities that are stored as integers in a smaller unit and read in a
 * larger one: litres held in tenths, a consumption figure per 100 km. Fixed
 * rather than "up to", because a column of 45,0 and 46 does not line up and the
 * trailing zero is what says the tenth was measured.
 *
 * Money does not come through here — it has `formatAmount` and `formatMoney`,
 * which fix two decimals and know about the currency.
 */
export function formatDecimal(
  value: number,
  locale: Locale,
  fractionDigits = 1,
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * "September 2025" — the label for a column or card standing for a whole month.
 *
 * Takes the month 1-based, as the schedule's `dueMonth` stores it, rather than
 * a Date: the callers have a year and a month and would otherwise each invent
 * their own off-by-one when constructing one.
 */
export function formatMonth(
  year: number,
  month: number,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

/** An amount of money, from centimes, without the currency symbol. */
export function formatAmount(centimes: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimes / 100);
}

/**
 * The same amount with the school's currency after it — "1 200,00 MAD".
 *
 * The code rather than `Intl`'s currency style on purpose: `Intl` renders MAD
 * as "MAD" in French and "د.م." in Arabic, and a school's paperwork, its
 * receipts and its bank all say the same three letters whatever language the
 * screen is in. Amounts stay in the currency's minor unit throughout, so this
 * only ever changes the label.
 */
export function formatMoney(
  centimes: number,
  locale: Locale,
  currencyCode: string,
): string {
  return `${formatAmount(centimes, locale)} ${currencyCode}`;
}

/*
  `toDateInputValue` deliberately does not live here.

  There were two of it: this file's, which read the date in UTC, and the one in
  lib/utils.ts, which reads it in local time and carries the note explaining why
  that is the only correct frame for a wall-calendar date. Both were imported
  around the app, so which one a screen got — and whether its dates were a day
  out — depended on nothing more than which import somebody reached for.

  Re-exported rather than redefined, so there is one implementation and this
  module stays the obvious place to look for it.
*/
export { toDateInputValue } from "@/lib/utils";
