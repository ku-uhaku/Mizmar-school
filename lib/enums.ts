/**
 * SQLite has no native enum type, so these unions are the source of truth for
 * every "enum-like" column in prisma/schema.prisma. Keep both in sync.
 */

export const SCHOOL_LEVELS = [
  "PRESCHOOL",
  "PRIMARY",
  "MIDDLE",
  "HIGH",
  "GROUP",
] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export const SCHOOL_YEAR_STATUSES = ["PLANNED", "ACTIVE", "CLOSED"] as const;
export type SchoolYearStatus = (typeof SCHOOL_YEAR_STATUSES)[number];

export const ROLE_SCOPES = ["ORG", "SCHOOL"] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

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
