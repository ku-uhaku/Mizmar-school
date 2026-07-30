import {
  ACCENTS,
  FONT_FAMILIES,
  FONT_SIZES,
  RADII,
  THEME_MODES,
  type Accent,
  type FontFamily,
  type FontSize,
  type Radius,
  type ThemeMode,
} from "@/lib/enums";

/**
 * Appearance preferences. The user's Profile row is the source of truth; the
 * `ui-prefs` cookie mirrors it so the very first server render already has the
 * right theme and there is no flash on load.
 *
 * Importable from both server and client — no `server-only` here.
 */
export type UiPrefs = {
  mode: ThemeMode;
  accent: Accent;
  fontFamily: FontFamily;
  fontSize: FontSize;
  radius: Radius;
};

export const UI_PREFS_COOKIE = "ui-prefs";

export const DEFAULT_UI_PREFS: UiPrefs = {
  mode: "system",
  accent: "blue",
  fontFamily: "geist",
  fontSize: "md",
  radius: "md",
};

function pick<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Validates arbitrary input (cookie or DB row) into a complete UiPrefs. */
export function normalizeUiPrefs(input: unknown): UiPrefs {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    mode: pick(THEME_MODES, raw.mode, DEFAULT_UI_PREFS.mode),
    accent: pick(ACCENTS, raw.accent, DEFAULT_UI_PREFS.accent),
    fontFamily: pick(
      FONT_FAMILIES,
      raw.fontFamily,
      DEFAULT_UI_PREFS.fontFamily,
    ),
    fontSize: pick(FONT_SIZES, raw.fontSize, DEFAULT_UI_PREFS.fontSize),
    radius: pick(RADII, raw.radius, DEFAULT_UI_PREFS.radius),
  };
}

export function parseUiPrefsCookie(value: string | undefined): UiPrefs {
  if (!value) return DEFAULT_UI_PREFS;
  try {
    return normalizeUiPrefs(JSON.parse(value));
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

export function serializeUiPrefs(prefs: UiPrefs): string {
  return JSON.stringify(prefs);
}

/**
 * The `data-*` attributes and inline style the root <html> element carries.
 * Shared by the server render and the client-side live preview so the two can
 * never drift apart.
 */
export function uiPrefsToDataAttributes(prefs: UiPrefs) {
  return {
    "data-accent": prefs.accent,
    "data-font": prefs.fontFamily,
    "data-size": prefs.fontSize,
    "data-radius": prefs.radius,
  } as const;
}
