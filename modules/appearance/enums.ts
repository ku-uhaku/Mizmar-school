/**
 * Allowed values for the appearance columns on Profile — the source of truth
 * for `prisma/schema/users/profile.prisma`. Labels live in `i18n/*.ts`.
 *
 * Every value here needs matching CSS in `app/globals.css` (the `[data-accent]`,
 * `[data-font]`, `[data-size]` and `[data-radius]` selectors), so adding one is
 * a two-file change.
 */

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const ACCENTS = [
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "teal",
  "neutral",
] as const;
export type Accent = (typeof ACCENTS)[number];

export const FONT_FAMILIES = ["geist", "inter", "system", "mono"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const FONT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export const RADII = ["none", "sm", "md", "lg", "xl"] as const;
export type Radius = (typeof RADII)[number];
