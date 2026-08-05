"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { interpolate } from "@/lib/i18n/format";
import {
  canChangeLevel,
  repriceForLevel,
  assignClass,
  generateFeeSchedule,
  repriceFeeLine,
  repriceFollowingLines,
  resolveOptionStart,
  resyncOptionalCharges,
  setEnrolmentStatus,
} from "@/modules/enrolment/service";
import { enrolmentSchema, feeLineSchema } from "@/modules/enrolment/validation";
import { refreshStudentStatus } from "@/modules/students/service";

/**
 * Actions for the enrolment module.
 *
 * The year and the school both come from the working context, never from the
 * form. Every id that does arrive in a request — the pupil, the level offering,
 * the class — is re-derived against that context before it is written, so a
 * crafted id cannot enrol a child into another school's class.
 */

const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

function readEnrolmentForm(formData: FormData) {
  return {
    studentId: field(formData, "studentId"),
    levelOfferingId: field(formData, "levelOfferingId"),
    schoolClassId: optionalId(formData, "schoolClassId"),
    classGroupId: optionalId(formData, "classGroupId"),
    status: field(formData, "status"),
    enrolledOn: field(formData, "enrolledOn"),
    isRepeating: boolField(formData, "isRepeating"),
    usesTransport: boolField(formData, "usesTransport"),
    usesCanteen: boolField(formData, "usesCanteen"),
    transportStartsOn: optionalId(formData, "transportStartsOn"),
    canteenStartsOn: optionalId(formData, "canteenStartsOn"),
    notes: field(formData, "notes"),
  };
}

/**
 * The start month of each opt-in, as columns.
 *
 * Cleared whenever its flag is off, so a family that drops the canteen cannot
 * leave a start month behind for the next person to tick the box and be
 * surprised by. The month itself is validated against the year — see
 * `resolveOptionStart`.
 */
async function optionStartColumns(
  schoolYearId: string,
  parsed: { usesTransport: boolean; usesCanteen: boolean } & Record<
    "transportStartsOn" | "canteenStartsOn",
    string | null
  >,
) {
  const [transportStartsOn, canteenStartsOn] = await Promise.all([
    parsed.usesTransport
      ? resolveOptionStart(schoolYearId, parsed.transportStartsOn)
      : null,
    parsed.usesCanteen
      ? resolveOptionStart(schoolYearId, parsed.canteenStartsOn)
      : null,
  ]);

  return { transportStartsOn, canteenStartsOn };
}

/**
 * Resolves an enrolment and authorizes against the school its pupil belongs to.
 * The row is what decides the school — never the request.
 */
async function authorizeEnrolment(
  enrollmentId: string,
  permission:
    | typeof PERMISSIONS.ENROLMENT_UPDATE
    | typeof PERMISSIONS.ENROLMENT_DELETE
    | typeof PERMISSIONS.ENROLMENT_FEES,
) {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      studentId: true,
      schoolYearId: true,
      /** Read so an update can tell whether the level is actually changing. */
      levelOfferingId: true,
      student: { select: { schoolId: true } },
    },
  });
  if (!enrolment) return null;

  await authorizeSchool(enrolment.student.schoolId, permission);
  return enrolment;
}

/**
 * Enrols a pupil for the year in context, and writes the whole year's fee
 * schedule in the same breath.
 *
 * The two are one action on purpose: an enrolment with no échéancier is a place
 * given away for free, and leaving the bursar to remember a second button is
 * how that happens.
 */
export async function enrolStudentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.ENROLMENT_CREATE);

    const parsed = enrolmentSchema(t).safeParse(readEnrolmentForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The pupil must be one of this school's.
    const student = await db.student.findFirst({
      where: { id: parsed.data.studentId, schoolId },
      select: { id: true },
    });
    if (!student) return failure(t.errors.notFound);

    // The level must be one this school opened this year.
    const offering = await db.levelOffering.findFirst({
      where: { id: parsed.data.levelOfferingId, schoolYearId },
      select: { id: true },
    });
    if (!offering) return failure(t.enrolment.offeringUnavailable);

    const existing = await db.enrollment.findUnique({
      where: {
        studentId_schoolYearId: { studentId: student.id, schoolYearId },
      },
      select: { id: true },
    });
    if (existing) return failure(t.enrolment.alreadyEnrolled);

    const enrolment = await db.enrollment.create({
      data: {
        studentId: student.id,
        schoolYearId,
        levelOfferingId: offering.id,
        status: parsed.data.status,
        enrolledOn: parsed.data.enrolledOn
          ? new Date(parsed.data.enrolledOn)
          : new Date(),
        isRepeating: parsed.data.isRepeating,
        usesTransport: parsed.data.usesTransport,
        usesCanteen: parsed.data.usesCanteen,
        ...(await optionStartColumns(schoolYearId, parsed.data)),
        notes: parsed.data.notes,
      },
      select: { id: true },
    });

    // Seating is optional at this point — a place can be granted in June and
    // the class decided in September.
    if (parsed.data.schoolClassId) {
      await assignClass(
        enrolment.id,
        parsed.data.schoolClassId,
        parsed.data.classGroupId || null,
      );
    }

    const lineCount = await generateFeeSchedule(enrolment.id);
    await refreshStudentStatus(student.id);

    refresh();
    return success(
      lineCount > 0 ? t.enrolment.enrolledWithFees : t.enrolment.enrolled,
    );
  });
}

export async function updateEnrolmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const enrollmentId = field(formData, "id");

    const existing = await authorizeEnrolment(
      enrollmentId,
      PERMISSIONS.ENROLMENT_UPDATE,
    );
    if (!existing) return failure(t.errors.notFound);

    const parsed = enrolmentSchema(t).safeParse(readEnrolmentForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const offering = await db.levelOffering.findFirst({
      where: {
        id: parsed.data.levelOfferingId,
        schoolYearId: existing.schoolYearId,
      },
      select: { id: true },
    });
    if (!offering) return failure(t.enrolment.offeringUnavailable);

    /*
      The level prices the whole échéancier, so it cannot be edited like a note.

      Unchanged, nothing happens. Changed with nothing collected, the schedule is
      re-priced against the new level in the same save — leaving it would bill a
      2BAC pupil at 1AP rates, silently, which is exactly what used to happen.
      Changed once a receipt has settled anything, it is refused: an allocation
      points at a particular line, and moving the child would either orphan money
      the school has taken or restate what a family was told after they paid part
      of it. That is a re-inscription, not a form edit. See `canChangeLevel`.
    */
    const levelChanged = offering.id !== existing.levelOfferingId;
    if (levelChanged) {
      const guard = await canChangeLevel(enrollmentId);
      if (!guard.ok) {
        return failure(
          interpolate(t.enrolment.levelLockedByPayment, {
            amount: (guard.paidCentimes / 100).toFixed(2),
            count: guard.receipts,
          }),
          { levelOfferingId: t.enrolment.levelLocked },
          formValues(formData),
        );
      }
    }

    await db.enrollment.update({
      where: { id: enrollmentId },
      data: {
        levelOfferingId: offering.id,
        enrolledOn: parsed.data.enrolledOn
          ? new Date(parsed.data.enrolledOn)
          : undefined,
        isRepeating: parsed.data.isRepeating,
        usesTransport: parsed.data.usesTransport,
        usesCanteen: parsed.data.usesCanteen,
        ...(await optionStartColumns(existing.schoolYearId, parsed.data)),
        notes: parsed.data.notes,
      },
    });

    await assignClass(
      enrollmentId,
      parsed.data.schoolClassId || null,
      parsed.data.classGroupId || null,
    );

    // Status and the pupil's own status move together — see setEnrolmentStatus.
    await setEnrolmentStatus(enrollmentId, parsed.data.status, new Date());

    // The switches above and their start months decide what the bus and the
    // canteen cost, so the échéancier has to follow them in the same save —
    // leaving it to a second button is how a family ends up billed for a
    // service they cancelled in front of the secretary.
    // A new level means new prices, and the guard above has already proved
    // nothing is allocated — so the schedule is rebuilt rather than patched.
    if (levelChanged) {
      const lines = await repriceForLevel(enrollmentId);
      refresh();
      return success(
        interpolate(t.enrolment.levelChangedRepriced, { count: lines }),
      );
    }

    const { added, removed } = await resyncOptionalCharges(enrollmentId);

    refresh();
    return success(
      added > 0 || removed > 0
        ? interpolate(t.enrolment.updatedWithFees, { added, removed })
        : t.enrolment.updated,
    );
  });
}

/** Seats a pupil in a class, or takes them out of one. Used by the roster screen. */
export async function assignClassAction(
  enrollmentId: string,
  schoolClassId: string | null,
  classGroupId: string | null = null,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeEnrolment(
      enrollmentId,
      PERMISSIONS.ENROLMENT_UPDATE,
    );
    if (!existing) return failure(t.errors.notFound);

    const assigned = await assignClass(
      enrollmentId,
      schoolClassId,
      classGroupId,
    );
    if (!assigned) return failure(t.enrolment.classUnavailable);

    refresh();
    return success(
      schoolClassId ? t.enrolment.classAssigned : t.enrolment.classCleared,
    );
  });
}

export async function deleteEnrolmentAction(
  enrollmentId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeEnrolment(
      enrollmentId,
      PERMISSIONS.ENROLMENT_DELETE,
    );
    if (!existing) return failure(t.errors.notFound);

    // Cascades to the whole year's fee schedule — right for an inscription
    // entered in error, and the reason withdrawing is a status change instead.
    await db.enrollment.delete({ where: { id: enrollmentId } });
    await refreshStudentStatus(existing.studentId);

    refresh();
    return success(t.enrolment.deleted);
  });
}

/**
 * Rebuilds the échéancier from the price list.
 *
 * `replace` is what the bursar asks for after correcting a rate, and it does
 * discard amounts renegotiated at the desk — which is why it is a separate,
 * confirmed action rather than something enrolling quietly re-does.
 */
export async function regenerateFeesAction(
  enrollmentId: string,
  replace: boolean,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeEnrolment(
      enrollmentId,
      PERMISSIONS.ENROLMENT_FEES,
    );
    if (!existing) return failure(t.errors.notFound);

    const count = await generateFeeSchedule(enrollmentId, { replace });

    refresh();
    return success(
      count > 0 ? t.enrolment.feesGenerated : t.enrolment.feesUnchanged,
    );
  });
}

/** Edits one cell of the fee grid: its amount, its reduction, its status. */
export async function updateFeeLineAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const feeLineId = field(formData, "id");

    const line = await db.enrollmentFee.findUnique({
      where: { id: feeLineId },
      select: {
        id: true,
        enrollmentId: true,
        enrollment: {
          select: {
            schoolYearId: true,
            student: { select: { schoolId: true } },
          },
        },
      },
    });
    if (!line) return failure(t.errors.notFound);

    const context = await authorizeSchool(
      line.enrollment.student.schoolId,
      PERMISSIONS.ENROLMENT_FEES,
    );

    const parsed = feeLineSchema(t).safeParse({
      baseAmount: field(formData, "baseAmount"),
      discountPercent: field(formData, "discountPercent"),
      discountAmount: field(formData, "discountAmount"),
      discountId: optionalId(formData, "discountId"),
      status: field(formData, "status"),
      cancelReason: field(formData, "cancelReason"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // A reduction must be one this year actually offers.
    const discount = parsed.data.discountId
      ? await db.discount.findFirst({
          where: {
            id: parsed.data.discountId,
            schoolYearId: line.enrollment.schoolYearId,
          },
          select: { id: true },
        })
      : null;

    const repriced = await repriceFeeLine(feeLineId, {
      baseAmountCentimes: parsed.data.baseAmountCentimes,
      discountBps: parsed.data.discountBps,
      discountCentimes: parsed.data.discountCentimes,
      discountId: discount?.id ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes,
      cancelReason: parsed.data.cancelReason,
      actorId: context.user.id,
    });

    // Money already taken pins the charge — the receipt has to be cancelled
    // first, which is the only act that puts money back. See `repriceFeeLine`.
    if (!repriced.ok) {
      return failure(
        interpolate(t.enrolment.feeLinePaid, {
          amount: (repriced.paidCentimes / 100).toFixed(2),
        }),
        undefined,
        formValues(formData),
      );
    }

    // A reduction is rarely for one month — see `repriceFollowingLines`. Only
    // the reduction travels; each later month keeps its own base amount.
    const carried = boolField(formData, "applyToFollowing")
      ? await repriceFollowingLines(feeLineId, {
          discountBps: parsed.data.discountBps,
          discountCentimes: parsed.data.discountCentimes,
          discountId: discount?.id ?? null,
        })
      : 0;

    refresh();
    return success(
      carried > 0
        ? interpolate(t.enrolment.feeUpdatedCarried, { count: carried })
        : t.enrolment.feeUpdated,
    );
  });
}
