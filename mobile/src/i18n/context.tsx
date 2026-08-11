import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, DevSettings, I18nManager } from "react-native";

import ar from "./ar";
import en, { type Dictionary } from "./en";
import fr from "./fr";
import { createFormatters, type Formatters } from "./format";
import {
  DEFAULT_LOCALE,
  dirOf,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./locale";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, ar };

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  fmt: Formatters;
  setLocale: (locale: Locale) => void;
  /** False until the stored preference has been read once. */
  isReady: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Tells React Native's layout engine which way to run, restarting the app if
 * that actually changes.
 *
 * ── Why a native flag rather than a style ───────────────────────────────────
 * `I18nManager.forceRTL` decides what `flexDirection: "row"` and the rest of
 * the app's layout do from the *next* launch, not the current render — it is
 * consulted once, when the native views are first laid out, so flipping it
 * mid-session changes nothing on screen until the JS bundle restarts. That is
 * also why the label pool below is not read from `t`: the dictionary belongs
 * to the locale being left, and the message is about the switch itself rather
 * than being one more string of the app's.
 *
 * `silent` is what the initial read at launch passes: if a previous session
 * changed the flag but the phone or the reload never actually happened, this
 * corrects it again without popping an alert on every cold start.
 */
function applyDirection(locale: Locale, { silent = false } = {}): void {
  const wantsRtl = dirOf(locale) === "rtl";
  if (I18nManager.isRTL === wantsRtl) return;

  I18nManager.allowRTL(wantsRtl);
  I18nManager.forceRTL(wantsRtl);

  if (silent) return;

  Alert.alert(
    wantsRtl ? "إعادة تشغيل التطبيق" : "Restart required",
    wantsRtl
      ? "يجب إعادة تشغيل التطبيق لعرض الواجهة بالاتجاه الصحيح."
      : "The app needs to restart to change reading direction.",
    [
      {
        text: wantsRtl ? "إعادة التشغيل" : "Restart",
        onPress: () => DevSettings.reload(),
      },
    ],
    { cancelable: false },
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      const next = isLocale(stored) ? stored : DEFAULT_LOCALE;
      setLocaleState(next);
      applyDirection(next, { silent: true });
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function setLocale(next: Locale): void {
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
    applyDirection(next);
  }

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirOf(locale),
      t: DICTIONARIES[locale],
      fmt: createFormatters(locale),
      setLocale,
      isReady,
    }),
    // `setLocale` is stable across renders — it closes over nothing that
    // changes — so it is deliberately left out rather than recreating `value`
    // (and therefore every consumer's memoised work) on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, isReady],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within a LocaleProvider");
  }
  return context;
}

/** Everything a screen might want at once — most reach for `useT` or `useFormat` instead. */
export function useI18n(): I18nValue {
  return useI18nContext();
}

/** The current dictionary. `const t = useT(); <Text>{t.login.title}</Text>`. */
export function useT(): Dictionary {
  return useI18nContext().t;
}

/** Formatters bound to the current locale — money, dates, the clock. */
export function useFormat(): Formatters {
  return useI18nContext().fmt;
}

/** The locale itself, its writing direction, and the way to change it. */
export function useLocale(): {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
} {
  const { locale, dir, setLocale } = useI18nContext();
  return { locale, dir, setLocale };
}
