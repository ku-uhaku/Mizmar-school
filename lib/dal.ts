import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions";

/**
 * Data Access Layer.
 *
 * Every authorization decision in the app is made here, against the database,
 * on each request. The JWT holds nothing but a user id — so revoking a role or
 * deactivating an account takes effect immediately instead of when the token
 * expires.
 *
 * Server Functions are reachable by direct POST, so callers must use these
 * helpers inside the action itself; a check on the page that renders the form
 * protects nothing.
 */

/** Loads the signed-in user with everything needed to resolve permissions. */
const loadUser = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      organization: true,
      orgRole: { include: { permissions: { include: { permission: true } } } },
      memberships: {
        include: {
          school: true,
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });

  // A user deactivated mid-session loses access on their very next request.
  if (!user || !user.isActive) return null;

  return user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

export type AuthContext = {
  user: SessionUser;
  organization: SessionUser["organization"];
  /** Schools this user may see at all. */
  schools: SessionUser["memberships"][number]["school"][];
  currentSchool: SessionUser["memberships"][number]["school"] | null;
  currentSchoolYear: SchoolYearRecord | null;
  /** School years of the current school, for the context switcher. */
  schoolYears: SchoolYearRecord[];
  /** Permissions that apply everywhere (super admin, or the org-wide role). */
  orgPermissions: Set<string>;
  /** Effective permissions inside `currentSchool`. */
  permissions: Set<string>;
  isSuperAdmin: boolean;
  /** True org-wide, regardless of which school is selected. */
  canOrg: (permission: PermissionCode) => boolean;
  /** True in the currently selected school. */
  can: (permission: PermissionCode) => boolean;
  /** True in one specific school. */
  canInSchool: (schoolId: string, permission: PermissionCode) => boolean;
};

type SchoolYearRecord = Awaited<ReturnType<typeof loadSchoolYears>>[number];

function loadSchoolYears(schoolId: string) {
  return db.schoolYear.findMany({
    where: { schoolId },
    orderBy: [{ startDate: "desc" }],
  });
}

function permissionCodesOf(
  role:
    | { permissions: { permission: { code: string } }[] }
    | null
    | undefined,
): string[] {
  return role?.permissions.map((entry) => entry.permission.code) ?? [];
}

/**
 * Builds the full authorization context for the current request.
 * Returns null when nobody is signed in.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await loadUser();
  if (!user) return null;

  const isSuperAdmin = user.isSuperAdmin;

  // Org-wide permissions come from the super-admin flag or the org role only.
  const orgPermissions = new Set<string>(
    isSuperAdmin ? ALL_PERMISSION_CODES : permissionCodesOf(user.orgRole),
  );

  // Per-school permissions layer the school role on top of the org-wide set.
  const permissionsBySchool = new Map<string, Set<string>>();
  for (const membership of user.memberships) {
    permissionsBySchool.set(
      membership.schoolId,
      new Set<string>([
        ...orgPermissions,
        ...permissionCodesOf(membership.role),
      ]),
    );
  }

  // Anyone with org-wide reach sees every school; everyone else sees only the
  // schools they hold a membership in.
  const hasOrgReach = isSuperAdmin || user.orgRoleId !== null;
  const schools = hasOrgReach
    ? await db.school.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: "asc" },
      })
    : user.memberships
        .map((membership) => membership.school)
        .sort((a, b) => a.name.localeCompare(b.name));

  // Fall back to the first accessible school when the stored context points at
  // a school the user no longer has access to. Deliberately not persisted here
  // — rendering a page must not write to the database.
  const currentSchool =
    schools.find((school) => school.id === user.currentSchoolId) ??
    schools[0] ??
    null;

  const schoolYears = currentSchool ? await loadSchoolYears(currentSchool.id) : [];

  const currentSchoolYear =
    schoolYears.find((year) => year.id === user.currentSchoolYearId) ??
    schoolYears.find((year) => year.isDefault) ??
    schoolYears.find((year) => year.status === "ACTIVE") ??
    schoolYears[0] ??
    null;

  const permissionsInSchool = (schoolId: string): Set<string> =>
    permissionsBySchool.get(schoolId) ?? orgPermissions;

  const permissions = currentSchool
    ? permissionsInSchool(currentSchool.id)
    : orgPermissions;

  return {
    user,
    organization: user.organization,
    schools,
    currentSchool,
    currentSchoolYear,
    schoolYears,
    orgPermissions,
    permissions,
    isSuperAdmin,
    canOrg: (permission) => orgPermissions.has(permission),
    can: (permission) => permissions.has(permission),
    canInSchool: (schoolId, permission) =>
      permissionsInSchool(schoolId).has(permission),
  };
});

/** For pages and actions that require a signed-in user. Redirects otherwise. */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  return context;
}

/** Thrown by `authorize`; action wrappers turn it into a localised message. */
export class ForbiddenError extends Error {
  constructor(permission?: string) {
    super(permission ? `Missing permission: ${permission}` : "Forbidden");
    this.name = "ForbiddenError";
  }
}

/** Asserts an org-wide permission inside a Server Action. */
export async function authorizeOrg(
  permission: PermissionCode,
): Promise<AuthContext> {
  const context = await requireAuth();
  if (!context.canOrg(permission)) throw new ForbiddenError(permission);
  return context;
}

/**
 * Asserts the permission is held *somewhere* — org-wide, or in at least one
 * school the user can reach. For actions that are not tied to a single school
 * (creating a user, for example) where the affected rows are constrained
 * separately. Callers must still scope what they read and write.
 */
export async function authorizeAnyScope(
  permission: PermissionCode,
): Promise<AuthContext> {
  const context = await requireAuth();
  const held =
    context.canOrg(permission) ||
    context.schools.some((school) =>
      context.canInSchool(school.id, permission),
    );
  if (!held) throw new ForbiddenError(permission);
  return context;
}

/** Asserts a permission within one specific school inside a Server Action. */
export async function authorizeSchool(
  schoolId: string,
  permission: PermissionCode,
): Promise<AuthContext> {
  const context = await requireAuth();
  // Membership is re-derived from the session, never taken from the request.
  const visible = context.schools.some((school) => school.id === schoolId);
  if (!visible || !context.canInSchool(schoolId, permission)) {
    throw new ForbiddenError(permission);
  }
  return context;
}

/** Display name helper used across the shell and tables. */
export function displayName(user: {
  profile: { firstName: string; lastName: string } | null;
  email: string;
}): string {
  if (!user.profile) return user.email;
  const full = `${user.profile.firstName} ${user.profile.lastName}`.trim();
  return full === "" ? user.email : full;
}
