import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import { currentSchoolId, currentSchoolYearId, yearScope } from "@/lib/scope";
import {
  monthKeyOf,
  monthKeyString,
  monthsOfYear,
  type MonthKey,
} from "@/modules/enrolment/enums";

/**
 * Reads for the enrolment module.
 *
 * Everything is confined to `context.currentSchoolYear` and, through it, to
 * `context.currentSchool`: an enrolment is a fact about one year, and reading
 * one outside the selected year would show a pupil in a class they left.
 */

/** `YYYY-MM` for a start-month picker; "" for "from the start of the year". */
function toMonthInputValue(date: Date | null): string {
  return date ? monthKeyString(monthKeyOf(date)) : "";
}

export type EnrolmentDetail = {
  id: string;
  studentId: string;
  schoolYearId: string;
  schoolYearName: string;
  levelOfferingId: string;
  levelName: string;
  levelCode: string;
  trackName: string | null;
  schoolClassId: string | null;
  className: string | null;
  classGroupId: string | null;
  groupName: string | null;
  status: string;
  /** `YYYY-MM-DD` for `<input type="date">`. */
  enrolledOn: string;
  leftOn: string;
  isRepeating: boolean;
  usesTransport: boolean;
  usesCanteen: boolean;
  /** `YYYY-MM` for the start-month picker; "" means from the start of the year. */
  transportStartsOn: string;
  canteenStartsOn: string;
  notes: string | null;
  feeLineCount: number;
};

/** One cell of the fee grid: a single instalment of one charge. */
export type FeeCell = {
  id: string;
  periodIndex: number;
  /** ISO — formatted per-locale on the client. */
  dueDate: string;
  baseAmountCentimes: number;
  discountBps: number;
  discountCentimes: number;
  discountId: string | null;
  amountCentimes: number;
  status: string;
  /** Why it stopped being owed. Null while the line is DUE. */
  cancelReason: string | null;
  notes: string | null;
};

export type FeeGridRow = {
  feeTypeId: string;
  code: string;
  name: string;
  kind: string;
  billingCycle: string;
  /** Keyed by `monthKeyString`. Usually one cell; more when a charge is split
   *  into more instalments than the year has months. */
  cells: Record<string, FeeCell[]>;
  baseTotalCentimes: number;
  totalCentimes: number;
};

export type FeeGrid = {
  months: (MonthKey & { key: string })[];
  rows: FeeGridRow[];
  /** Keyed by `monthKeyString`. */
  monthTotals: Record<string, number>;
  baseGrandTotalCentimes: number;
  grandTotalCentimes: number;
  discountTotalCentimes: number;
};

/** The inscription a pupil holds for the year in context, if any. */
export async function findEnrolment(
  context: AuthContext,
  studentId: string,
): Promise<EnrolmentDetail | null> {
  const enrolment = await db.enrollment.findFirst({
    where: {
      studentId,
      ...yearScope(context),
      // The pupil must belong to the school in context — an id from another
      // tenant simply matches nothing.
      student: { schoolId: currentSchoolId(context) },
    },
    include: {
      schoolYear: { select: { name: true } },
      levelOffering: {
        select: {
          level: { select: { code: true, name: true } },
          track: { select: { name: true } },
        },
      },
      schoolClass: { select: { id: true, code: true } },
      classGroup: { select: { id: true, code: true, name: true } },
      _count: { select: { fees: true } },
    },
  });

  if (!enrolment) return null;

  return {
    id: enrolment.id,
    studentId: enrolment.studentId,
    schoolYearId: enrolment.schoolYearId,
    schoolYearName: enrolment.schoolYear.name,
    levelOfferingId: enrolment.levelOfferingId,
    levelCode: enrolment.levelOffering.level.code,
    levelName: enrolment.levelOffering.level.name,
    trackName: enrolment.levelOffering.track?.name ?? null,
    schoolClassId: enrolment.schoolClass?.id ?? null,
    className: enrolment.schoolClass?.code ?? null,
    classGroupId: enrolment.classGroup?.id ?? null,
    groupName: enrolment.classGroup
      ? (enrolment.classGroup.name ?? enrolment.classGroup.code)
      : null,
    status: enrolment.status,
    enrolledOn: toDateInputValue(enrolment.enrolledOn),
    leftOn: toDateInputValue(enrolment.leftOn),
    isRepeating: enrolment.isRepeating,
    usesTransport: enrolment.usesTransport,
    usesCanteen: enrolment.usesCanteen,
    transportStartsOn: toMonthInputValue(enrolment.transportStartsOn),
    canteenStartsOn: toMonthInputValue(enrolment.canteenStartsOn),
    notes: enrolment.notes,
    feeLineCount: enrolment._count.fees,
  };
}

/**
 * The échéancier as a grid: one row per charge, one column per month of the
 * year, the net amount in the cell.
 *
 * Shaped here rather than in the component because the totals — per row, per
 * month, and the two grand totals — have to agree with the cells they sum, and
 * a screen that re-adds them client-side is a screen that will one day disagree
 * with the invoice.
 */
export async function loadFeeGrid(
  context: AuthContext,
  enrollmentId: string,
): Promise<FeeGrid | null> {
  const enrolment = await db.enrollment.findFirst({
    where: {
      id: enrollmentId,
      ...yearScope(context),
      student: { schoolId: currentSchoolId(context) },
    },
    select: {
      schoolYear: { select: { startDate: true, endDate: true } },
      fees: {
        orderBy: [{ dueYear: "asc" }, { dueMonth: "asc" }, { periodIndex: "asc" }],
        include: {
          feeType: {
            select: {
              id: true,
              code: true,
              name: true,
              kind: true,
              billingCycle: true,
              position: true,
            },
          },
        },
      },
    },
  });

  if (!enrolment) return null;

  const months = monthsOfYear(
    enrolment.schoolYear.startDate,
    enrolment.schoolYear.endDate,
  ).map((month) => ({ ...month, key: monthKeyString(month) }));

  const rowsById = new Map<string, FeeGridRow>();
  const monthTotals: Record<string, number> = {};
  let baseGrandTotal = 0;
  let grandTotal = 0;

  for (const line of enrolment.fees) {
    const row = rowsById.get(line.feeTypeId) ?? {
      feeTypeId: line.feeTypeId,
      code: line.feeType.code,
      name: line.feeType.name,
      kind: line.feeType.kind,
      billingCycle: line.feeType.billingCycle,
      cells: {},
      baseTotalCentimes: 0,
      totalCentimes: 0,
    };

    const key = monthKeyString({ year: line.dueYear, month: line.dueMonth });
    (row.cells[key] ??= []).push({
      id: line.id,
      periodIndex: line.periodIndex,
      dueDate: line.dueDate.toISOString(),
      baseAmountCentimes: line.baseAmountCentimes,
      discountBps: line.discountBps,
      discountCentimes: line.discountCentimes,
      discountId: line.discountId,
      amountCentimes: line.amountCentimes,
      status: line.status,
      cancelReason: line.cancelReason,
      notes: line.notes,
    });

    // Cancelled and waived lines still show in their cell — the school wants to
    // see what it gave away — but they are not owed, so they count toward
    // neither the totals nor the month.
    const payable = line.status === "DUE";
    row.baseTotalCentimes += payable ? line.baseAmountCentimes : 0;
    row.totalCentimes += payable ? line.amountCentimes : 0;
    if (payable) {
      monthTotals[key] = (monthTotals[key] ?? 0) + line.amountCentimes;
      baseGrandTotal += line.baseAmountCentimes;
      grandTotal += line.amountCentimes;
    }

    rowsById.set(line.feeTypeId, row);
  }

  return {
    months,
    rows: [...rowsById.values()].sort((a, b) => a.code.localeCompare(b.code)),
    monthTotals,
    baseGrandTotalCentimes: baseGrandTotal,
    grandTotalCentimes: grandTotal,
    discountTotalCentimes: baseGrandTotal - grandTotal,
  };
}

/**
 * The choices the enrolment form needs: the levels the school opened this year,
 * their classes with how full each is, and the reductions on offer.
 *
 * One function rather than three so the form and the action agree on what may
 * be picked — a class that is not offered here cannot be submitted either, since
 * `assignClass` re-derives it from the same year.
 */
export async function loadEnrolmentChoices(context: AuthContext) {
  const yearId = currentSchoolYearId(context);

  const [offerings, discounts, year] = await Promise.all([
    db.levelOffering.findMany({
      where: { schoolYearId: yearId, isActive: true },
      orderBy: [{ level: { gradeYear: "asc" } }, { level: { code: "asc" } }],
      select: {
        id: true,
        plannedCapacity: true,
        level: { select: { code: true, name: true, gradeYear: true } },
        track: { select: { code: true, name: true } },
        classes: {
          where: { isActive: true },
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            capacity: true,
            _count: { select: { enrollments: true } },
            groups: {
              where: { isActive: true },
              orderBy: { code: "asc" },
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    }),
    db.discount.findMany({
      where: { schoolYearId: yearId, isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        percentBps: true,
        amountCentimes: true,
        feeTypeId: true,
      },
    }),
    // The year's own dates, for the months an opt-in may start in.
    db.schoolYear.findUnique({
      where: { id: yearId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  return {
    offerings: offerings.map((offering) => ({
      id: offering.id,
      label: offering.track
        ? `${offering.level.code} — ${offering.track.code}`
        : offering.level.code,
      levelName: offering.level.name,
      trackName: offering.track?.name ?? null,
      plannedCapacity: offering.plannedCapacity,
      classes: offering.classes.map((schoolClass) => ({
        id: schoolClass.id,
        code: schoolClass.code,
        name: schoolClass.name,
        capacity: schoolClass.capacity,
        enrolled: schoolClass._count.enrollments,
        groups: schoolClass.groups.map((group) => ({
          id: group.id,
          label: group.name ?? group.code,
        })),
      })),
    })),
    discounts,
    /**
     * The months an opt-in may start in — the year's own, minus the first.
     *
     * The first is left out because it *is* what "from the start of the year"
     * means, and offering it as a choice beside that wording would be the same
     * answer written two ways. Values are `YYYY-MM`; the labels are the month
     * numbers, which the panel formats per-locale.
     */
    optionStartMonths: year
      ? monthsOfYear(year.startDate, year.endDate)
          .slice(1)
          .map((month) => ({
            value: monthKeyString(month),
            year: month.year,
            month: month.month,
          }))
      : [],
  };
}

/** Live figures for the school-life dashboard, scoped to the year in context. */
export async function loadEnrolmentStats(context: AuthContext): Promise<{
  enrolled: number;
  pending: number;
  unplaced: number;
  billedCentimes: number;
  discountedCentimes: number;
}> {
  const scope = yearScope(context);

  const [enrolled, pending, unplaced, totals] = await Promise.all([
    db.enrollment.count({ where: { ...scope, status: "ACTIVE" } }),
    db.enrollment.count({ where: { ...scope, status: "PENDING" } }),
    db.enrollment.count({
      where: { ...scope, status: { in: ["ACTIVE", "PENDING"] }, schoolClassId: null },
    }),
    db.enrollmentFee.aggregate({
      where: { enrollment: scope, status: "DUE" },
      _sum: { amountCentimes: true, baseAmountCentimes: true },
    }),
  ]);

  const billed = totals._sum.amountCentimes ?? 0;
  const base = totals._sum.baseAmountCentimes ?? 0;

  return {
    enrolled,
    pending,
    unplaced,
    billedCentimes: billed,
    discountedCentimes: base - billed,
  };
}

/** How many pupils sit in each level opened this year — the dashboard's chart. */
export async function countEnrolmentsByLevel(
  context: AuthContext,
): Promise<{ label: string; levelCode: string; value: number }[]> {
  const offerings = await db.levelOffering.findMany({
    where: { ...yearScope(context), isActive: true },
    orderBy: [{ level: { gradeYear: "asc" } }],
    select: {
      level: { select: { code: true } },
      track: { select: { code: true } },
      _count: {
        select: { enrollments: { where: { status: { in: ["ACTIVE", "PENDING"] } } } },
      },
    },
  });

  return offerings.map((offering) => ({
    label: offering.track
      ? `${offering.level.code} ${offering.track.code}`
      : offering.level.code,
    // The level on its own, so a caller that does not want the filière split —
    // the dashboard chart, which would otherwise draw eighteen columns — can
    // fold the tracks back into it without re-parsing the label.
    levelCode: offering.level.code,
    value: offering._count.enrollments,
  }));
}
