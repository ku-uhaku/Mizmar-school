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
 * way in, mirroring `zoneSchema` in the transport module.
 */
function moneyField(v: V, { max = 1_000_000 } = {}) {
  return z.coerce
    .number({ error: v.invalidNumber })
    .min(0, { error: v.invalidNumber })
    .max(max, { error: v.invalidNumber });
}

export function staffSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    // Blank means "generate one" — see `nextStaffCode` in service.ts.
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
    notes: optionalText(1000),
  });
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
      status: enumField(SALARY_STATUSES, v),
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
      status: enumField(LEAVE_STATUSES, v),
      decisionNote: optionalText(400),
    })
    .refine((data) => data.endsOn >= data.startsOn, {
      error: t.hr.endBeforeStart,
      path: ["endsOn"],
    });
}

/**
 * Paying a bulletin. Separate from `salarySchema` because it is a different act
 * with a different permission: what is owed was agreed when the payslip was
 * approved, and this only says how and when the money left.
 */
export function salaryPayoutSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    salaryId: requiredText(v, { max: 40 }),
    method: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER"], {
      error: v.invalidChoice,
    }),
    /** Blank for anything that is not cash — the caisse only holds notes. */
    cashSessionId: optionalText(40),
    expenseCategoryId: optionalText(40),
    reference: optionalText(60),
    chequeNumber: optionalText(40),
    bankName: optionalText(80),
    paidOn: dateField(v),
  });
}
