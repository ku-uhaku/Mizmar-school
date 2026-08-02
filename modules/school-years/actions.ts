"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
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
import {
  clearOtherDefaultYears,
  copyYearConfiguration,
  makeDefaultYear,
} from "@/modules/school-years/service";
import {
  YEAR_COPY_PARTS,
  type YearCopyPart,
} from "@/modules/school-years/enums";
import { schoolYearSchema } from "@/modules/school-years/validation";

function readYearForm(formData: FormData) {
  return {
    name: field(formData, "name"),
    startDate: field(formData, "startDate"),
    endDate: field(formData, "endDate"),
    status: field(formData, "status"),
    isDefault: boolField(formData, "isDefault"),
  };
}

export async function createSchoolYearAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    // Years belong to whichever school is in context — the client does not get
    // to name the school it writes into.
    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.SCHOOL_YEAR_CREATE);

    const parsed = schoolYearSchema(t).safeParse(readYearForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const duplicate = await db.schoolYear.findUnique({
      where: { schoolId_name: { schoolId, name: parsed.data.name } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.schoolYear.nameTaken, { name: t.schoolYear.nameTaken });
    }

    if (parsed.data.isDefault) await clearOtherDefaultYears(schoolId);

    const year = await db.schoolYear.create({
      data: { ...parsed.data, schoolId },
      select: { id: true },
    });

    /*
      Starting the year from a previous one.

      The source is re-derived against the school in context, so a year id from
      another tenant copies nothing rather than seeding one school's price list
      into another's. An unticked box, or a source that does not check out,
      simply leaves the new year empty — which is what it would have been.
    */
    const parts = listField(formData, "copyParts").filter(
      (part): part is YearCopyPart =>
        (YEAR_COPY_PARTS as readonly string[]).includes(part),
    );
    const copyFromId = field(formData, "copyFromYearId");

    if (copyFromId && parts.length > 0) {
      const source = await db.schoolYear.findFirst({
        where: { id: copyFromId, schoolId },
        select: { id: true },
      });
      if (source) {
        const copied = await copyYearConfiguration(source.id, year.id, parts);
        refresh();
        return success(
          interpolate(t.schoolYear.createdFromCopy, {
            classes: copied.classes,
            rates: copied.feeRates,
            weeks: copied.weeks,
          }),
        );
      }
    }

    refresh();
    return success(t.schoolYear.created);
  });
}

export async function updateSchoolYearAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const yearId = field(formData, "id");

    // Resolve the owning school from the row, then authorize against that.
    const existing = await db.schoolYear.findUnique({
      where: { id: yearId },
      select: { id: true, schoolId: true },
    });
    if (!existing) return failure(t.errors.notFound);

    await authorizeSchool(existing.schoolId, PERMISSIONS.SCHOOL_YEAR_UPDATE);

    const parsed = schoolYearSchema(t).safeParse(readYearForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const duplicate = await db.schoolYear.findFirst({
      where: {
        schoolId: existing.schoolId,
        name: parsed.data.name,
        NOT: { id: yearId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.schoolYear.nameTaken, { name: t.schoolYear.nameTaken });
    }

    if (parsed.data.isDefault) {
      await clearOtherDefaultYears(existing.schoolId, yearId);
    }

    await db.schoolYear.update({ where: { id: yearId }, data: parsed.data });

    refresh();
    return success(t.schoolYear.updated);
  });
}

export async function deleteSchoolYearAction(
  yearId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await db.schoolYear.findUnique({
      where: { id: yearId },
      select: { schoolId: true },
    });
    if (!existing) return failure(t.errors.notFound);

    await authorizeSchool(existing.schoolId, PERMISSIONS.SCHOOL_YEAR_DELETE);

    await db.schoolYear.delete({ where: { id: yearId } });

    refresh();
    return success(t.schoolYear.deleted);
  });
}

export async function setDefaultSchoolYearAction(
  yearId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await db.schoolYear.findUnique({
      where: { id: yearId },
      select: { schoolId: true },
    });
    if (!existing) return failure(t.errors.notFound);

    await authorizeSchool(existing.schoolId, PERMISSIONS.SCHOOL_YEAR_UPDATE);

    await makeDefaultYear(existing.schoolId, yearId);

    refresh();
    return success(t.schoolYear.updated);
  });
}
