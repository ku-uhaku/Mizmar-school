import type { Dictionary } from "@/lib/i18n/types";
import {
  NAV_SECTIONS,
  type NavEntry,
  type NavIcon,
  type NavSection,
} from "@/lib/module";
import { isPermissionCode, type PermissionCode } from "@/lib/permissions";
import { MODULES } from "@/modules/registry";

/**
 * The sidebar, assembled from the module registry.
 *
 * Navigation is filtered on the server against the user's permissions, so a
 * link is never rendered to a page the user would then be refused. Entries are
 * plain data (icons are names, not components) because the filtered result is
 * passed to a client component.
 */

export type { NavIcon };

/** A section with its entries, ready to render. */
export type NavGroup = {
  section: NavSection;
  /** Key in the `nav` dictionary namespace, e.g. "administration". */
  titleKey: keyof Dictionary["nav"];
  items: NavEntry[];
};

/**
 * Fails loudly in development when a module points a nav entry at a permission
 * that is not in the catalogue — a typo there would otherwise hide the link
 * from everyone, which is easy to miss and slow to diagnose.
 *
 * `NavEntry` cannot type these as `PermissionCode` directly: that type is
 * derived from the registry, and the registry imports the manifests.
 */
function assertPermission(
  value: string | undefined,
  moduleId: string,
  href: string,
): PermissionCode | undefined {
  if (value === undefined) return undefined;
  if (!isPermissionCode(value)) {
    throw new Error(
      `Module "${moduleId}" points ${href} at unknown permission "${value}". ` +
        `Declare it in modules/${moduleId}/permissions.ts and register it in modules/registry.ts.`,
    );
  }
  return value;
}

/** Every nav entry from every module, sorted, with its permissions checked. */
const ALL_ENTRIES: NavEntry[] = MODULES.flatMap((module) =>
  (module.nav ?? []).map((entry) => {
    if (process.env.NODE_ENV !== "production") {
      assertPermission(entry.orgPermission, module.id, entry.href);
      assertPermission(entry.schoolPermission, module.id, entry.href);
    }
    return entry;
  }),
).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

/**
 * Every nav href with the section it belongs to, longest first.
 *
 * Sorted once at module load so the lookup below is a scan for the first match
 * rather than a scan for the best one.
 */
const SECTION_BY_HREF: { href: string; section: NavSection }[] =
  ALL_ENTRIES.map((entry) => ({
    href: entry.href,
    section: entry.section,
  })).sort((a, b) => b.href.length - a.href.length);

/**
 * Which section a URL belongs to, for the section colour (see globals.css).
 *
 * Longest match wins, by the same rule the sidebar highlights with — otherwise
 * `/transport` and `/transport/routes` would both claim `/transport/routes`.
 * Routes with no nav entry of their own inherit their parent's: `/students/new`
 * has no sidebar row, and is still vie scolaire.
 *
 * Unfiltered by permission on purpose. This decides a hue, not access, and the
 * page behind it has already made the real check — running the permission
 * filter here would mean threading an AuthContext into a client component to
 * choose a colour.
 */
export function sectionForPath(pathname: string): NavSection | null {
  for (const entry of SECTION_BY_HREF) {
    if (entry.href === "/") continue;
    if (pathname === entry.href || pathname.startsWith(`${entry.href}/`)) {
      return entry.section;
    }
  }
  return pathname === "/" ? "main" : null;
}

/**
 * Keeps only the sections and entries the given user may reach.
 *
 * `canOrg` is the org-wide check and `can` the current-school one; an org-wide
 * grant satisfies a school requirement too (see lib/dal.ts), so a single
 * `schoolPermission` covers both kinds of role.
 */
export function visibleSections(
  canOrg: (permission: PermissionCode) => boolean,
  can: (permission: PermissionCode) => boolean,
): NavGroup[] {
  return NAV_SECTIONS.map((section) => ({
    section,
    titleKey: section,
    items: ALL_ENTRIES.filter((entry) => {
      if (entry.section !== section) return false;
      if (
        entry.orgPermission &&
        !canOrg(entry.orgPermission as PermissionCode)
      ) {
        return false;
      }
      if (
        entry.schoolPermission &&
        !can(entry.schoolPermission as PermissionCode)
      ) {
        return false;
      }
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
