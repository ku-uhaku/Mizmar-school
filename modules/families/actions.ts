"use server";

import { refresh } from "next/cache";

import {
  failure,
  success,
  successWith,
  type ActionState,
  type ActionStateWith,
} from "@/lib/action-state";
import { withCodeRetry } from "@/lib/allocation";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { generatePassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  allocateFamilyCode,
  clearOtherPrimaryContacts,
  ensurePrimaryContact,
  findPortalHolder,
  makePrimaryContact,
  relationshipTaken,
} from "@/modules/families/service";
import { familySchema, guardianSchema } from "@/modules/families/validation";
import { suggestUsername } from "@/modules/users/enums";
import {
  allocateAccountEmail,
  allocateUsername,
  createLoginAccount,
} from "@/modules/users/service";

/**
 * Actions for the families module.
 *
 * Two rules hold throughout, and they are what keeps a dossier from another
 * school being reachable by POST:
 *
 *   * the school is taken from the working context, never from the form;
 *   * a guardian is authorized through its family, resolved from the database.
 */

function readFamilyForm(formData: FormData) {
  return {
    code: field(formData, "code"),
    name: field(formData, "name"),
    nameAr: field(formData, "nameAr"),
    situation: field(formData, "situation"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    postalCode: field(formData, "postalCode"),
    country: field(formData, "country"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    notes: field(formData, "notes"),
    isActive: boolField(formData, "isActive"),
  };
}

function readGuardianForm(formData: FormData) {
  return {
    relationship: field(formData, "relationship"),
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    nameAr: field(formData, "nameAr"),
    nationalId: field(formData, "nationalId"),
    phone: field(formData, "phone"),
    phoneAlt: field(formData, "phoneAlt"),
    email: field(formData, "email"),
    profession: field(formData, "profession"),
    employer: field(formData, "employer"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    isPrimaryContact: boolField(formData, "isPrimaryContact"),
    isEmergencyContact: boolField(formData, "isEmergencyContact"),
    canPickUp: boolField(formData, "canPickUp"),
    notes: field(formData, "notes"),
    isActive: boolField(formData, "isActive"),
  };
}

/**
 * Resolves a family from its id and authorizes against the school that owns it.
 * The id is only ever used to *find* the row — what the caller may do with it is
 * decided by the school it turns out to belong to.
 */
async function authorizeFamily(
  familyId: string,
  permission:
    | typeof PERMISSIONS.FAMILY_VIEW
    | typeof PERMISSIONS.FAMILY_UPDATE
    | typeof PERMISSIONS.FAMILY_DELETE
    | typeof PERMISSIONS.FAMILY_PORTAL,
) {
  const family = await db.family.findUnique({
    where: { id: familyId },
    // The code comes back so an edit can keep it — see `updateFamilyAction`.
    select: { id: true, schoolId: true, code: true },
  });
  if (!family) return null;

  await authorizeSchool(family.schoolId, permission);
  return family;
}

export async function createFamilyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.FAMILY_CREATE);

    const parsed = familySchema(t).safeParse(readFamilyForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // A code the secretary typed is checked and refused; a generated one is
    // retried instead, because losing the race to another guichet is not the
    // same thing as asking for a code somebody already holds. See
    // lib/allocation.ts.
    if (parsed.data.code) {
      const duplicate = await db.family.findUnique({
        where: { schoolId_code: { schoolId, code: parsed.data.code } },
        select: { id: true },
      });
      if (duplicate) {
        return failure(t.family.codeTaken, { code: t.family.codeTaken });
      }
    }

    const create = (code: string) =>
      db.family.create({ data: { ...parsed.data, code, schoolId } });

    // The allocation is inside the retry: re-running the insert with the code
    // it already lost would fail identically five times over.
    await (parsed.data.code
      ? create(parsed.data.code)
      : withCodeRetry(async () => create(await allocateFamilyCode(schoolId))));

    refresh();
    return success(t.family.created);
  });
}

export async function updateFamilyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const familyId = field(formData, "id");

    const existing = await authorizeFamily(familyId, PERMISSIONS.FAMILY_UPDATE);
    if (!existing) return failure(t.errors.notFound);

    const parsed = familySchema(t).safeParse(readFamilyForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    /*
      Blank means "leave it as it is", not "give me a new one".

      Allocation belongs to opening a file — see `allocateFamilyCode`, whose own
      note says as much. On an edit it renumbered the dossier: a secretary who
      cleared the field, or any request that simply did not carry it, walked
      away with a family filed under a different number from the one on every
      piece of paper they had already been given.
    */
    const code = parsed.data.code ?? existing.code;

    const duplicate = await db.family.findFirst({
      where: { schoolId: existing.schoolId, code, NOT: { id: familyId } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.family.codeTaken, { code: t.family.codeTaken });
    }

    await db.family.update({
      where: { id: familyId },
      data: { ...parsed.data, code },
    });

    refresh();
    return success(t.family.updated);
  });
}

export async function deleteFamilyAction(
  familyId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeFamily(familyId, PERMISSIONS.FAMILY_DELETE);
    if (!existing) return failure(t.errors.notFound);

    // Children survive their dossier (Student.familyId is SetNull), but
    // deleting a file that still has pupils on it is almost always a mistake —
    // detach them deliberately first.
    const childCount = await db.student.count({ where: { familyId } });
    if (childCount > 0) return failure(t.family.hasChildren);

    await db.family.delete({ where: { id: familyId } });

    refresh();
    return success(t.family.deleted);
  });
}

export async function saveGuardianAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const familyId = field(formData, "familyId");
    const guardianId = field(formData, "id");

    const family = await authorizeFamily(familyId, PERMISSIONS.FAMILY_UPDATE);
    if (!family) return failure(t.errors.notFound);

    const parsed = guardianSchema(t).safeParse(readGuardianForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // At most one father and one mother — see SINGULAR_RELATIONSHIPS.
    if (
      await relationshipTaken(
        familyId,
        parsed.data.relationship,
        guardianId || undefined,
      )
    ) {
      return failure(t.family.relationshipTaken, {
        relationship: t.family.relationshipTaken,
      });
    }

    /*
      The guardian is resolved before anything is demoted.

      Promoting a first contact clears whoever held it, and that used to run
      ahead of the write — so a `guardianId` belonging to another dossier
      demoted this family's first contact and *then* reported not-found. The
      repair, `ensurePrimaryContact`, sits after the early return and never ran,
      which left the dossier in exactly the state it exists to prevent: a file
      with nobody to ring.
    */
    if (guardianId) {
      const target = await db.guardian.findFirst({
        where: { id: guardianId, familyId },
        select: { id: true },
      });
      if (!target) return failure(t.errors.notFound);
    }

    if (parsed.data.isPrimaryContact) {
      await clearOtherPrimaryContacts(familyId, guardianId || undefined);
    }

    if (guardianId) {
      // Scoped by familyId as well as id, so a guardian id from another dossier
      // simply matches nothing instead of being edited.
      const updated = await db.guardian.updateMany({
        where: { id: guardianId, familyId },
        data: parsed.data,
      });
      if (updated.count === 0) return failure(t.errors.notFound);
    } else {
      await db.guardian.create({ data: { ...parsed.data, familyId } });
    }

    await ensurePrimaryContact(familyId);

    refresh();
    return success(
      guardianId ? t.family.guardianUpdated : t.family.guardianAdded,
    );
  });
}

export async function deleteGuardianAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await db.guardian.findUnique({
      where: { id: guardianId },
      select: {
        id: true,
        familyId: true,
        family: { select: { schoolId: true } },
      },
    });
    if (!guardian) return failure(t.errors.notFound);

    await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_UPDATE);

    await db.guardian.delete({ where: { id: guardianId } });
    // The dossier must not be left without somebody to ring.
    await ensurePrimaryContact(guardian.familyId);

    refresh();
    return success(t.family.guardianDeleted);
  });
}

/**
 * The parent portal: opening an account, reissuing its password, withdrawing it.
 *
 * These three do *not* go through `guardianSchema`, and must not: `Guardian.userId`
 * is deliberately not a dossier field, so the guardian form strips it. Access is
 * granted here or nowhere.
 *
 * All three resolve the guardian first and authorize against the school that
 * turns out to own the dossier — an id from the request never decides what may
 * be done with it.
 */
async function authorizeGuardianPortal(guardianId: string) {
  const guardian = await db.guardian.findUnique({
    where: { id: guardianId },
    select: {
      id: true,
      familyId: true,
      firstName: true,
      lastName: true,
      phone: true,
      userId: true,
      family: { select: { schoolId: true, code: true } },
    },
  });
  if (!guardian) return null;

  await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_PORTAL);
  return guardian;
}

export async function openPortalAccountAction(
  guardianId: string,
): Promise<ActionStateWith<{ username: string; password: string }>> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const guardian = await authorizeGuardianPortal(guardianId);
    if (!guardian) return failure(t.errors.notFound);

    /*
      One access per family. Deliberately looks across the whole dossier rather
      than at this guardian alone, so re-opening an account that already exists
      and opening a second one for the other parent give the same answer — and
      the message can always name whoever holds it.
    */
    const holder = await findPortalHolder(guardian.familyId);
    if (holder) {
      return failure(
        interpolate(t.family.portalAlreadyOpen, {
          name: `${holder.firstName} ${holder.lastName}`.trim(),
        }),
      );
    }

    /*
      The dossier number is the fallback, not the surname: `suggestUsername`
      returns "" for a name written in Arabic script, and a family recorded that
      way must still be reachable. A code like `f-2025-0142` satisfies
      USERNAME_PATTERN as it stands — see modules/users/enums.ts.
    */
    const base =
      suggestUsername(guardian.firstName, guardian.lastName) ||
      guardian.family.code;
    const username = await allocateUsername("", "", base);
    if (!username) return failure(t.family.portalNoUsername);

    // Required and unique on the column even though the parent signs in with the
    // username — see `allocateAccountEmail`.
    const email = await allocateAccountEmail(
      `parent.${guardian.family.code.toLowerCase()}@famille.ma`,
    );
    const password = generatePassword();

    const account = await createLoginAccount({
      organizationId: context.organization.id,
      schoolId: guardian.family.schoolId,
      // No role and therefore no membership: a parent is not staff, and
      // everything they may read is scoped by the household instead.
      roleId: null,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      email,
      username,
      password,
      phone: guardian.phone,
      jobTitle: null,
    });

    if (!account.ok) {
      return failure(
        account.reason === "no-username"
          ? t.family.portalNoUsername
          : t.errors.unexpected,
      );
    }

    await db.guardian.update({
      where: { id: guardianId },
      data: { userId: account.userId },
    });

    refresh();
    return successWith(
      { username: account.username, password },
      t.family.portalOpened,
    );
  });
}

export async function resetPortalPasswordAction(
  guardianId: string,
): Promise<ActionStateWith<{ username: string; password: string }>> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await authorizeGuardianPortal(guardianId);
    if (!guardian) return failure(t.errors.notFound);
    if (!guardian.userId) return failure(t.family.portalNoAccount);

    const password = generatePassword();

    /*
      `credentialsChangedAt` is what makes this a reset rather than a gesture.
      Both mobile tokens carry the value that was current when they were issued
      and lib/dal.ts refuses anything older, so without the stamp a refresh token
      already on somebody's phone stays good for its full sixty days and the new
      password changes nothing for whoever had the old one.
    */
    const account = await db.user.update({
      where: { id: guardian.userId },
      data: {
        passwordHash: await hashPassword(password),
        credentialsChangedAt: new Date(),
        // A reset is also how a school lets a parent back in after a withdrawal.
        isActive: true,
      },
      select: { username: true },
    });

    refresh();
    return successWith(
      { username: account.username ?? "", password },
      t.family.portalPasswordReset,
    );
  });
}

export async function revokePortalAccountAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await authorizeGuardianPortal(guardianId);
    if (!guardian) return failure(t.errors.notFound);
    if (!guardian.userId) return failure(t.family.portalNoAccount);

    /*
      Deactivated and unlinked, never deleted: `ChatMessage.authorId` is
      Restrict, so a parent who has written in the parents' space cannot be
      removed — and what they wrote should outlive their access anyway. The stamp
      evicts the tokens already issued; clearing the link frees the dossier to be
      given a fresh account.
    */
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: guardian.userId as string },
        data: { isActive: false, credentialsChangedAt: new Date() },
      });
      await tx.guardian.update({
        where: { id: guardianId },
        data: { userId: null },
      });
    });

    refresh();
    return success(t.family.portalAccountRevoked);
  });
}

export async function setPrimaryContactAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await db.guardian.findUnique({
      where: { id: guardianId },
      select: {
        id: true,
        familyId: true,
        family: { select: { schoolId: true } },
      },
    });
    if (!guardian) return failure(t.errors.notFound);

    await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_UPDATE);

    await makePrimaryContact(guardian.familyId, guardianId);

    refresh();
    return success(t.family.guardianUpdated);
  });
}
