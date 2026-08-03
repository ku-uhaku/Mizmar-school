"use client";

import * as React from "react";

import { saveAppearanceAction } from "@/modules/appearance/actions";
import { DEFAULT_UI_PREFS, type UiPrefs } from "@/modules/appearance/prefs";

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

  /*
    Persistence is an effect, not part of the state update.

    It used to run inside the `setPrefsState` updater, which looked like the
    tidy place to catch the merged value. But an updater has to be a pure
    function: React calls it while rendering, and twice under StrictMode. Firing
    a Server Action from in there updated the Router mid-render — "Cannot update
    a component (Router) while rendering a different component" — and sent the
    write twice on top of it.

    Fire-and-forget, as before: the UI has already changed, and a failed write
    only means the preference is not remembered next visit.
  */
  // What the stored copy holds. Starts at `initial`, which is the identical
  // object `useState` is holding, so the first run compares equal and writes
  // nothing — the server rendered this page from the cookie, so a write at
  // mount would be one pointless request per page load. Comparing by reference
  // rather than counting renders also survives StrictMode's remount, which
  // would defeat a first-render flag.
  const lastPersisted = React.useRef(initial);

  React.useEffect(() => {
    if (prefs === lastPersisted.current) return;
    lastPersisted.current = prefs;
    void saveAppearanceAction(prefs);
  }, [prefs]);

  const setPrefs = React.useCallback((patch: Partial<UiPrefs>) => {
    setPrefsState((current) => ({ ...current, ...patch }));
  }, []);

  const reset = React.useCallback(() => {
    setPrefsState(DEFAULT_UI_PREFS);
  }, []);

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
