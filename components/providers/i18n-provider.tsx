"use client";

import * as React from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  /** `fmt(t.dashboard.welcome, { name })` → interpolated string. */
  fmt: (template: string, values: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dir,
  dictionary,
  children,
}: {
  locale: Locale;
  dir: "ltr" | "rtl";
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = React.useMemo<I18nValue>(
    () => ({ locale, dir, t: dictionary, fmt: interpolate }),
    [locale, dir, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>.");
  }
  return ctx;
}

/** Convenience for the common case: `const t = useT()`. */
export function useT(): Dictionary {
  return useI18n().t;
}

export function useLocale(): Locale {
  return React.useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
}
