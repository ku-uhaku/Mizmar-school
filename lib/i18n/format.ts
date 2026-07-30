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

/** `<input type="date">` needs a plain YYYY-MM-DD value, never a localised one. */
export function toDateInputValue(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
