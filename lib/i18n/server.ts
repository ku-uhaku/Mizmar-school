import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";

// Static imports (rather than dynamic ones) keep all three dictionaries in the
// server bundle — they are small, and it avoids an await on every render.
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import fr from "@/lib/i18n/dictionaries/fr";

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as unknown as Dictionary,
  fr,
  ar,
};

/** Reads the locale cookie. Memoised per request render pass. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export function getDictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** The dictionary for the current request's locale. */
export const getDictionary = cache(async (): Promise<Dictionary> => {
  return getDictionaryFor(await getLocale());
});
