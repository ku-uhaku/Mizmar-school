import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/utils";

/**
 * Reads for the users module. See modules/schools/queries.ts for the contract.
 *
 * Visibility here has two tiers, and both the list and the edit screen must
 * agree with `assertCanActOnUser` in `actions.ts`:
 *
 *   org-wide USER_VIEW  → every user in the organisation
 *   school-scoped only  → only users holding a membership in one of the actor's
 *                         schools, and never one who outranks them
 *
 * That is why the scoping lives in this file instead of in the pages.
 */

/** The shape the users table and the user form both render. */
export type UserRow = {
  id: string;
  email: string;
  /** Null for accounts that do not sign in at the dashboard — see User.username. */
  username: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  jobFunctionId: string | null;
  /** What the picker showed when it was chosen. Null when none is set. */
  jobFunctionName: string | null;
  avatarUrl: string | null;
  /** `YYYY-MM-DD` for `<input type="date">`; age is derived, never stored. */
  birthDate: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  orgRoleId: string | null;
  orgRoleName: string | null;
  memberships: {
    schoolId: string;
    schoolName: string;
    roleId: string;
    roleName: string;
  }[];
  /** ISO string — serialised for the client component, formatted per-locale there. */
  lastLoginAt: string | null;
  isSelf: boolean;
};

function includeFor(visibleSchoolIds: string[], hasOrgReach: boolean) {
  return {
    // The fonction comes through so a list can print it without a second
    // read — see `jobFunction` on Profile.
    profile: { include: { jobFunction: { select: { id: true, name: true } } } },
    orgRole: { select: { id: true, name: true } },
    memberships: {
      // A school-scoped admin sees only the memberships inside their own
      // schools, so they cannot learn where else a user works.
      where: hasOrgReach ? {} : { schoolId: { in: visibleSchoolIds } },
      include: {
        school: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    },
  };
}

type UserWithRelations = Awaited<
  ReturnType<
    typeof db.user.findFirstOrThrow<{ include: ReturnType<typeof includeFor> }>
  >
>;

function toRow(user: UserWithRelations, currentUserId: string): UserRow {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.profile?.firstName ?? "",
    lastName: user.profile?.lastName ?? "",
    phone: user.profile?.phone ?? null,
    jobFunctionId: user.profile?.jobFunctionId ?? null,
    jobFunctionName: user.profile?.jobFunction?.name ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    birthDate: toDateInputValue(user.profile?.birthDate),
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    orgRoleId: user.orgRole?.id ?? null,
    orgRoleName: user.orgRole?.name ?? null,
    memberships: user.memberships.map((membership) => ({
      schoolId: membership.school.id,
      schoolName: membership.school.name,
      roleId: membership.role.id,
      roleName: membership.role.name,
    })),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    isSelf: user.id === currentUserId,
  };
}

export async function listUsers(context: AuthContext): Promise<UserRow[]> {
  const visibleSchoolIds = context.schools.map((school) => school.id);
  const hasOrgReach = context.canOrg(PERMISSIONS.USER_VIEW);

  const users = await db.user.findMany({
    where: hasOrgReach
      ? { organizationId: context.organization.id }
      : {
          organizationId: context.organization.id,
          memberships: { some: { schoolId: { in: visibleSchoolIds } } },
        },
    orderBy: [{ profile: { lastName: "asc" } }, { email: "asc" }],
    include: includeFor(visibleSchoolIds, hasOrgReach),
  });

  return users.map((user) => toRow(user, context.user.id));
}

/**
 * One user, for the edit screen. Null when out of reach — callers turn that
 * into `notFound()` rather than a forbidden state, so a school-scoped admin
 * cannot probe for the existence of users outside their schools.
 *
 * `permission` is the one being exercised, because org-wide reach is decided per
 * permission rather than once for the whole module.
 */
export async function findUser(
  context: AuthContext,
  userId: string,
  permission: typeof PERMISSIONS.USER_VIEW | typeof PERMISSIONS.USER_UPDATE,
): Promise<UserRow | null> {
  const visibleSchoolIds = context.schools.map((school) => school.id);
  const hasOrgReach = context.canOrg(permission);

  const user = await db.user.findFirst({
    where: hasOrgReach
      ? { id: userId, organizationId: context.organization.id }
      : {
          id: userId,
          organizationId: context.organization.id,
          memberships: { some: { schoolId: { in: visibleSchoolIds } } },
          // Out of reach for a school-scoped admin: someone who outranks them.
          isSuperAdmin: false,
          orgRoleId: null,
        },
    include: includeFor(visibleSchoolIds, hasOrgReach),
  });

  return user ? toRow(user, context.user.id) : null;
}

/**
 * The fonctions of the school being worked in.
 *
 * Active ones only: `isActive` is how a merged or misspelt entry stops being
 * offered without rewriting who held it, so an inactive one must not come back
 * through the picker. Whoever already holds it keeps it — the form reads the
 * name off the row, not off this list.
 *
 * Its own export because the hire form needs it too, and `StaffFunction` is
 * this module's table: `modules/hr` reaching for `db.staffFunction` itself
 * would be the cross-module raw read the layering rules forbid.
 */
export async function listJobFunctionChoices(
  context: AuthContext,
): Promise<{ id: string; name: string }[]> {
  return db.staffFunction.findMany({
    where: { schoolId: context.currentSchool?.id ?? "", isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

/**
 * The choices the user form needs. Shared by the create and edit routes so the
 * two can never drift apart in what they offer.
 */
export async function loadUserFormChoices(context: AuthContext) {
  const [orgRoles, schoolRoles, jobFunctions] = await Promise.all([
    db.role.findMany({
      where: { organizationId: context.organization.id, scope: "ORG" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.role.findMany({
      where: { organizationId: context.organization.id, scope: "SCHOOL" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listJobFunctionChoices(context),
  ]);

  return {
    orgRoles,
    schoolRoles,
    jobFunctions,
    // Only schools this actor can reach — the action filters memberships the
    // same way, so the form can never offer a school it would then discard.
    schools: context.schools.map((school) => ({
      id: school.id,
      name: school.name,
      code: school.code,
    })),
  };
}

/** Live counts for the dashboard, scoped the same way as `listUsers`. */
export async function countUsers(
  context: AuthContext,
): Promise<{ total: number; active: number }> {
  const visibleSchoolIds = context.schools.map((school) => school.id);
  // The tenant is on both branches, exactly as `listUsers` has it. A membership
  // in one of the reader's own schools already implies the organisation, so this
  // changes no figure today — but the count and the list are meant to be the
  // same scope, and only one of them saying so is how they come apart later.
  const scope = context.canOrg(PERMISSIONS.USER_VIEW)
    ? { organizationId: context.organization.id }
    : {
        organizationId: context.organization.id,
        memberships: { some: { schoolId: { in: visibleSchoolIds } } },
      };

  const [total, active] = await Promise.all([
    db.user.count({ where: scope }),
    db.user.count({ where: { ...scope, isActive: true } }),
  ]);

  return { total, active };
}
