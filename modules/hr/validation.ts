import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  birthDateField,
  dateField,
  enumField,
  optionalDate,
  optionalEmail,
  optionalPositiveInt,
  optionalText,
  requiredText,
  type V,
} from "@/lib/validation";
import {
  ATTENDANCE_STATUSES,
  CONTRACT_KINDS,
  CONTRACT_STATUSES,
  JOB_ROLES,
  LEAVE_KINDS,
  LEAVE_STATUSES,
  SALARY_STATUSES,
  STAFF_STATUSES,
} from "@/modules/hr/enums";
// Genders are the same two values for everybody on the premises; the students
// module owns the list, and duplicating it here would be a second source of
// truth for one array.
import { GENDERS } from "@/modules/students/enums";

/** Built per-request from the dictionary so messages come back localised. */

/**
 * An amount typed in dirhams and stored in centimes — the one conversion on the
 * way in, mirroring the fee schemas in the billing module.
 */
function moneyField(v: V, { max = 1_000_000 } = {}) {
  return z.coerce
    .number({ error: v.invalidNumber })
    .min(0, { error: v.invalidNumber })
    .max(max, { error: v.invalidNumber });
}

/**
 * The employment record's own columns, as both forms post them.
 *
 * Extracted from `staffSchema` so `hireSchema` can build on it rather than
 * restate it: the fiche and the hire page ask for the same identity, and two
 * lists of the same twenty fields is how one of them comes to accept a
 * hundred-character CIN the other refuses.
 */
function staffFields(t: Dictionary) {
  const v = t.validation;
  return {
    // Blank means "generate one" — see `allocateStaffCode` in service.ts.
    code: optionalText(30),
    firstName: requiredText(v, { max: 80 }),
    lastName: requiredText(v, { max: 80 }),
    firstNameAr: optionalText(80),
    lastNameAr: optionalText(80),
    gender: z
      .union([z.literal(""), z.enum(GENDERS, { error: v.invalidChoice })])
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    birthDate: birthDateField(v),
    birthPlace: optionalText(120),
    nationalId: optionalText(30),
    cnssNumber: optionalText(30),
    bankRib: optionalText(40),
    phone: optionalText(40),
    email: optionalEmail(v),
    address: optionalText(240),
    jobRole: enumField(JOB_ROLES, v),
    jobTitle: optionalText(120),
    status: enumField(STAFF_STATUSES, v),
    hiredOn: optionalDate(v),
    leftOn: optionalDate(v),
    /** Blank, or the account this employee signs in with. */
    userId: optionalText(40),
    /*
      ── Giving a new employee a login ────────────────────────────────────────
      Ticked, the two fields below are read and an account is created and
      linked. They are separate from `userId`, which attaches an account that
      already exists: hiring somebody and finding their existing login are two
      different acts, and one form field cannot mean both.

      The username may be left blank, in which case it is built from the name —
      see `allocateUsername`. The role may be left blank too, in which case the
      job answers for it — see `defaultRoleNameFor`.

      There is no password field, deliberately. One is generated and shown once,
      exactly as a parent's is: a director typing a password for every hire
      types the same one for every hire, and the account it opens is worse than
      the one the app would have opened for them.
    */
    createAccount: z.boolean(),
    accountUsername: optionalText(30),
    accountRoleId: optionalText(40),
    notes: optionalText(1000),
  };
}

export function staffSchema(t: Dictionary) {
  return z.object(staffFields(t));
}

/**
 * Hiring somebody, in one submit.
 *
 * ── Why this is not `staffSchema` with a few more boxes ─────────────────────
 * `staffSchema` describes one row. This describes an *act*: an employment
 * record, the account they sign in with, the contract they are engaged on, what
 * a teacher may be given and which bus a driver takes. Four modules' tables,
 * and each of the last three is opt-in — a caretaker gets none of them.
 *
 * The opt-ins are what the refinements below are about. A section that is
 * switched off must not validate its own empty boxes (a blank start date is not
 * an invalid one when no contract is being signed), and a section that is
 * switched on must not be allowed through half-filled — which is precisely the
 * hole a plain `optionalDate` would leave, since the action would then write a
 * contract starting at the epoch.
 *
 * `maxWeeklyMinutes` and `jobFunctionId` are on the staff/account rows rather
 * than in a section of their own: both are answered by hiring somebody, and
 * neither has anything to switch off.
 */
export function hireSchema(t: Dictionary) {
  const v = t.validation;

  return z
    .object({
      ...staffFields(t),

      /** A term of the engagement — see the note on `Staff.maxWeeklyMinutes`. */
      maxWeeklyMinutes: optionalPositiveInt(v),
      /** La fonction on the login's profile — a row of the school's own list. */
      jobFunctionId: optionalText(40),

      // ── Le contrat ─────────────────────────────────────────────────────────
      withContract: z.boolean(),
      contractKind: enumField(CONTRACT_KINDS, v),
      contractStartsOn: optionalDate(v),
      contractEndsOn: optionalDate(v),
      contractTrialEndsOn: optionalDate(v),
      contractBaseSalary: moneyField(v),
      contractWeeklyHours: optionalPositiveInt(v),

      // ── Ce qu'un enseignant peut prendre ───────────────────────────────────
      /*
        The subjects, and the one cycle they are declared for. Blank is the
        ordinary case and means the whole school — see the level-scope note on
        `TeacherSubject`. Naming individual niveaux stays on the Configuration
        screen: a school hiring somebody knows the cycle, and rarely more.
      */
      subjectIds: z.array(z.string().max(40)),
      qualificationCycleId: optionalText(40),

      // ── Le bus ─────────────────────────────────────────────────────────────
      vehicleIds: z.array(z.string().max(40)),

      // ── Ce qu'un directeur encadre ─────────────────────────────────────────
      /*
        The cycles this person is answerable for — see `StaffOversight`. Offered
        for a directeur and a surveillant général only; everybody else posts an
        empty list and nothing is written.
      */
      oversightCycleIds: z.array(z.string().max(40)),
    })
    /*
      A contract with no start date is not a contract. Checked here rather than
      in the service because it is a property of the form's own two fields, and
      reported against the box the director has to go and fill in.
    */
    .refine((data) => !data.withContract || data.contractStartsOn !== null, {
      error: v.required,
      path: ["contractStartsOn"],
    })
    .refine(
      (data) =>
        !data.withContract ||
        data.contractEndsOn === null ||
        data.contractStartsOn === null ||
        data.contractEndsOn >= data.contractStartsOn,
      { error: t.hr.endBeforeStart, path: ["contractEndsOn"] },
    )
    .transform((data) => ({
      ...data,
      contractBaseSalaryCentimes: Math.round(data.contractBaseSalary * 100),
    }));
}

/**
 * A contract.
 *
 * `endsOn` is checked against `startsOn` here rather than in the service,
 * because it is a property of the form's own two fields and nothing in the
 * database is needed to know it is wrong.
 */
export function contractSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      staffId: requiredText(v, { max: 40 }),
      kind: enumField(CONTRACT_KINDS, v),
      startsOn: dateField(v),
      endsOn: optionalDate(v),
      trialEndsOn: optionalDate(v),
      baseSalary: moneyField(v),
      weeklyHours: optionalPositiveInt(v),
      status: enumField(CONTRACT_STATUSES, v),
      notes: optionalText(1000),
    })
    .refine((data) => data.endsOn === null || data.endsOn >= data.startsOn, {
      error: t.hr.endBeforeStart,
      path: ["endsOn"],
    })
    .transform((data) => ({
      ...data,
      baseSalaryCentimes: Math.round(data.baseSalary * 100),
    }));
}

/**
 * Statuses a bulletin may be *given* on a form.
 *
 * PAID is deliberately not among them, though it is a perfectly good value of
 * the column. A payslip is paid by `payStaffSalary`, which writes the
 * décaissement that makes the claim true and points the row at it. Accepting
 * the value here let a crafted POST — Server Functions are reachable directly,
 * and the screen's own `<Select>` hides it — stamp a bulletin PAID with no
 * money having left and no operation to cancel, which nothing in the app could
 * then undo.
 */
const SALARY_FORM_STATUSES = SALARY_STATUSES.filter(
  (status) => status !== "PAID",
) as unknown as readonly [string, ...string[]];

/**
 * A bulletin de paie.
 *
 * The net is deliberately absent: it is computed by `netSalary` from the parts,
 * so a caller cannot post a payslip whose total disagrees with its own lines.
 */
export function salarySchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      staffId: requiredText(v, { max: 40 }),
      periodYear: z.coerce
        .number({ error: v.invalidNumber })
        .int({ error: v.invalidNumber })
        .min(2000, { error: v.invalidNumber })
        .max(2100, { error: v.invalidNumber }),
      periodMonth: z.coerce
        .number({ error: v.invalidNumber })
        .int({ error: v.invalidNumber })
        .min(1, { error: v.invalidNumber })
        .max(12, { error: v.invalidNumber }),
      base: moneyField(v),
      allowance: moneyField(v),
      overtime: moneyField(v),
      bonus: moneyField(v),
      absence: moneyField(v),
      advance: moneyField(v),
      social: moneyField(v),
      tax: moneyField(v),
      otherDeduction: moneyField(v),
      deductionLabel: optionalText(120),
      status: enumField(SALARY_FORM_STATUSES, v),
      notes: optionalText(1000),
    })
    .transform((data) => ({
      ...data,
      baseCentimes: Math.round(data.base * 100),
      allowanceCentimes: Math.round(data.allowance * 100),
      overtimeCentimes: Math.round(data.overtime * 100),
      bonusCentimes: Math.round(data.bonus * 100),
      absenceCentimes: Math.round(data.absence * 100),
      advanceCentimes: Math.round(data.advance * 100),
      socialCentimes: Math.round(data.social * 100),
      taxCentimes: Math.round(data.tax * 100),
      otherDeductionCentimes: Math.round(data.otherDeduction * 100),
    }));
}

/** One mark on the register. */
export function attendanceSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    staffId: requiredText(v, { max: 40 }),
    date: dateField(v),
    status: enumField(ATTENDANCE_STATUSES, v),
    isJustified: z.boolean(),
    minutesLate: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(600, { error: v.invalidNumber }),
    notes: optionalText(400),
  });
}

export function leaveSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      staffId: requiredText(v, { max: 40 }),
      kind: enumField(LEAVE_KINDS, v),
      startsOn: dateField(v),
      endsOn: dateField(v),
      dayCount: z.coerce
        .number({ error: v.invalidNumber })
        .int({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(400, { error: v.invalidNumber }),
      reason: optionalText(400),
      // No `decisionNote`: granting or refusing is `decideLeaveAction`'s act,
      // under a different permission, and the note belongs to the decision.
      status: enumField(LEAVE_STATUSES, v),
    })
    .refine((data) => data.endsOn >= data.startsOn, {
      error: t.hr.endBeforeStart,
      path: ["endsOn"],
    });
}

/**
 * How and when money left, shared by the two things RH pays out.
 *
 * The till is deliberately not among the fields. It used to be posted by the
 * form and is now resolved server-side from the caller's own open session, so a
 * payout cannot be dropped into a colleague's drawer — see `paySalaryAction`.
 */
function payoutFields(t: Dictionary) {
  const v = t.validation;
  return {
    method: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"], {
      error: v.invalidChoice,
    }),
    categoryId: optionalText(40),
    reference: optionalText(60),
    chequeNumber: optionalText(40),
    bankName: optionalText(80),
    paidOn: dateField(v),
  };
}

/**
 * Paying a bulletin. Separate from `salarySchema` because it is a different act
 * with a different permission: what is owed was agreed when the payslip was
 * approved, and this only says how and when the money left.
 */
export function salaryPayoutSchema(t: Dictionary) {
  return z.object({
    salaryId: requiredText(t.validation, { max: 40 }),
    ...payoutFields(t),
  });
}

/**
 * Handing an avance over — the same act, against a different document.
 *
 * Its own schema rather than the payslip's with the id renamed, which is what
 * it used to be: a validation failure came back keyed `salaryId`, no field on
 * the advance form was called that, and the message was therefore rendered
 * against nothing at all.
 */
export function advancePayoutSchema(t: Dictionary) {
  return z.object({
    advanceId: requiredText(t.validation, { max: 40 }),
    ...payoutFields(t),
  });
}

/**
 * An avance sur salaire, as the form posts it.
 *
 * `status` is deliberately absent: it moves through `decideAdvance` and
 * `payAdvance` under their own permissions, and accepting it here would let
 * whoever may raise a request approve their own with a crafted POST.
 */
export function advanceSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      staffId: requiredText(v, { max: 40 }),
      amount: moneyField(v),
      instalmentCount: z.coerce
        .number({ error: v.invalidNumber })
        .int({ error: v.invalidNumber })
        .min(1, { error: v.invalidNumber })
        .max(24, { error: v.invalidNumber }),
      reason: optionalText(300),
      notes: optionalText(500),
    })
    .transform((data) => ({
      ...data,
      amountCentimes: Math.round(data.amount * 100),
    }))
    // Nought is not an advance, and the deduction maths would divide by it.
    .refine((data) => data.amountCentimes > 0, {
      error: v.invalidNumber,
      path: ["amount"],
    });
}

/** The decision on a request. */
export function advanceDecisionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    id: requiredText(v, { max: 40 }),
    approve: z.boolean(),
    decisionNote: optionalText(500),
  });
}
