"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { withCodeRetry } from "@/lib/allocation";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";
import { PERMISSIONS } from "@/lib/permissions";
import { createLoginAccount } from "@/modules/users/service";
import { centimesToDirhams } from "@/modules/treasury/enums";
import {
  availableIfShortOf,
  resolveCashSession,
} from "@/modules/treasury/service";
import {
  boolField,
  field,
  listField,
  withActionErrors,
} from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  decideAdvance,
  payAdvance,
  saveAdvance,
  allocateStaffCode,
  decideLeave,
  endContract,
  markAttendance,
  markDayInBulk,
  payStaffSalary,
  refreshStaffLeaveStatus,
  saveContract,
  saveSalary,
} from "@/modules/hr/service";
import {
  advanceDecisionSchema,
  advancePayoutSchema,
  advanceSchema,
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

/**
 * Refuses to let more cash out of a drawer than it holds.
 *
 * The rule itself lives in the caisse (`availableIfShortOf`) so a payout from the RH
 * screens cannot allow what the décaissement screen refuses; only the sentence
 * is composed here, in the reader's language.
 */
async function refuseIfShort(
  t: Dictionary,
  sessionId: string,
  amountCentimes: number,
): Promise<string | null> {
  const available = await availableIfShortOf(sessionId, amountCentimes);
  if (available === null) return null;

  return interpolate(t.treasury.insufficientCash, {
    amount: centimesToDirhams(available).toFixed(2),
  });
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
      createAccount: boolField(formData, "createAccount"),
      accountUsername: field(formData, "accountUsername"),
      accountPassword: formData.get("accountPassword") ?? "",
      accountRoleId: optionalId(formData, "accountRoleId"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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

    /*
      ── Hiring somebody and giving them a login ──────────────────────────────
      Behind USER_CREATE as well as HR_MANAGE, and deliberately: minting an
      account that can sign in is not the same authority as recording an
      employment, and a school that lets a secretary keep the payroll has not
      thereby said she may create logins. Checked here rather than only in
      whether the switch is drawn — a Server Function is reachable by direct
      POST.

      Skipped outright when the record already has an account: the switch is for
      hiring, and re-ticking it on an existing employee must not mint a second
      login for the same person.
    */
    if (parsed.data.createAccount && userId === null) {
      await authorizeSchool(schoolId, PERMISSIONS.USER_CREATE);

      if (!parsed.data.email) {
        return failure(t.hr.accountNeedsEmail, {
          email: t.hr.accountNeedsEmail,
        });
      }
      if (!parsed.data.accountPassword) {
        return failure(t.hr.accountNeedsPassword, {
          accountPassword: t.hr.accountNeedsPassword,
        });
      }

      // The role must be one of this organisation's, and school-scoped. An id
      // from the request is never trusted to say what it grants.
      const role = parsed.data.accountRoleId
        ? await db.role.findFirst({
            where: {
              id: parsed.data.accountRoleId,
              organizationId: context.user.organizationId,
              scope: "SCHOOL",
            },
            select: { id: true },
          })
        : null;

      const account = await createLoginAccount({
        organizationId: context.user.organizationId,
        schoolId,
        roleId: role?.id ?? null,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        username: parsed.data.accountUsername,
        password: parsed.data.accountPassword,
        phone: parsed.data.phone,
        jobTitle: parsed.data.jobTitle,
      });

      if (!account.ok) {
        return failure(
          account.reason === "email-taken"
            ? t.user.emailTaken
            : account.reason === "username-taken"
              ? t.user.usernameTaken
              : t.hr.accountNeedsUsername,
          account.reason === "email-taken"
            ? { email: t.user.emailTaken }
            : account.reason === "username-taken"
              ? { accountUsername: t.user.usernameTaken }
              : { accountUsername: t.hr.accountNeedsUsername },
          formValues(formData),
        );
      }

      userId = account.userId;
    }

    // Only a matricule the manager typed is checked here — blank means generate
    // (see the note in validation.ts). A generated one is retried below instead,
    // because losing the race to another manager is not the same thing as asking
    // for a staff number somebody already holds. See lib/allocation.ts.
    if (parsed.data.code) {
      const clash = await db.staff.findFirst({
        where: {
          schoolId,
          code: parsed.data.code,
          ...(id ? { NOT: { id } } : {}),
        },
        select: { id: true },
      });
      if (clash) return failure(t.hr.codeTaken);
    }

    /*
      The RIB is only written by somebody who may see it.

      `findStaff` withholds it without HR_PAYROLL and the form does not render
      it, so it would post blank — and writing that blank would let a manager
      correcting a phone number silently drop the bank details for a salary paid
      by virement. Omitted from the update rather than set: Prisma leaves an
      absent column alone, which is exactly the intent.
    */
    const canWriteBankRib = context.canInSchool(schoolId, PERMISSIONS.HR_PAYROLL);

    const data = {
      schoolId,
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
      ...(canWriteBankRib ? { bankRib: parsed.data.bankRib } : {}),
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

    // The allocation is inside the retry, not outside it: re-running the write
    // with the matricule it already lost would fail identically five times over.
    const write = (code: string) =>
      id
        ? db.staff.update({ where: { id }, data: { ...data, code } })
        : db.staff.create({ data: { ...data, code } });

    await (parsed.data.code
      ? write(parsed.data.code)
      : withCodeRetry(async () => write(await allocateStaffCode(schoolId))));

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
      select: {
        id: true,
        _count: {
          select: {
            salaries: true,
            // Advances cascade with the employee, so an advance already handed
            // over would be deleted with them — leaving a décaissement in the
            // caisse made out to nobody, and no record of what it settled.
            advances: { where: { cashOperationId: { not: null } } },
          },
        },
      },
    });
    if (!person) return failure(t.errors.notFound);

    // Somebody who has been paid is history, and their bulletins are evidence.
    // Terminating keeps the payroll readable; deleting would blank it.
    if (person._count.salaries > 0 || person._count.advances > 0) {
      return failure(t.hr.staffHasPayslips);
    }

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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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
    const { t, context, schoolId } = await schoolContext();
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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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

    if (!result.ok) {
      if (result.reason === "ALREADY_PAID") return failure(t.hr.alreadyPaid);

      /*
        A retenue larger than the employee's outstanding avances is money
        withheld against nothing. Nothing was written — see `saveSalary` — so
        the figure is simply given back with the real one beside it.
      */
      return failure(
        interpolate(t.hr.advanceOverRecovered, {
          // The school's own currency, not a hardcoded "DH" in the sentence:
          // the code is a setting, and the copy read wrong for anybody not on
          // dirhams.
          amount: `${centimesToDirhams(result.outstandingCentimes).toFixed(2)} ${context.settings.currencyCode}`,
        }),
        undefined,
        formValues(formData),
      );
    }

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
      categoryId: optionalId(formData, "categoryId"),
      reference: field(formData, "reference"),
      chequeNumber: field(formData, "chequeNumber"),
      bankName: field(formData, "bankName"),
      paidOn: field(formData, "paidOn"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const salary = await db.salaryPayment.findFirst({
      where: { id: parsed.data.salaryId, staff: { schoolId } },
      // The net is read here as well as in `payStaffSalary`: the drawer has to
      // be checked against the sum that is about to leave it, before anything
      // is written.
      select: { id: true, netCentimes: true },
    });
    if (!salary) return failure(t.errors.notFound);

    /*
      Cash leaves a drawer, and the drawer is the caller's own.

      Routed through the caisse's own gate rather than looking a session up
      here. It used to take *any* open session in the school, which put a salary
      into whichever colleague happened to be holding a till — they were the one
      short at closing, for a payment they never made — and skipped the day rule
      that `resolveCashSession` applies on the way past. The avance payout below
      has always done it this way; this is the same.
    */
    let cashSessionId: string | null = null;
    if (parsed.data.method === "CASH") {
      const resolution = await resolveCashSession(schoolId, context.user.id);
      if (resolution.state !== "OPEN") return failure(t.hr.noOpenSession);
      cashSessionId = resolution.sessionId;

      const short = await refuseIfShort(t, cashSessionId, salary.netCentimes);
      if (short) return failure(short);
    }

    const category = parsed.data.categoryId
      ? await db.operationCategory.findFirst({
          where: { id: parsed.data.categoryId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.categoryId && !category) {
      return failure(t.errors.notFound);
    }

    const result = await payStaffSalary({
      salaryId: salary.id,
      schoolId,
      createdById: context.user.id,
      method: parsed.data.method,
      cashSessionId,
      categoryId: category?.id ?? null,
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
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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
      // Moving an approved request's dates changes whether the employee is away
      // today, which is what the register and the payroll read.
      await refreshStaffLeaveStatus(person.id);
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
      select: { id: true, staffId: true },
    });
    if (!request) return failure(t.errors.notFound);

    await db.leaveRequest.delete({ where: { id: leaveId } });
    // Deleting the request that had somebody away puts them back to work.
    await refreshStaffLeaveStatus(request.staffId);

    refresh();
    return success(t.hr.leaveDeleted);
  });
}

// ── Avances sur salaire ──────────────────────────────────────────────────────

/**
 * Raises or restates a request for an avance.
 *
 * Behind HR_PAYROLL: an advance is a movement against somebody's wage, and the
 * register-marking permission has no business raising one. Whether it is
 * *granted* is a second act under the same code, and whether the money leaves
 * is the caisse's — see `payAdvanceAction`.
 */
export async function saveAdvanceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);

    const id = field(formData, "id");
    const parsed = advanceSchema(t).safeParse({
      staffId: field(formData, "staffId"),
      amount: field(formData, "amount") || "0",
      instalmentCount: field(formData, "instalmentCount") || "1",
      reason: field(formData, "reason"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The employee must be one of this school's — never trust the id alone.
    const staff = await db.staff.findFirst({
      where: { id: parsed.data.staffId, schoolId },
      select: { id: true },
    });
    if (!staff) return failure(t.errors.notFound);

    if (id) {
      const existing = await db.salaryAdvance.findFirst({
        where: { id, staff: { schoolId } },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    const result = await saveAdvance(
      {
        staffId: staff.id,
        amountCentimes: parsed.data.amountCentimes,
        instalmentCount: parsed.data.instalmentCount,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
      },
      id || null,
    );

    if (!result.ok) {
      return failure(
        result.reason === "LOCKED" ? t.hr.advanceLocked : t.errors.notFound,
      );
    }

    refresh();
    return success(id ? t.hr.advanceSaved : t.hr.advanceRequested);
  });
}

/** Agrees to a request, or refuses it with a reason. */
export async function decideAdvanceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);

    const parsed = advanceDecisionSchema(t).safeParse({
      id: field(formData, "id"),
      approve: field(formData, "approve") === "1",
      decisionNote: field(formData, "decisionNote"),
    });
    if (!parsed.success) return failure(t.errors.invalid);

    const advance = await db.salaryAdvance.findFirst({
      where: { id: parsed.data.id, staff: { schoolId } },
      select: { id: true },
    });
    if (!advance) return failure(t.errors.notFound);

    const result = await decideAdvance(
      advance.id,
      parsed.data.approve,
      context.user.id,
      parsed.data.decisionNote,
    );
    if (!result.ok) {
      return failure(
        result.reason === "ALREADY_DECIDED"
          ? t.hr.advanceAlreadyDecided
          : t.errors.notFound,
      );
    }

    refresh();
    return success(
      parsed.data.approve ? t.hr.advanceApproved : t.hr.advanceRefused,
    );
  });
}

/**
 * Hands the money over.
 *
 * Two permissions, exactly as paying a bulletin needs two: HR_PAYROLL says this
 * person may work the payroll, TREASURY_DISBURSE says money may leave the till
 * on their say-so. Keeping them apart is the whole of a small school's internal
 * control.
 */
export async function payAdvanceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.HR_PAYROLL);
    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_DISBURSE);

    const parsed = advancePayoutSchema(t).safeParse({
      advanceId: field(formData, "advanceId"),
      method: field(formData, "method"),
      categoryId: optionalId(formData, "categoryId"),
      reference: field(formData, "reference"),
      chequeNumber: field(formData, "chequeNumber"),
      bankName: field(formData, "bankName"),
      paidOn: field(formData, "paidOn"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const advance = await db.salaryAdvance.findFirst({
      where: { id: parsed.data.advanceId, staff: { schoolId } },
      select: { id: true, amountCentimes: true },
    });
    if (!advance) return failure(t.errors.notFound);

    /*
      Cash leaves a drawer, and the drawer is the caller's own.

      Routed through the caisse's own gate rather than looking a session up
      here, so the one-till-per-cashier rule and the day rule hold for a salary
      advance exactly as they do for any other payment out.
    */
    let cashSessionId: string | null = null;
    if (parsed.data.method === "CASH") {
      const resolution = await resolveCashSession(schoolId, context.user.id);
      if (resolution.state !== "OPEN") return failure(t.hr.noOpenSession);
      cashSessionId = resolution.sessionId;

      const short = await refuseIfShort(
        t,
        cashSessionId,
        advance.amountCentimes,
      );
      if (short) return failure(short);
    }

    const category = parsed.data.categoryId
      ? await db.operationCategory.findFirst({
          where: { id: parsed.data.categoryId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.categoryId && !category) return failure(t.errors.notFound);

    const result = await payAdvance({
      advanceId: advance.id,
      schoolId,
      createdById: context.user.id,
      method: parsed.data.method,
      cashSessionId,
      categoryId: category?.id ?? null,
      reference: parsed.data.reference,
      chequeNumber: parsed.data.chequeNumber,
      bankName: parsed.data.bankName,
      paidOn: parsed.data.paidOn,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "ALREADY_PAID":
          return failure(t.hr.advanceAlreadyPaid);
        case "NOT_APPROVED":
          return failure(t.hr.advanceNotApproved);
        default:
          return failure(t.errors.notFound);
      }
    }

    refresh();
    return success(t.hr.advancePaid);
  });
}
