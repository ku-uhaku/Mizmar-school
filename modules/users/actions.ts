"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeAnyScope, ForbiddenError, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { hashPassword } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  boolField,
  field,
  listField,
  withActionErrors,
} from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { userSchema } from "@/modules/users/validation";

function readUserForm(formData: FormData) {
  return {
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    email: field(formData, "email"),
    username: field(formData, "username"),
    password: formData.get("password") ?? "",
    phone: field(formData, "phone"),
    jobTitle: field(formData, "jobTitle"),
    birthDate: field(formData, "birthDate"),
    avatarUrl: field(formData, "avatarUrl"),
    orgRoleId: field(formData, "orgRoleId"),
    isActive: boolField(formData, "isActive"),
    isSuperAdmin: boolField(formData, "isSuperAdmin"),
    memberships: listField(formData, "memberships"),
  };
}

/**
 * Filters requested memberships down to what the actor is actually allowed to
 * grant: schools they can see, and roles that exist in their organisation with
 * SCHOOL scope. Anything else is dropped rather than trusted.
 */
async function resolveMemberships(
  context: AuthContext,
  requested: { schoolId: string; roleId: string }[],
) {
  if (requested.length === 0) return [];

  const visibleSchoolIds = new Set(context.schools.map((school) => school.id));

  const roles = await db.role.findMany({
    where: {
      organizationId: context.organization.id,
      scope: "SCHOOL",
      id: { in: requested.map((entry) => entry.roleId) },
    },
    select: { id: true },
  });
  const validRoleIds = new Set(roles.map((role) => role.id));

  // De-duplicate by school: the schema allows one role per user per school.
  const bySchool = new Map<string, string>();
  for (const entry of requested) {
    if (!visibleSchoolIds.has(entry.schoolId)) continue;
    if (!validRoleIds.has(entry.roleId)) continue;
    bySchool.set(entry.schoolId, entry.roleId);
  }

  return [...bySchool].map(([schoolId, roleId]) => ({ schoolId, roleId }));
}

/**
 * Validates an org role id belongs to this organisation and has ORG scope.
 *
 * Granting an organisation-wide role is itself an organisation-wide act: a
 * school-scoped administrator must not be able to mint a user with reach across
 * every school.
 *
 * Revoking one is the same act, which is why an actor without that authority
 * gets `current` back rather than null. Returning null would have let anyone
 * holding plain USER_UPDATE strip an organisation administrator's role just by
 * saving the edit form — the field is not rendered for them, so the browser
 * submits nothing and "nothing" would have read as "clear it".
 */
async function resolveOrgRoleId(
  context: AuthContext,
  requested: string | null,
  current: string | null = null,
): Promise<string | null> {
  if (!context.canOrg(PERMISSIONS.USER_ASSIGN_ROLE)) return current;
  if (!requested) return null;

  const role = await db.role.findFirst({
    where: {
      id: requested,
      organizationId: context.organization.id,
      scope: "ORG",
    },
    select: { id: true },
  });
  return role?.id ?? null;
}

/**
 * Confirms the actor may act on this particular user.
 *
 * Org-wide actors may act on anyone in the organisation. A school-scoped
 * administrator may only act on users who hold a membership in one of their
 * schools, and never on someone who outranks them — otherwise a director could
 * reset an organisation admin's password and take over the account.
 */
async function assertCanActOnUser(context: AuthContext, targetUserId: string) {
  if (
    context.isSuperAdmin ||
    context.canOrg(PERMISSIONS.USER_UPDATE) ||
    context.canOrg(PERMISSIONS.USER_DELETE)
  ) {
    const target = await db.user.findFirst({
      where: { id: targetUserId, organizationId: context.organization.id },
      select: { id: true, isSuperAdmin: true, orgRoleId: true },
    });
    if (!target) throw new ForbiddenError();
    return target;
  }

  const target = await db.user.findFirst({
    where: {
      id: targetUserId,
      organizationId: context.organization.id,
      memberships: {
        some: { schoolId: { in: context.schools.map((s) => s.id) } },
      },
      // Cannot touch super admins or holders of an organisation-wide role.
      isSuperAdmin: false,
      orgRoleId: null,
    },
    select: { id: true, isSuperAdmin: true, orgRoleId: true },
  });
  if (!target) throw new ForbiddenError();
  return target;
}

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeAnyScope(PERMISSIONS.USER_CREATE);

    const parsed = userSchema(t, { requirePassword: true }).safeParse(
      readUserForm(formData),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return failure(t.user.emailTaken, { email: t.user.emailTaken });
    }

    // Checked before the write so the form can name the field, rather than
    // letting the unique index refuse it as an unexplained failure.
    if (parsed.data.username) {
      const held = await db.user.findUnique({
        where: { username: parsed.data.username },
        select: { id: true },
      });
      if (held) {
        return failure(t.user.usernameTaken, {
          username: t.user.usernameTaken,
        });
      }
    }

    // Only an existing super admin may mint another one.
    const isSuperAdmin = context.isSuperAdmin
      ? parsed.data.isSuperAdmin
      : false;
    const orgRoleId = await resolveOrgRoleId(context, parsed.data.orgRoleId);
    const memberships = await resolveMemberships(
      context,
      parsed.data.memberships,
    );

    /*
      A new account starts in its own school's language and colour, falling back
      to the organisation's language and the stock accent. Read for the school
      the user is actually being put into — not the one selected in the header —
      because an org administrator creating a director for another school should
      hand them that school's defaults, not their own.

      Only a starting point: the moment the user opens /appearance, their choice
      is theirs. See SchoolSettings.defaultLocale and defaultAccent.
    */
    const homeSchoolId = memberships[0]?.schoolId ?? null;
    const homeSettings = homeSchoolId
      ? await loadSchoolSettings(homeSchoolId)
      : null;

    await db.user.create({
      data: {
        organizationId: context.organization.id,
        email: parsed.data.email,
        username: parsed.data.username,
        passwordHash: await hashPassword(parsed.data.password as string),
        isActive: parsed.data.isActive,
        isSuperAdmin,
        orgRoleId,
        currentSchoolId: homeSchoolId,
        profile: {
          create: {
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            phone: parsed.data.phone,
            jobTitle: parsed.data.jobTitle,
            birthDate: parsed.data.birthDate,
            avatarUrl: parsed.data.avatarUrl,
            locale:
              homeSettings?.defaultLocale ?? context.organization.defaultLocale,
            ...(homeSettings ? { accent: homeSettings.defaultAccent } : {}),
          },
        },
        memberships: { create: memberships },
      },
    });

    refresh();
    return success(t.user.created);
  });
}

export async function updateUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeAnyScope(PERMISSIONS.USER_UPDATE);
    const userId = field(formData, "id");

    // Re-derives authority over this specific user from the session.
    const target = await assertCanActOnUser(context, userId);

    const parsed = userSchema(t, { requirePassword: false }).safeParse(
      readUserForm(formData),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const duplicate = await db.user.findFirst({
      where: { email: parsed.data.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.user.emailTaken, { email: t.user.emailTaken });
    }

    // Same reason as on create: the form should name the field rather than
    // report an unexplained constraint failure.
    if (parsed.data.username) {
      const heldByAnother = await db.user.findFirst({
        where: { username: parsed.data.username, NOT: { id: userId } },
        select: { id: true },
      });
      if (heldByAnother) {
        return failure(t.user.usernameTaken, {
          username: t.user.usernameTaken,
        });
      }
    }

    // Guard against locking yourself out of the organisation.
    const editingSelf = userId === context.user.id;
    if (editingSelf && target.isSuperAdmin && !parsed.data.isSuperAdmin) {
      return failure(t.user.cannotDemoteSelf);
    }
    if (editingSelf && !parsed.data.isActive) {
      return failure(t.user.cannotDemoteSelf);
    }

    const isSuperAdmin = context.isSuperAdmin
      ? parsed.data.isSuperAdmin
      : target.isSuperAdmin;

    const orgRoleId = await resolveOrgRoleId(
      context,
      parsed.data.orgRoleId,
      target.orgRoleId,
    );
    const memberships = await resolveMemberships(
      context,
      parsed.data.memberships,
    );
    // A reset is only a reset if it evicts whoever already had the old one —
    // see the note on `credentialsChangedAt`. Left untouched when the form
    // sends a blank password, which means "keep the existing one".
    const passwordHash = parsed.data.password
      ? await hashPassword(parsed.data.password)
      : undefined;
    const credentialsChangedAt = passwordHash ? new Date() : undefined;

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: parsed.data.email,
          username: parsed.data.username,
          isActive: parsed.data.isActive,
          isSuperAdmin,
          orgRoleId,
          ...(passwordHash ? { passwordHash, credentialsChangedAt } : {}),
          profile: {
            upsert: {
              create: {
                firstName: parsed.data.firstName,
                lastName: parsed.data.lastName,
                phone: parsed.data.phone,
                jobTitle: parsed.data.jobTitle,
                birthDate: parsed.data.birthDate,
                avatarUrl: parsed.data.avatarUrl,
              },
              update: {
                firstName: parsed.data.firstName,
                lastName: parsed.data.lastName,
                phone: parsed.data.phone,
                jobTitle: parsed.data.jobTitle,
                birthDate: parsed.data.birthDate,
                avatarUrl: parsed.data.avatarUrl,
              },
            },
          },
        },
      });

      // Replace only the memberships for schools the actor can see, so an admin
      // scoped to two schools cannot wipe assignments in a third.
      const editableSchoolIds = context.schools.map((school) => school.id);
      await tx.membership.deleteMany({
        where: { userId, schoolId: { in: editableSchoolIds } },
      });
      if (memberships.length > 0) {
        await tx.membership.createMany({
          data: memberships.map((entry) => ({ ...entry, userId })),
        });
      }
    });

    refresh();
    return success(t.user.updated);
  });
}

export async function deleteUserAction(userId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeAnyScope(PERMISSIONS.USER_DELETE);

    if (userId === context.user.id) {
      return failure(t.user.cannotDeleteSelf);
    }

    await assertCanActOnUser(context, userId);

    const deleted = await db.user.deleteMany({
      where: { id: userId, organizationId: context.organization.id },
    });
    if (deleted.count === 0) return failure(t.errors.notFound);

    refresh();
    return success(t.user.deleted);
  });
}

/** Toggles a user's active flag from the table without opening the dialog. */
export async function toggleUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeAnyScope(PERMISSIONS.USER_UPDATE);

    if (userId === context.user.id && !isActive) {
      return failure(t.user.cannotDemoteSelf);
    }

    await assertCanActOnUser(context, userId);

    const updated = await db.user.updateMany({
      where: { id: userId, organizationId: context.organization.id },
      data: { isActive },
    });
    if (updated.count === 0) return failure(t.errors.notFound);

    refresh();
    return success(t.user.updated);
  });
}
