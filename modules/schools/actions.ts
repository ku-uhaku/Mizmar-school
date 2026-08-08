"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeOrg, authorizeSchool } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
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
    massarCode: field(formData, "massarCode"),
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

    // The nullable-unique index would throw; caught here so a clash names the
    // field to change rather than a stack trace. Many schools may be unmapped.
    if (parsed.data.massarCode) {
      const mapped = await db.school.findFirst({
        where: {
          organizationId: context.organization.id,
          massarCode: parsed.data.massarCode,
        },
        select: { id: true },
      });
      if (mapped) {
        return failure(t.school.massarTaken, {
          massarCode: t.school.massarTaken,
        });
      }
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

    if (parsed.data.massarCode) {
      const mapped = await db.school.findFirst({
        where: {
          organizationId: context.organization.id,
          massarCode: parsed.data.massarCode,
          NOT: { id: schoolId },
        },
        select: { id: true },
      });
      if (mapped) {
        return failure(t.school.massarTaken, {
          massarCode: t.school.massarTaken,
        });
      }
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

    /*
      ── A school with pupils on its books is not deletable ─────────────────────
      Every one of the thirty-one tables that names a school cascades from it.
      Deleting one therefore took its families, its staff, its payslips, its
      receipts, its cheques, its marks, its registers, its timetable and its
      buses with it — from a single button, with nothing asked and nothing left
      to reconstruct it from. The activity trail survives, deliberately (see the
      note on ActivityLog), but it would then be a record of rows that no longer
      exist.

      So the same rule the school year already follows, for the same reason and
      a great deal more of it: a school entered in error has no pupils and still
      deletes; one that taught anybody is deactivated, not removed. `isActive`
      is on the form for exactly that.
    */
    const pupils = await db.student.count({ where: { schoolId } });
    if (pupils > 0) {
      return failure(interpolate(t.school.hasStudents, { count: pupils }));
    }

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
