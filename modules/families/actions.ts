"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import {
  allocateFamilyCode,
  clearOtherPrimaryContacts,
  ensurePrimaryContact,
  makePrimaryContact,
  relationshipTaken,
} from "@/modules/families/service";
import {
  familySchema,
  guardianSchema,
} from "@/modules/families/validation";

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
    | typeof PERMISSIONS.FAMILY_DELETE,
) {
  const family = await db.family.findUnique({
    where: { id: familyId },
    select: { id: true, schoolId: true },
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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const code = parsed.data.code ?? (await allocateFamilyCode(schoolId));

    const duplicate = await db.family.findUnique({
      where: { schoolId_code: { schoolId, code } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.family.codeTaken, { code: t.family.codeTaken });
    }

    await db.family.create({ data: { ...parsed.data, code, schoolId } });

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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const code =
      parsed.data.code ?? (await allocateFamilyCode(existing.schoolId));

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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
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
    return success(guardianId ? t.family.guardianUpdated : t.family.guardianAdded);
  });
}

export async function deleteGuardianAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await db.guardian.findUnique({
      where: { id: guardianId },
      select: { id: true, familyId: true, family: { select: { schoolId: true } } },
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

export async function setPrimaryContactAction(
  guardianId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const guardian = await db.guardian.findUnique({
      where: { id: guardianId },
      select: { id: true, familyId: true, family: { select: { schoolId: true } } },
    });
    if (!guardian) return failure(t.errors.notFound);

    await authorizeSchool(guardian.family.schoolId, PERMISSIONS.FAMILY_UPDATE);

    await makePrimaryContact(guardian.familyId, guardianId);

    refresh();
    return success(t.family.guardianUpdated);
  });
}
