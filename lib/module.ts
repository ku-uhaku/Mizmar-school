/**
 * The module contract.
 *
 * A module is one bounded slice of the product — its tables, its permissions,
 * its routes, its translations and its UI, all in one folder under `modules/`.
 * This file defines the manifest each module exports from its `module.ts`, and
 * nothing else: it must stay importable from both server and client components,
 * so it may not import any `modules/*` value (that would be circular) nor
 * anything marked `server-only`.
 *
 * Manifests are pure data. The registry (`modules/registry.ts`) collects them
 * and the rest of the app derives from that — the permission catalogue, the
 * sidebar, the seed. Adding a module therefore means adding a folder and one
 * line in the registry, never editing five central lists.
 */

import type { Dictionary } from "@/lib/i18n/types";

/**
 * Icons are referenced by name, not by component: a component is not
 * serialisable across the server/client boundary, and the sidebar is filtered
 * on the server. `components/shell/nav-icon.tsx` maps names to components — add
 * the name here and the mapping there together.
 */
export type NavIcon =
  | "dashboard"
  | "organization"
  | "schools"
  | "schoolYears"
  | "users"
  | "roles"
  | "profile"
  | "appearance"
  | "configuration"
  | "schoolLife"
  | "students"
  | "families"
  | "classes"
  | "timetable"
  | "cashRegister"
  | "encaissement"
  | "decaissement"
  | "transfert"
  | "cheques"
  | "transport";

/** Where a nav entry sits in the sidebar. Rendered in this order. */
export const NAV_SECTIONS = [
  "main",
  "finance",
  "administration",
  "account",
] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export type NavEntry = {
  href: string;
  icon: NavIcon;
  section: NavSection;
  /**
   * Key in the `nav` dictionary namespace. The module supplies the string from
   * its own `i18n/*.ts` (the `nav` named export), so this is type-checked
   * against the merged dictionary rather than being a free-form string.
   */
  labelKey: keyof Dictionary["nav"];
  /** Lower sorts first within a section. Defaults to 100. */
  order?: number;
  /**
   * Required org-wide. Omit both permissions for "always visible".
   *
   * Typed as `string` rather than `PermissionCode`, because that type is
   * derived from the registry and importing it here would be circular. Modules
   * pass their own `permissions.ts` constants, and `lib/nav.ts` asserts in
   * development that every value is a real code.
   */
  orgPermission?: string;
  /** Required in the current school (an org-wide grant satisfies it too). */
  schoolPermission?: string;
};

/**
 * One row of the permission matrix. `codes` must be exactly the values of the
 * module's own `permissions.ts` object — see `definePermissions`.
 */
export type PermissionGroup = {
  /** Matches the `<group>` half of the module's codes, e.g. "school". */
  group: string;
  codes: readonly string[];
};

export type AppModule = {
  /** Folder name under `modules/`, and the key used in error messages. */
  id: string;
  /**
   * Folder under `prisma/schema/` holding this module's tables. Omit for
   * modules that own no tables (auth, dashboard, appearance). Declared so the
   * mapping is checkable rather than a convention people remember.
   */
  schemaFolder?: string;
  /** Sidebar entries this module contributes. */
  nav?: readonly NavEntry[];
  /** Permission rows this module contributes to the catalogue and matrix. */
  permissions?: readonly PermissionGroup[];
};

/**
 * Identity function that gives a manifest its literal types while still
 * checking it against `AppModule`. Prefer it over a bare object so a typo in
 * `section` or `icon` is a compile error at the definition site.
 */
export function defineModule<const T extends AppModule>(module: T): T {
  return module;
}

/**
 * Declares a module's permission codes.
 *
 * Codes are `<group>.<action>`; the group must match the module's
 * `PermissionGroup.group` so the matrix can lay them out. Keys are SCREAMING_CASE
 * and end up on the global `PERMISSIONS` object, so they must be unique
 * app-wide — prefix them with the module's domain.
 *
 *   export const SCHOOL_PERMISSIONS = definePermissions({
 *     SCHOOL_VIEW: "school.view",
 *   });
 */
export function definePermissions<
  const T extends Record<string, `${string}.${string}`>,
>(codes: T): T {
  return codes;
}
