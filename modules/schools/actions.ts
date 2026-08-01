"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeOrg, authorizeSchool } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { schoolSchema } from "@/modules/schools/validation";

function readSchoolForm(formData: FormData) {
  return {
    code: field(formData, "code").toUpperCase(),
    name: field(formData, "name"),
    level: field(formData, "level"),
    directorName: field(formData, "directorName"),
    capacity: field(formData, "capacity"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    website: field(formData, "website"),
    logoUrl: field(formData, "logoUrl"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    region: field(formData, "region"),
    postalCode: field(formData, "postalCode"),
    country: field(formData, "country").toUpperCase(),
    isActive: boolField(formData, "isActive"),
  };
}

export async function createSchoolAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    // Creating a school is organisation-wide: a school-scoped role never grants it.
    const context = await authorizeOrg(PERMISSIONS.SCHOOL_CREATE);

    const parsed = schoolSchema(t).safeParse(readSchoolForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const duplicate = await db.school.findUnique({
      where: {
        organizationId_code: {
          organizationId: context.organization.id,
          code: parsed.data.code,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.school.codeTaken, { code: t.school.codeTaken });
    }

    await db.school.create({
      data: { ...parsed.data, organizationId: context.organization.id },
    });

    refresh();
    return success(t.school.created);
  });
}

export async function updateSchoolAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const schoolId = field(formData, "id");

    // Scoped check: a director may edit their own school, not every school.
    const context = await authorizeSchool(schoolId, PERMISSIONS.SCHOOL_UPDATE);

    const parsed = schoolSchema(t).safeParse(readSchoolForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const duplicate = await db.school.findFirst({
      where: {
        organizationId: context.organization.id,
        code: parsed.data.code,
        NOT: { id: schoolId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.school.codeTaken, { code: t.school.codeTaken });
    }

    // Scope the write by organisation as well, so a crafted id cannot reach
    // another tenant's row even if the checks above were ever relaxed.
    const updated = await db.school.updateMany({
      where: { id: schoolId, organizationId: context.organization.id },
      data: parsed.data,
    });
    if (updated.count === 0) return failure(t.errors.notFound);

    refresh();
    return success(t.school.updated);
  });
}

export async function deleteSchoolAction(
  schoolId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await authorizeOrg(PERMISSIONS.SCHOOL_DELETE);

    const deleted = await db.school.deleteMany({
      where: { id: schoolId, organizationId: context.organization.id },
    });
    if (deleted.count === 0) return failure(t.errors.notFound);

    // Anyone whose working context pointed at this school falls back to another
    // one on their next request (School.currentSchoolId is onDelete: SetNull).
    refresh();
    return success(t.school.deleted);
  });
}

// Jumping into a school's context is `switchSchoolAction` in the context
// module, which owns the working context. The schools table calls that directly
// rather than this module keeping a second copy of the same rules.
