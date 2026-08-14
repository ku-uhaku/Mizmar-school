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
  dirhamsToCentimes,
  sumCentimes,
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

/**
 * A cheque tender has to carry the cheque's number.
 *
 * The same rule on four forms — a receipt's tenders, the décaissement, the quick
 * spend — so the test is written once. A school cannot follow up a cheque it
 * holds only the amount of, and demanding a number for a cash payment would be
 * nonsense, which is why it is conditional rather than a required field.
 */
function hasChequeNumber(data: {
  method: string;
  chequeNumber?: string | null;
}): boolean {
  return data.method !== "CHEQUE" || Boolean(data.chequeNumber);
}

/** What was handed over, and what it was put against — see `paymentSchema`. */
function tenderTotalOf(data: {
  tenders: readonly { amountCentimes: number }[];
}): number {
  return sumCentimes(data.tenders.map((tender) => tender.amountCentimes));
}

function allocationTotalOf(data: {
  allocations: readonly { amountCentimes: number }[];
}): number {
  return sumCentimes(data.allocations.map((line) => line.amountCentimes));
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
      openingFloatCentimes: dirhamsToCentimes(data.openingFloat),
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
      countedCentimes: dirhamsToCentimes(data.counted),
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
      amountCentimes: dirhamsToCentimes(data.amount),
      reference: data.reference,
      bankId: data.bankId,
      bankName: data.bankName,
      chequeNumber: data.chequeNumber,
      chequeDueOn: data.chequeDueOn,
      drawerName: data.drawerName,
    }))
    .refine(hasChequeNumber, {
      error: t.treasury.chequeNumberRequired,
      path: ["chequeNumber"],
    });
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
        amountCentimes: dirhamsToCentimes(line.amount),
      })),
    }))
    // Both cross-totals from the same two sums, through the module's own
    // `sumCentimes`: adding the tenders up twice, by hand, in two adjacent
    // refinements is how the "is there any money" test and the "does it match"
    // test come to disagree about what the money was.
    .refine((data) => tenderTotalOf(data) > 0, {
      error: t.treasury.amountRequired,
      path: ["tenders"],
    })
    .refine((data) => tenderTotalOf(data) === allocationTotalOf(data), {
      error: t.treasury.tendersMustMatch,
      path: ["tenders"],
    });
}

export function disbursementSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      categoryId: optionalText(40),
      subcategoryId: optionalText(40),
      motifId: optionalText(40),
      bankId: optionalText(40),
      /**
       * The fournisseur paid, when it is a declared one. The name is required
       * regardless — a one-off goes to somebody who has no row at all.
       */
      supplierId: optionalText(40),
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
      amountCentimes: dirhamsToCentimes(data.amount),
    }))
    .refine(hasChequeNumber, {
      error: t.treasury.chequeNumberRequired,
      path: ["chequeNumber"],
    });
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
      amountCentimes: dirhamsToCentimes(data.amount),
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

/**
 * Cancelling a receipt.
 *
 * The motif is required, and required to be a sentence rather than a keystroke.
 * Cancelling puts charges back onto a family's account with no counter-document
 * to explain it, so the ten-character floor is there to stop "ok" and "erreur"
 * — the two things a hurried cashier types — from becoming the permanent record
 * of why a parent's balance changed.
 */
export function cancelPaymentSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    paymentId: requiredText(v, { max: 40 }),
    reason: requiredText(v, { min: 10, max: 300 }),
  });
}

/**
 * Cancelling a movement that is not a receipt.
 *
 * Same floor on the motif, and for a stronger reason: a reversed salary or
 * supplier payment has no receipt to carry the explanation, so the sentence
 * typed here *is* the record — it becomes the correcting entry's label in the
 * ledger.
 */
export function cancelOperationSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    operationId: requiredText(v, { max: 40 }),
    reason: requiredText(v, { min: 10, max: 300 }),
  });
}

/** A till. `code` is what the unique index per school is on. */
export function cashRegisterSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    code: requiredText(v, { max: 32 }),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    /** Empty means a shared drawer — see CashRegister.holderId. */
    holderId: optionalText(40),
    position: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(99, { error: v.invalidNumber }),
    notes: optionalText(500),
  });
}

