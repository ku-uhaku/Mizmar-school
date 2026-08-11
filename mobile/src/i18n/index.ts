/**
 * The one import a screen needs for language: `import { useT, useFormat, label } from "../src/i18n";`
 */
export { LocaleProvider, useI18n, useT, useFormat, useLocale } from "./context";
export { interpolate } from "./interpolate";
export { isoDay, label } from "./format";
export type { Formatters } from "./format";
export { LOCALES, LOCALE_META, DEFAULT_LOCALE, dirOf } from "./locale";
export type { Locale } from "./locale";
export type { Dictionary } from "./en";
