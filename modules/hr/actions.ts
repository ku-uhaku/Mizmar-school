"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, listField, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import {
  allocateStaffCode,
  decideLeave,
  endContract,
  markAttendance,
  markDayInBulk,
  payStaffSalary,
  saveContract,
  saveSalary,
} from "@/modules/hr/service";
import {
  attendanceSchema,
  contractSchema,
  leaveSchema,
  salaryPayoutSchema,
  salarySchema,
  staffSchema,
} from "@/modules/hr/validation";

/**
 * Actions for the RH module.
 *
 * The school comes from the working context, never from the form, and every id
 * that arrives in a request — an employee, a contract, a bulletin — is
 * re-derived against it before anything is written. These endpoints decide what
 * people are paid, so a staff id from another school reaching one of them would
 * be the worst kind of leak this app can have.
 */

const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

async function schoolContext() {
  const t = await getDictionary();
  const context = await requireAuth();
  return { t, context, schoolId: context.currentSchool?.id };
}

/** Re-derives an employee from the session's school. Never trusts the id. */
async function reachableStaff(schoolId: string, staffId: string) {
  return db.staff.findFirst({
    where: { id: staffId, schoolId },
    select: { id: true },
  });
}

// ── The people ───────────────────────────────────────────────────────────────

export async function saveStaffAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_MANAGE);

    const parsed = staffSchema(t).safeParse({
      code: field(formData, "code"),
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      firstNameAr: field(formData, "firstNameAr"),
      lastNameAr: field(formData, "lastNameAr"),
      gender: field(formData, "gender"),
      birthDate: field(formData, "birthDate"),
      birthPlace: field(formData, "birthPlace"),
      nationalId: field(formData, "nationalId"),
      cnssNumber: field(formData, "cnssNumber"),
      bankRib: field(formData, "bankRib"),
      phone: field(formData, "phone"),
      email: field(formData, "email"),
      address: field(formData, "address"),
      jobRole: field(formData, "jobRole"),
      jobTitle: field(formData, "jobTitle"),
      status: field(formData, "status"),
      hiredOn: field(formData, "hiredOn"),
      leftOn: field(formData, "leftOn"),
      userId: optionalId(formData, "userId"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const id = field(formData, "id");
    if (id && !(await reachableStaff(schoolId, id))) {
      return failure(t.errors.notFound);
    }

    // The account must be one of this school's members, and free — otherwise a
    // crafted id would attach somebody else's login to a payroll record.
    let userId: string | null = null;
    if (parsed.data.userId) {
      const user = await db.user.findFirst({
        where: {
          id: parsed.data.userId,
          organizationId: context.user.organizationId,
          memberships: { some: { schoolId } },
        },
        select: { id: true, staffRecord: { select: { id: true } } },
      });
      if (!user) return failure(t.errors.notFound);
      if (user.staffRecord && user.staffRecord.id !== id) {
        return failure(t.hr.accountTaken);
      }
      userId = user.id;
    }

    const code = parsed.data.code || (await allocateStaffCode(schoolId));

    const clash = await db.staff.findFirst({
      where: { schoolId, code, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (clash) return failure(t.hr.codeTaken);

    const data = {
      schoolId,
      code,
      userId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      firstNameAr: parsed.data.firstNameAr,
      lastNameAr: parsed.data.lastNameAr,
      gender: parsed.data.gender,
      birthDate: parsed.data.birthDate,
      birthPlace: parsed.data.birthPlace,
      nationalId: parsed.data.nationalId,
      cnssNumber: parsed.data.cnssNumber,
      bankRib: parsed.data.bankRib,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      jobRole: parsed.data.jobRole,
      jobTitle: parsed.data.jobTitle,
      status: parsed.data.status,
      hiredOn: parsed.data.hiredOn,
      leftOn: parsed.data.leftOn,
      notes: parsed.data.notes,
    };

    if (id) {
      await db.staff.update({ where: { id }, data });
    } else {
      await db.staff.create({ data });
    }

    refresh();
    return success(id ? t.hr.staffUpdated : t.hr.staffCreated);
  });
}

export async function deleteStaffAction(staffId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_DELETE);

    const person = await db.staff.findFirst({
      where: { id: staffId, schoolId },
      select: { id: true, _count: { select: { salaries: true } } },
    });
    if (!person) return failure(t.errors.notFound);

    // Somebody who has been paid is history, and their bulletins are evidence.
    // Terminating keeps the payroll readable; deleting would blank it.
    if (person._count.salaries > 0) return failure(t.hr.staffHasPayslips);

    await db.staff.delete({ where: { id: staffId } });

    refresh();
    return success(t.hr.staffDeleted);
  });
}

// ── Contracts ────────────────────────────────────────────────────────────────

export async function saveContractAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);

    const parsed = contractSchema(t).safeParse({
      staffId: field(formData, "staffId"),
      kind: field(formData, "kind"),
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      trialEndsOn: field(formData, "trialEndsOn"),
      baseSalary: field(formData, "baseSalary"),
      weeklyHours: field(formData, "weeklyHours"),
      status: field(formData, "status"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const person = await reachableStaff(schoolId, parsed.data.staffId);
    if (!person) return failure(t.errors.notFound);

    const id = field(formData, "id");
    if (id) {
      const existing = await db.employmentContract.findFirst({
        where: { id, staff: { schoolId } },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    await saveContract(
      {
        staffId: person.id,
        kind: parsed.data.kind,
        startsOn: parsed.data.startsOn,
        endsOn: parsed.data.endsOn,
        trialEndsOn: parsed.data.trialEndsOn,
        baseSalaryCentimes: parsed.data.baseSalaryCentimes,
        weeklyHours: parsed.data.weeklyHours,
        status: parsed.data.status,
        notes: parsed.data.notes,
      },
      id || null,
    );

    refresh();
    return success(t.hr.contractSaved);
  });
}

export async function endContractAction(
  contractId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);

    const contract = await db.employmentContract.findFirst({
      where: { id: contractId, staff: { schoolId } },
      select: { id: true },
    });
    if (!contract) return failure(t.errors.notFound);

    await endContract(contract.id);

    refresh();
    return success(t.hr.contractEnded);
  });
}

// ── The register ─────────────────────────────────────────────────────────────

export async function markAttendanceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_ATTENDANCE);

    const parsed = attendanceSchema(t).safeParse({
      staffId: field(formData, "staffId"),
      date: field(formData, "date"),
      status: field(formData, "status"),
      isJustified: boolField(formData, "isJustified"),
      minutesLate: field(formData, "minutesLate") || "0",
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const person = await reachableStaff(schoolId, parsed.data.staffId);
    if (!person) return failure(t.errors.notFound);

    await markAttendance({
      staffId: person.id,
      date: parsed.data.date,
      status: parsed.data.status,
      isJustified: parsed.data.isJustified,
      minutesLate: parsed.data.minutesLate,
      notes: parsed.data.notes,
      recordedById: context.user.id,
    });

    refresh();
    return success(t.hr.attendanceSaved);
  });
}

/** The "everybody else is in" button on the register. */
export async function markDayInBulkAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_ATTENDANCE);

    const parsed = attendanceSchema(t).safeParse({
      // The bulk form marks a whole day rather than one person, so the schema's
      // staffId is satisfied with a placeholder and the real ids are re-derived
      // from the school below.
      staffId: "bulk",
      date: field(formData, "date"),
      status: field(formData, "status"),
      isJustified: false,
      minutesLate: "0",
      notes: "",
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const requested = listField(formData, "staffIds");
    const reachable = await db.staff.findMany({
      where: { id: { in: requested }, schoolId },
      select: { id: true },
    });
    if (reachable.length === 0) return failure(t.hr.nothingToMark);

    const written = await markDayInBulk({
      staffIds: reachable.map((person) => person.id),
      date: parsed.data.date,
      status: parsed.data.status,
      recordedById: context.user.id,
    });

    refresh();
    return success(
      written > 0
        ? interpolate(t.hr.bulkMarked, { count: written })
        : t.hr.nothingToMark,
    );
  });
}

// ── Payroll ──────────────────────────────────────────────────────────────────

export async function saveSalaryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);

    const parsed = salarySchema(t).safeParse({
      staffId: field(formData, "staffId"),
      periodYear: field(formData, "periodYear"),
      periodMonth: field(formData, "periodMonth"),
      base: field(formData, "base") || "0",
      allowance: field(formData, "allowance") || "0",
      overtime: field(formData, "overtime") || "0",
      bonus: field(formData, "bonus") || "0",
      absence: field(formData, "absence") || "0",
      advance: field(formData, "advance") || "0",
      social: field(formData, "social") || "0",
      tax: field(formData, "tax") || "0",
      otherDeduction: field(formData, "otherDeduction") || "0",
      deductionLabel: field(formData, "deductionLabel"),
      status: field(formData, "status") || "DRAFT",
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const person = await reachableStaff(schoolId, parsed.data.staffId);
    if (!person) return failure(t.errors.notFound);

    const result = await saveSalary({
      staffId: person.id,
      periodYear: parsed.data.periodYear,
      periodMonth: parsed.data.periodMonth,
      baseCentimes: parsed.data.baseCentimes,
      allowanceCentimes: parsed.data.allowanceCentimes,
      overtimeCentimes: parsed.data.overtimeCentimes,
      bonusCentimes: parsed.data.bonusCentimes,
      absenceCentimes: parsed.data.absenceCentimes,
      advanceCentimes: parsed.data.advanceCentimes,
      socialCentimes: parsed.data.socialCentimes,
      taxCentimes: parsed.data.taxCentimes,
      otherDeductionCentimes: parsed.data.otherDeductionCentimes,
      deductionLabel: parsed.data.deductionLabel,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });

    if (!result) return failure(t.hr.alreadyPaid);

    refresh();
    return success(t.hr.salarySaved);
  });
}

/**
 * Pays a bulletin.
 *
 * Two permissions, deliberately: preparing the payroll is one job and letting
 * money out of the till is another. See the note in permissions.ts.
 */
export async function paySalaryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);
    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_DISBURSE);

    const parsed = salaryPayoutSchema(t).safeParse({
      salaryId: field(formData, "salaryId"),
      method: field(formData, "method"),
      cashSessionId: optionalId(formData, "cashSessionId"),
      expenseCategoryId: optionalId(formData, "expenseCategoryId"),
      reference: field(formData, "reference"),
      chequeNumber: field(formData, "chequeNumber"),
      bankName: field(formData, "bankName"),
      paidOn: field(formData, "paidOn"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const salary = await db.salaryPayment.findFirst({
      where: { id: parsed.data.salaryId, staff: { schoolId } },
      select: { id: true },
    });
    if (!salary) return failure(t.errors.notFound);

    // Cash leaves a drawer, so it needs an open one; anything else never comes
    // near the desk and must not be posted into a session.
    let cashSessionId: string | null = null;
    if (parsed.data.method === "CASH") {
      const session = await db.cashSession.findFirst({
        where: {
          ...(parsed.data.cashSessionId ? { id: parsed.data.cashSessionId } : {}),
          status: "OPEN",
          cashRegister: { schoolId },
        },
        select: { id: true },
      });
      if (!session) return failure(t.hr.noOpenSession);
      cashSessionId = session.id;
    }

    const category = parsed.data.expenseCategoryId
      ? await db.expenseCategory.findFirst({
          where: { id: parsed.data.expenseCategoryId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.expenseCategoryId && !category) {
      return failure(t.errors.notFound);
    }

    const result = await payStaffSalary({
      salaryId: salary.id,
      schoolId,
      createdById: context.user.id,
      method: parsed.data.method,
      cashSessionId,
      expenseCategoryId: category?.id ?? null,
      reference: parsed.data.reference,
      chequeNumber: parsed.data.chequeNumber,
      bankName: parsed.data.bankName,
      paidOn: parsed.data.paidOn,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "ALREADY_PAID":
          return failure(t.hr.alreadyPaid);
        case "CANCELLED":
          return failure(t.hr.salaryCancelled);
        case "NOTHING_TO_PAY":
          return failure(t.hr.nothingToPay);
        case "NOT_FOUND":
          return failure(t.errors.notFound);
      }
    }

    refresh();
    return success(t.hr.salaryPaid);
  });
}

// ── Leave ────────────────────────────────────────────────────────────────────

export async function saveLeaveAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_ATTENDANCE);

    const parsed = leaveSchema(t).safeParse({
      staffId: field(formData, "staffId"),
      kind: field(formData, "kind"),
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      dayCount: field(formData, "dayCount") || "1",
      reason: field(formData, "reason"),
      status: field(formData, "status") || "PENDING",
      decisionNote: field(formData, "decisionNote"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const person = await reachableStaff(schoolId, parsed.data.staffId);
    if (!person) return failure(t.errors.notFound);

    const id = field(formData, "id");
    if (id) {
      const existing = await db.leaveRequest.findFirst({
        where: { id, staff: { schoolId } },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    const data = {
      staffId: person.id,
      kind: parsed.data.kind,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn,
      dayCount: parsed.data.dayCount,
      reason: parsed.data.reason,
      // The decision is `decideLeaveAction`'s to make — it carries a different
      // permission and moves the employee's status with it.
      status: id ? undefined : parsed.data.status,
    };

    if (id) {
      await db.leaveRequest.update({ where: { id }, data });
    } else {
      await db.leaveRequest.create({ data: { ...data, status: "PENDING" } });
    }

    refresh();
    return success(t.hr.leaveSaved);
  });
}

/** Granting or refusing leave. Manager's work, hence HR_MANAGE. */
export async function decideLeaveAction(
  leaveId: string,
  status: string,
  decisionNote: string | null = null,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_MANAGE);

    const request = await db.leaveRequest.findFirst({
      where: { id: leaveId, staff: { schoolId } },
      select: { id: true },
    });
    if (!request) return failure(t.errors.notFound);

    if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return failure(t.errors.invalid);
    }

    const result = await decideLeave({
      leaveId: request.id,
      status,
      decidedById: context.user.id,
      decisionNote,
    });
    if (!result) return failure(t.errors.notFound);

    refresh();
    return success(
      status === "APPROVED" ? t.hr.leaveApproved : t.hr.leaveDecided,
    );
  });
}

export async function deleteLeaveAction(leaveId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_MANAGE);

    const request = await db.leaveRequest.findFirst({
      where: { id: leaveId, staff: { schoolId } },
      select: { id: true },
    });
    if (!request) return failure(t.errors.notFound);

    await db.leaveRequest.delete({ where: { id: leaveId } });

    refresh();
    return success(t.hr.leaveDeleted);
  });
}
