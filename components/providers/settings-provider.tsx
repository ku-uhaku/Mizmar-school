"use client";

import * as React from "react";

import { useLocale } from "@/components/providers/i18n-provider";
import { formatMoney } from "@/lib/i18n/format";
import {
  DEFAULT_SETTINGS,
  type SchoolSettingsValues,
} from "@/lib/school-settings";

/**
 * Puts the working school's policies within reach of client components.
 *
 * Several screens need them where there is no server to ask: the mark sheet
 * colours a failing score as the teacher types, the payroll dialog previews a
 * daily rate, and every amount in the caisse wants the school's currency after
 * it. Threading `settings` down as a prop through six layers of manager and
 * dialog was the alternative, and it would have to be repeated for every new
 * screen.
 *
 * Mirrors `I18nProvider`, which solves the same problem for the dictionary —
 * including the fallback: a component rendered outside the provider gets the
 * defaults rather than throwing, because the defaults are the constants these
 * values replaced and no screen is wrong to use them.
 */
const SettingsContext = React.createContext<SchoolSettingsValues>(
  DEFAULT_SETTINGS,
);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: SchoolSettingsValues;
  children: React.ReactNode;
}) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SchoolSettingsValues {
  return React.useContext(SettingsContext);
}

/**
 * `money(centimes)` for client components — the school's currency, the user's
 * locale, in one call so no screen has to remember both.
 */
export function useMoney(): (centimes: number) => string {
  const { currencyCode } = useSettings();
  const locale = useLocale();

  return React.useCallback(
    (centimes: number) => formatMoney(centimes, locale, currencyCode),
    [locale, currencyCode],
  );
}
