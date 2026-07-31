import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  enumField,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  CHEQUE_STATUSES,
  TENDER_METHODS,
  TRANSFER_TARGETS,
} from "@/modules/treasury/enums";

/**
 * Built per-request from the dictionary so validation messages are localised.
 *
 * Amounts arrive in **dirhams**, because that is what a cashier types, and are
 * turned into centimes here — the one conversion point on the way in, matching
 * `centimesToDirhams` on the way out. Every schema in this file that touches
 * money uses `moneyField` so that conversion cannot be forgotten in one place
 * and applied in another.
 */

/** A positive sum of money, in dirhams, coerced to centimes. */
function moneyField(v: Dictionary["validation"], { min = 0 } = {}) {
  return z.coerce
    .number({ error: v.invalidNumber })
    .min(min, { error: v.invalidNumber })
    .max(100_000_000, { error: v.invalidNumber });
}

export function openSessionSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      cashRegisterId: requiredText(v, { max: 40 }),
      openingFloat: moneyField(v),
      notes: optionalText(500),
    })
    .transform((data) => ({
      cashRegisterId: data.cashRegisterId,
      openingFloatCentimes: Math.round(data.openingFloat * 100),
      notes: data.notes,
    }));
}

export function closeSessionSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      id: requiredText(v, { max: 40 }),
      counted: moneyField(v),
      notes: optionalText(500),
    })
    .transform((data) => ({
      id: data.id,
      countedCentimes: Math.round(data.counted * 100),
      notes: data.notes,
    }));
}

/**
 * One form of money on a receipt.
 *
 * The cheque details are conditional rather than always-required: a school
 * cannot follow up a cheque it has only the amount of, but demanding a number
 * for a cash tender would be nonsense. The refinement below is what ties the two
 * together.
 */
export function tenderSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      method: enumField(TENDER_METHODS, v),
      amount: moneyField(v, { min: 0 }),
      reference: optionalText(80),
      bankId: optionalText(40),
      bankName: optionalText(120),
      chequeNumber: optionalText(40),
      chequeDueOn: optionalDate(v),
      drawerName: optionalText(120),
    })
    .transform((data) => ({
      method: data.method,
      amountCentimes: Math.round(data.amount * 100),
      reference: data.reference,
      bankId: data.bankId,
      bankName: data.bankName,
      chequeNumber: data.chequeNumber,
      chequeDueOn: data.chequeDueOn,
      drawerName: data.drawerName,
    }))
    .refine(
      (data) => data.method !== "CHEQUE" || Boolean(data.chequeNumber),
      { error: t.treasury.chequeNumberRequired, path: ["chequeNumber"] },
    );
}

/**
 * A receipt: what was paid, in what forms, against which schedule lines.
 *
 * The two cross-total rules a receipt lives or dies by are checked here rather
 * than only in the service, so the cashier is told at the form instead of after
 * the submit: the tenders must add up to what was handed over, and so must the
 * allocations. A receipt whose parts disagree with its total is an argument with
 * a parent that nobody can settle.
 */
export function paymentSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      familyId: optionalText(40),
      paidAt: optionalDate(v),
      notes: optionalText(1000),
      tenders: z.array(tenderSchema(t)).min(1, { error: v.required }),
      allocations: z
        .array(
          z.object({
            enrollmentFeeId: requiredText(v, { max: 40 }),
            amount: moneyField(v),
          }),
        )
        .min(1, { error: t.treasury.nothingSelected }),
    })
    .transform((data) => ({
      ...data,
      allocations: data.allocations.map((line) => ({
        enrollmentFeeId: line.enrollmentFeeId,
        amountCentimes: Math.round(line.amount * 100),
      })),
    }))
    .refine(
      (data) =>
        data.tenders.reduce((sum, tender) => sum + tender.amountCentimes, 0) > 0,
      { error: t.treasury.amountRequired, path: ["tenders"] },
    )
    .refine(
      (data) =>
        data.tenders.reduce((sum, tender) => sum + tender.amountCentimes, 0) ===
        data.allocations.reduce((sum, line) => sum + line.amountCentimes, 0),
      { error: t.treasury.tendersMustMatch, path: ["tenders"] },
    );
}

export function disbursementSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      categoryId: optionalText(40),
      subcategoryId: optionalText(40),
      motifId: optionalText(40),
      bankId: optionalText(40),
      /** The employee paid, when there is one. The name is required regardless. */
      beneficiaryStaffId: optionalText(40),
      beneficiaryName: requiredText(v, { max: 160 }),
      label: requiredText(v, { max: 200 }),
      method: enumField(TENDER_METHODS, v),
      amount: moneyField(v, { min: 0.01 }),
      reference: optionalText(80),
      occurredAt: optionalDate(v),
      chequeNumber: optionalText(40),
      bankName: optionalText(120),
      notes: optionalText(1000),
    })
    .transform((data) => ({
      ...data,
      amountCentimes: Math.round(data.amount * 100),
    }))
    .refine(
      (data) => data.method !== "CHEQUE" || Boolean(data.chequeNumber),
      { error: t.treasury.chequeNumberRequired, path: ["chequeNumber"] },
    );
}

/**
 * A handover. The destination is one of two different things — another till or
 * the bank — so `target` says which, and the refinement makes sure the matching
 * field was actually filled in.
 */
export function transferSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      fromRegisterId: requiredText(v, { max: 40 }),
      target: enumField(TRANSFER_TARGETS, v),
      toRegisterId: optionalText(40),
      bankId: optionalText(40),
      bankAccountLabel: optionalText(160),
      amount: moneyField(v, { min: 0.01 }),
      reference: optionalText(80),
      occurredAt: optionalDate(v),
      notes: optionalText(1000),
    })
    .transform((data) => ({
      ...data,
      amountCentimes: Math.round(data.amount * 100),
    }))
    .refine(
      (data) => data.target !== "REGISTER" || Boolean(data.toRegisterId),
      { error: v.required, path: ["toRegisterId"] },
    )
    .refine(
      // Either the declared bank or a written account says where the money
      // went; requiring both would make the picker pointless.
      (data) =>
        data.target !== "BANK" ||
        Boolean(data.bankId) ||
        Boolean(data.bankAccountLabel),
      { error: v.required, path: ["bankId"] },
    )
    .refine(
      // Money that leaves a till and arrives in the same one has not moved, and
      // the pair of ledger legs it would write says otherwise.
      (data) => data.target !== "REGISTER" || data.toRegisterId !== data.fromRegisterId,
      { error: t.treasury.sameRegister, path: ["toRegisterId"] },
    );
}

export function chequeStatusSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    id: requiredText(v, { max: 40 }),
    status: enumField(CHEQUE_STATUSES, v),
    settledOn: optionalDate(v),
    bounceReason: optionalText(300),
  });
}

/** A till. `code` is what the unique index per school is on. */
export function cashRegisterSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    code: requiredText(v, { max: 32 }),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    position: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(99, { error: v.invalidNumber }),
    notes: optionalText(500),
  });
}
