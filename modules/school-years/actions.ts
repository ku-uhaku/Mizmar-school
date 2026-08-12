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

    /*
      ── A year with pupils on it is not deletable ──────────────────────────────
      Thirteen tables cascade from SchoolYear, and `Enrollment` is one of them —
      which drags `EnrollmentFee` behind it. So deleting a year took every
      inscription, every échéancier and the whole of that year's vie scolaire
      with it, from one button, with nothing asked.

      Where a receipt had settled a line the database refused instead, on the
      `Restrict` that protects a paid allocation — but as a raw constraint
      error, which surfaces as "something went wrong" and tells a bursar
      nothing. Where nothing had been paid it simply succeeded.

      So the year is refused while it has pupils, the way a dossier familial is
      refused while it has children. A year entered in error has none and still
      deletes; a year that ran is closed, not removed.

      ── And while it has receipts ─────────────────────────────────────────────
      `Payment.schoolYearId` is the `Restrict` the note above describes, and it
      is the only part of this the database was already refusing — as a raw
      constraint error, which is precisely the "something went wrong" a bursar
      can do nothing with. Counting the receipts here turns that into the same
      sentence the enrolments get.

      It is not covered by the count above: money is taken against a year, and a
      year can hold receipts whose inscriptions were since removed. Asking the
      database to answer first, in the language of the screen, is the whole
      point of the guard.
    */
    const [enrolled, receipts] = await Promise.all([
      db.enrollment.count({ where: { schoolYearId: yearId } }),
      db.payment.count({ where: { schoolYearId: yearId } }),
    ]);

    if (enrolled > 0) {
      return failure(
        interpolate(t.schoolYear.hasEnrolments, { count: enrolled }),
      );
    }
    if (receipts > 0) {
      return failure(
        interpolate(t.schoolYear.hasPayments, { count: receipts }),
      );
    }

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
