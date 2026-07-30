import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Navigation is declared once here and filtered server-side against the user's
 * permissions, so a link is never rendered to a page the user would be refused.
 * Icons are referenced by name because components are not serialisable across
 * the server/client boundary.
 */
export type NavIcon =
  | "dashboard"
  | "organization"
  | "schools"
  | "schoolYears"
  | "users"
  | "roles"
  | "profile"
  | "appearance";

export type NavItem = {
  href: string;
  icon: NavIcon;
  labelKey: keyof Dictionary["nav"];
  /** Required org-wide; omitted means "always visible". */
  orgPermission?: PermissionCode;
  /** Required in the current school (satisfied by an org-wide grant too). */
  schoolPermission?: PermissionCode;
};

export type NavSection = {
  titleKey: keyof Dictionary["nav"];
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "main",
    items: [
      { href: "/", icon: "dashboard", labelKey: "dashboard" },
      {
        href: "/schools",
        icon: "schools",
        labelKey: "schools",
        schoolPermission: PERMISSIONS.SCHOOL_VIEW,
      },
      {
        href: "/school-years",
        icon: "schoolYears",
        labelKey: "schoolYears",
        schoolPermission: PERMISSIONS.SCHOOL_YEAR_VIEW,
      },
    ],
  },
  {
    titleKey: "administration",
    items: [
      {
        href: "/organization",
        icon: "organization",
        labelKey: "organization",
        schoolPermission: PERMISSIONS.ORGANIZATION_VIEW,
      },
      {
        href: "/users",
        icon: "users",
        labelKey: "users",
        schoolPermission: PERMISSIONS.USER_VIEW,
      },
      {
        href: "/roles",
        icon: "roles",
        labelKey: "roles",
        orgPermission: PERMISSIONS.ROLE_VIEW,
      },
    ],
  },
  {
    titleKey: "account",
    items: [
      { href: "/profile", icon: "profile", labelKey: "profile" },
      { href: "/appearance", icon: "appearance", labelKey: "appearance" },
    ],
  },
];

/** Keeps only the sections and items the given user may reach. */
export function visibleSections(
  canOrg: (permission: PermissionCode) => boolean,
  can: (permission: PermissionCode) => boolean,
): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.orgPermission && !canOrg(item.orgPermission)) return false;
      if (item.schoolPermission && !can(item.schoolPermission)) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);
}
