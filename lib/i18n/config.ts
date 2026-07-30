export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; englishLabel: string; dir: "ltr" | "rtl" }
> = {
  fr: { label: "Français", englishLabel: "French", dir: "ltr" },
  en: { label: "English", englishLabel: "English", dir: "ltr" },
  ar: { label: "العربية", englishLabel: "Arabic", dir: "rtl" },
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return LOCALE_META[locale].dir;
}
