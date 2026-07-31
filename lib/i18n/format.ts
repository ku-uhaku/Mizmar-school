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

/** `<input type="date">` needs a plain YYYY-MM-DD value, never a localised one. */
export function toDateInputValue(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
