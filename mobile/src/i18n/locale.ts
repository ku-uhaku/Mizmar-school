/**
 * The three languages the phone speaks, and what a screen needs to know about
 * each one beyond its dictionary — its own name, which way it reads, and the
 * `Intl` tag its dates and numbers format with.
 *
 * Mirrors `lib/i18n/config.ts` on the web in spirit — same three codes, same
 * default, same idea of a `dir` — but is its own file rather than a shared
 * import: the phone is a separate project, excluded from the web's tsconfig,
 * and pulling a web-side module into the bundle is exactly what the mobile
 * AGENTS.md warns against.
 */

export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Where the chosen language is kept — on the device, not the account. See LocaleProvider. */
export const LOCALE_STORAGE_KEY = "almanar.locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; dir: "ltr" | "rtl"; intl: string }
> = {
  fr: { label: "Français", dir: "ltr", intl: "fr-MA" },
  en: { label: "English", dir: "ltr", intl: "en-GB" },
  // Latin digits, as on Moroccan administrative paperwork — see the note on
  // `lib/i18n/format.ts` on the web, which makes the same choice.
  ar: { label: "العربية", dir: "rtl", intl: "ar-MA-u-nu-latn" },
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return LOCALE_META[locale].dir;
}

export function intlTagOf(locale: Locale): string {
  return LOCALE_META[locale].intl;
}
