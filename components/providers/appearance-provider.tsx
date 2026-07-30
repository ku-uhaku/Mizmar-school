"use client";

import * as React from "react";

import { saveAppearanceAction } from "@/app/actions/appearance";
import { DEFAULT_UI_PREFS, type UiPrefs } from "@/lib/appearance";

type AppearanceValue = {
  prefs: UiPrefs;
  /** "dark" | "light" — `system` already resolved against the media query. */
  resolvedMode: "light" | "dark";
  /** Applies immediately, then persists to the cookie and the user's profile. */
  setPrefs: (patch: Partial<UiPrefs>) => void;
  reset: () => void;
};

const AppearanceContext = React.createContext<AppearanceValue | null>(null);

export function AppearanceProvider({
  initial,
  children,
}: {
  initial: UiPrefs;
  children: React.ReactNode;
}) {
  const [prefs, setPrefsState] = React.useState<UiPrefs>(initial);
  const [systemDark, setSystemDark] = React.useState(false);

  // Track the OS preference so `mode: "system"` can resolve.
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const resolvedMode: "light" | "dark" =
    prefs.mode === "dark" || (prefs.mode === "system" && systemDark)
      ? "dark"
      : "light";

  // Mirror state onto <html>. The server already rendered these attributes from
  // the cookie, so this only does work when the user changes something — except
  // for `system`, which can only be resolved on the client.
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedMode === "dark");
    root.dataset.accent = prefs.accent;
    root.dataset.font = prefs.fontFamily;
    root.dataset.size = prefs.fontSize;
    root.dataset.radius = prefs.radius;
    root.style.colorScheme = resolvedMode;
  }, [prefs, resolvedMode]);

  const persist = React.useCallback((next: UiPrefs) => {
    // Fire-and-forget: the UI has already updated optimistically, and a failed
    // write only means the preference is not remembered next visit.
    void saveAppearanceAction(next);
  }, []);

  const setPrefs = React.useCallback(
    (patch: Partial<UiPrefs>) => {
      setPrefsState((current) => {
        const next = { ...current, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = React.useCallback(() => {
    setPrefsState(DEFAULT_UI_PREFS);
    persist(DEFAULT_UI_PREFS);
  }, [persist]);

  const value = React.useMemo<AppearanceValue>(
    () => ({ prefs, resolvedMode, setPrefs, reset }),
    [prefs, resolvedMode, setPrefs, reset],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceValue {
  const ctx = React.useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside <AppearanceProvider>.");
  }
  return ctx;
}

/**
 * Runs before first paint to resolve `mode: "system"`, which the server cannot
 * know. Without it the page would render light and snap to dark on hydration.
 */
export function AppearanceScript({ mode }: { mode: UiPrefs["mode"] }) {
  const script = `(function(){try{var m=${JSON.stringify(mode)};var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
