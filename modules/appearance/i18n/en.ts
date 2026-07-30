/**
 * Appearance translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  appearance: {
    title: "Appearance",
    subtitle: "Tune the interface to your liking. Saved to your profile.",
    language: "Language",
    languageHint: "Arabic switches the whole interface to right-to-left.",
    themeMode: "Theme",
    accent: "Accent colour",
    fontFamily: "Font",
    fontSize: "Text size",
    radius: "Corner radius",
    preview: "Preview",
    previewHeading: "The quick brown fox",
    previewBody: "Use the controls to see how the dashboard will look. Changes apply immediately and are stored on your profile.",
    previewButton: "Primary action",
    previewSecondary: "Secondary",
    reset: "Reset to defaults",
    updated: "Appearance saved.",
    modes: {
      light: "Light",
      dark: "Dark",
      system: "System",
    },
    accents: {
      blue: "Blue",
      emerald: "Emerald",
      violet: "Violet",
      amber: "Amber",
      rose: "Rose",
      teal: "Teal",
      neutral: "Neutral",
    },
    fonts: {
      geist: "Geist",
      inter: "Inter",
      system: "System",
      mono: "Monospace",
    },
    sizes: {
      sm: "Small",
      md: "Medium",
      lg: "Large",
      xl: "Extra large",
    },
    radii: {
      none: "Square",
      sm: "Small",
      md: "Medium",
      lg: "Large",
      xl: "Extra large",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  appearance: "Appearance",
} as const;

export default en;
