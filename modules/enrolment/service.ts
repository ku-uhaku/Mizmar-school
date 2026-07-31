import "server-only";

import { db } from "@/lib/db";
import { dueDayOf } from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { netAmount } from "@/modules/enrolment/enums";
import {
  buildScheduleLines,
  type ScheduleLine,
} from "@/modules/enrolment/schedule";
import { refreshStudentStatus } from "@/modules/students/service";

/**
 * Writes and invariants for the enrolment module.
 *
 * The centrepiece is `generateFeeSchedule`: enrolling a child writes the whole
 * year's échéancier in one go, from the price list in force that day. Everything
 * else here exists to keep that schedule and the placement honest.
 */

export type { ScheduleLine };

/**
 * Works out what a pupil owes for the year, without writing anything.
 *
 * Split out from the write so the enrolment form can show the family exactly
 * what it is signing before it signs, and so the figures on that preview are
 * produced by the code that will produce the rows. The rule itself lives in
 * `schedule.ts`, which is pure — this function only fetches what it needs.
 */
export async function buildFeeSchedule(
  enrollmentId: string,
): Promise<ScheduleLine[]> {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      usesTransport: true,
      usesCanteen: true,
      levelOffering: { select: { levelId: true } },
      schoolYear: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          schoolId: true,
          _count: { select: { terms: true } },
        },
      },
    },
  });
  if (!enrolment) return [];

  const { schoolYear } = enrolment;

  const [feeTypes, rates] = await Promise.all([
    db.feeType.findMany({
      where: { schoolId: schoolYear.schoolId, isActive: true },
      orderBy: [{ position: "asc" }, { code: "asc" }],
      select: { id: true, kind: true, billingCycle: true, isMandatory: true },
    }),
    db.feeRate.findMany({
      where: { schoolYearId: schoolYear.id, isActive: true },
      select: {
        id: true,
        feeTypeId: true,
        amountCentimes: true,
        instalmentCount: true,
        scopeKey: true,
      },
    }),
  ]);

  // The school's own billing conventions, read for the year's school rather
  // than whichever one is selected in the header.
  const settings = await loadSchoolSettings(schoolYear.schoolId);

  return buildScheduleLines({
    levelId: enrolment.levelOffering.levelId,
    usesTransport: enrolment.usesTransport,
    usesCanteen: enrolment.usesCanteen,
    yearStart: schoolYear.startDate,
    yearEnd: schoolYear.endDate,
    termCount: schoolYear._count.terms,
    feeTypes,
    rates,
    instalmentsPerYear: settings.defaultInstalmentCount,
    dueDayOfMonth: dueDayOf(settings),
  });
}

/**
 * Writes the year's échéancier for one enrolment.
 *
 * Default behaviour **adds only what is missing**: re-running after a fee type
 * is added bills the new charge without restating a line whose amount was
 * renegotiated at the desk. `replace` wipes the schedule first, which is the
 * "rebuild from the price list" the bursar asks for after correcting a rate —
 * and which does lose manual edits, deliberately and on request.
 *
 * Returns how many lines were written.
 */
export async function generateFeeSchedule(
  enrollmentId: string,
  { replace = false }: { replace?: boolean } = {},
): Promise<number> {
  const lines = await buildFeeSchedule(enrollmentId);

  return db.$transaction(async (tx) => {
    if (replace) {
      await tx.enrollmentFee.deleteMany({ where: { enrollmentId } });
    }

    if (lines.length === 0) return 0;

    // What makes this idempotent: only the lines that are not already there get
    // written, so the second run of an unchanged year writes nothing at all.
    //
    // Filtered in memory against the (enrollment, feeType, periodIndex) unique
    // rather than with `createMany({ skipDuplicates })`, which the SQLite
    // connector does not support. Both the read and the write are inside the
    // transaction, so a concurrent generation cannot slip between them — and if
    // one did, the unique index is still there to refuse it.
    const existing = await tx.enrollmentFee.findMany({
      where: { enrollmentId },
      select: { feeTypeId: true, periodIndex: true },
    });
    const taken = new Set(
      existing.map((line) => `${line.feeTypeId}:${line.periodIndex}`),
    );

    const fresh = lines.filter(
      (line) => !taken.has(`${line.feeTypeId}:${line.periodIndex}`),
    );
    if (fresh.length === 0) return 0;

    const created = await tx.enrollmentFee.createMany({
      data: fresh.map((line) => ({ ...line, enrollmentId })),
    });

    return created.count;
  });
}

/**
 * Seats a pupil in a class, or takes them out of one.
 *
 * The class is re-derived from the enrolment's own year, so a class id from
 * another year or another school matches nothing rather than moving a child
 * across the tenant boundary. The group is cleared whenever the class changes —
 * a group of a class the pupil is not in would put them in two rooms at once on
 * the timetable.
 */
export async function assignClass(
  enrollmentId: string,
  schoolClassId: string | null,
  classGroupId: string | null = null,
): Promise<boolean> {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { schoolYearId: true, schoolClassId: true },
  });
  if (!enrolment) return false;

  if (schoolClassId === null) {
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { schoolClassId: null, classGroupId: null },
    });
    return true;
  }

  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      levelOffering: { schoolYearId: enrolment.schoolYearId },
    },
    select: { id: true },
  });
  if (!schoolClass) return false;

  // A group is only kept when it belongs to the class being assigned.
  const group =
    classGroupId === null
      ? null
      : await db.classGroup.findFirst({
          where: { id: classGroupId, schoolClassId },
          select: { id: true },
        });

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { schoolClassId, classGroupId: group?.id ?? null },
  });

  return true;
}

/**
 * Recomputes a schedule line's net from its parts.
 *
 * The one place `amountCentimes` is written, so the stored total can never
 * disagree with the base and the reductions beside it.
 */
export async function repriceFeeLine(
  feeLineId: string,
  input: {
    baseAmountCentimes: number;
    discountBps: number;
    discountCentimes: number;
    discountId: string | null;
    status: string;
    notes: string | null;
  },
): Promise<void> {
  await db.enrollmentFee.update({
    where: { id: feeLineId },
    data: {
      ...input,
      amountCentimes: netAmount(
        input.baseAmountCentimes,
        input.discountBps,
        input.discountCentimes,
      ),
    },
  });
}

/**
 * Carries a reduction forward to every later instalment of the same charge.
 *
 * A reduction is almost never for one month: a sibling discount runs to the end
 * of the year, and granting it month by month is nine identical edits and an
 * eventual mistake. The bursar ticks a box and this writes the rest.
 *
 * Only the *reduction* travels — each month keeps its own base amount, since
 * instalments differ by a centime where the year does not divide evenly, and
 * copying one month's total over the others would quietly change what is owed.
 *
 * Lines already waived or cancelled are left alone: they are not owed, so
 * discounting them would be meaningless and would misreport what was given away.
 *
 * Returns how many later lines were changed.
 */
export async function repriceFollowingLines(
  feeLineId: string,
  input: {
    discountBps: number;
    discountCentimes: number;
    discountId: string | null;
  },
): Promise<number> {
  const line = await db.enrollmentFee.findUnique({
    where: { id: feeLineId },
    select: { enrollmentId: true, feeTypeId: true, periodIndex: true },
  });
  if (!line) return 0;

  const following = await db.enrollmentFee.findMany({
    where: {
      enrollmentId: line.enrollmentId,
      feeTypeId: line.feeTypeId,
      periodIndex: { gt: line.periodIndex },
      status: "DUE",
    },
    select: { id: true, baseAmountCentimes: true },
  });

  // One update per row rather than an `updateMany`: the net has to be computed
  // from each row's own base, and `updateMany` cannot write a per-row value.
  await db.$transaction(
    following.map((later) =>
      db.enrollmentFee.update({
        where: { id: later.id },
        data: {
          discountBps: input.discountBps,
          discountCentimes: input.discountCentimes,
          discountId: input.discountId,
          amountCentimes: netAmount(
            later.baseAmountCentimes,
            input.discountBps,
            input.discountCentimes,
          ),
        },
      }),
    ),
  );

  return following.length;
}

/**
 * Changes an enrolment's status and brings the pupil's own status back in line.
 *
 * The two are written together, always, because `Student.status` is derived
 * from these rows — see modules/students/service.ts.
 */
export async function setEnrolmentStatus(
  enrollmentId: string,
  status: string,
  leftOn: Date | null = null,
): Promise<void> {
  const enrolment = await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      leftOn: status === "TRANSFERRED" || status === "WITHDRAWN" ? leftOn : null,
    },
    select: { studentId: true },
  });

  await refreshStudentStatus(enrolment.studentId);
}
