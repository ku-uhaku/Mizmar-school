"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import { centimesToDirhams } from "@/modules/treasury/enums";
import {
  cancelPayment,
  closeSession,
  openSession,
  recordDisbursement,
  recordPayment,
  recordTransfer,
  setChequeStatus,
} from "@/modules/treasury/service";
import {
  chequeStatusSchema,
  closeSessionSchema,
  disbursementSchema,
  openSessionSchema,
  paymentSchema,
  transferSchema,
} from "@/modules/treasury/validation";

/**
 * Actions for the treasury module.
 *
 * The school and the year both come from the working context, never from the
 * form, and every id that does arrive in a request is re-derived against that
 * context before a single centime is written. That matters more here than
 * anywhere else in the app: these are the endpoints that move money, and they
 * are reachable by direct POST regardless of what the screen renders.
 */

const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

/** The school in context, or the reason there is none. */
async function currentSchool() {
  const t = await getDictionary();
  const context = await requireAuth();
  const schoolId = context.currentSchool?.id;
  return { t, context, schoolId };
}

/**
 * The session a cash movement should be posted into.
 *
 * Only cash needs one — a virement never comes near a drawer — so this returns
 * null happily for the other methods and the caller decides whether that is a
 * problem.
 */
async function openSessionFor(schoolId: string) {
  return db.cashSession.findFirst({
    where: { status: "OPEN", cashRegister: { schoolId } },
    select: { id: true },
  });
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function openSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const parsed = openSessionSchema(t).safeParse({
      cashRegisterId: field(formData, "cashRegisterId"),
      openingFloat: field(formData, "openingFloat"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // The till must be one of this school's.
    const register = await db.cashRegister.findFirst({
      where: { id: parsed.data.cashRegisterId, schoolId, isActive: true },
      select: { id: true },
    });
    if (!register) return failure(t.errors.notFound);

    const context = await requireAuth();
    const session = await openSession({
      cashRegisterId: register.id,
      openedById: context.user.id,
      openingFloatCentimes: parsed.data.openingFloatCentimes,
      notes: parsed.data.notes,
    });
    if (!session) return failure(t.treasury.alreadyOpen);

    refresh();
    return success(t.treasury.sessionOpened);
  });
}

export async function closeSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const parsed = closeSessionSchema(t).safeParse({
      id: field(formData, "id"),
      counted: field(formData, "counted"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // The session must belong to this school — never trust the id alone.
    const session = await db.cashSession.findFirst({
      where: {
        id: parsed.data.id,
        status: "OPEN",
        cashRegister: { schoolId },
      },
      select: { id: true },
    });
    if (!session) return failure(t.errors.notFound);

    const result = await closeSession(
      session.id,
      context.user.id,
      parsed.data.countedCentimes,
      parsed.data.notes,
    );
    if (!result) return failure(t.errors.notFound);

    refresh();

    // A drawer that balances says so plainly; one that does not names the gap,
    // because a variance nobody is told about is a variance nobody investigates.
    if (result.varianceCentimes === 0) {
      return success(t.treasury.sessionClosedBalanced);
    }
    return success(
      interpolate(t.treasury.sessionClosedVariance, {
        amount: centimesToDirhams(result.varianceCentimes).toFixed(2),
      }),
    );
  });
}

// ── Encaissement ─────────────────────────────────────────────────────────────

/**
 * Reads the tender rows out of the form.
 *
 * The encaissement screen posts parallel arrays — one entry per form of money —
 * so a receipt paid part in cash and part by cheque arrives as two tenders and
 * is written as two rows. Blank amounts are dropped rather than rejected: the
 * form always renders a cheque block, and leaving it empty means "no cheque".
 */
function readTenders(formData: FormData) {
  const methods = formData.getAll("tenderMethod");

  return methods
    .map((method, index) => ({
      method: String(method),
      amount: String(formData.getAll("tenderAmount")[index] ?? ""),
      reference: String(formData.getAll("tenderReference")[index] ?? ""),
      bankName: String(formData.getAll("tenderBank")[index] ?? ""),
      chequeNumber: String(formData.getAll("tenderChequeNumber")[index] ?? ""),
      chequeDueOn: String(formData.getAll("tenderChequeDueOn")[index] ?? ""),
      drawerName: String(formData.getAll("tenderDrawer")[index] ?? ""),
    }))
    .filter((tender) => tender.amount !== "" && Number(tender.amount) > 0);
}

/** The selected schedule lines, as `feeId:amountInDirhams` pairs. */
function readAllocations(formData: FormData) {
  return formData
    .getAll("allocation")
    .map((entry) => String(entry))
    .map((entry) => {
      const separator = entry.lastIndexOf(":");
      return {
        enrollmentFeeId: entry.slice(0, separator),
        amount: entry.slice(separator + 1),
      };
    })
    .filter((line) => line.enrollmentFeeId !== "" && Number(line.amount) > 0);
}

export async function recordPaymentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_COLLECT);

    const parsed = paymentSchema(t).safeParse({
      familyId: optionalId(formData, "familyId"),
      paidAt: field(formData, "paidAt"),
      notes: field(formData, "notes"),
      tenders: readTenders(formData),
      allocations: readAllocations(formData),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // The family must be one of this school's.
    const family = parsed.data.familyId
      ? await db.family.findFirst({
          where: { id: parsed.data.familyId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.familyId && !family) return failure(t.errors.notFound);

    // Cash needs a drawer to go into; the other methods do not.
    const takesCash = parsed.data.tenders.some(
      (tender) => tender.method === "CASH",
    );
    const session = await openSessionFor(schoolId);
    if (takesCash && !session) return failure(t.treasury.noOpenSession);

    const result = await recordPayment({
      schoolId,
      schoolYearId,
      familyId: family?.id ?? null,
      createdById: context.user.id,
      cashSessionId: takesCash ? (session?.id ?? null) : null,
      paidAt: parsed.data.paidAt ?? new Date(),
      notes: parsed.data.notes,
      tenders: parsed.data.tenders.map((tender) => ({
        method: tender.method,
        amountCentimes: tender.amountCentimes,
        reference: tender.reference,
        bankName: tender.bankName,
        chequeNumber: tender.chequeNumber,
        chequeDueOn: tender.chequeDueOn,
        drawerName: tender.drawerName,
      })),
      allocations: parsed.data.allocations,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "NO_LINES":
          return failure(t.treasury.nothingSelected);
        case "TOTALS_DISAGREE":
          return failure(t.treasury.tendersMustMatch);
        case "LINE_UNREACHABLE":
          return failure(t.errors.notFound);
        case "OVER_ALLOCATED":
          // Someone else settled the same month while this receipt was open.
          return failure(t.treasury.lineAlreadySettled);
      }
    }

    refresh();
    return success(interpolate(t.treasury.paymentRecorded, { code: result.code }));
  });
}

export async function cancelPaymentAction(
  paymentId: string,
  reason: string | null,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CANCEL);

    // Scoped by school: a receipt id alone must not reach another tenant's.
    const payment = await db.payment.findFirst({
      where: { id: paymentId, schoolId },
      select: { id: true },
    });
    if (!payment) return failure(t.errors.notFound);

    const cancelled = await cancelPayment(payment.id, context.user.id, reason);
    if (!cancelled) return failure(t.treasury.alreadyCancelled);

    refresh();
    return success(t.treasury.paymentCancelled);
  });
}

// ── Décaissement ─────────────────────────────────────────────────────────────

export async function recordDisbursementAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_DISBURSE);

    const parsed = disbursementSchema(t).safeParse({
      expenseCategoryId: optionalId(formData, "expenseCategoryId"),
      beneficiaryStaffId: optionalId(formData, "beneficiaryStaffId"),
      beneficiaryName: field(formData, "beneficiaryName"),
      label: field(formData, "label"),
      method: field(formData, "method"),
      amount: field(formData, "amount"),
      reference: field(formData, "reference"),
      occurredAt: field(formData, "occurredAt"),
      chequeNumber: field(formData, "chequeNumber"),
      bankName: field(formData, "bankName"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const category = parsed.data.expenseCategoryId
      ? await db.expenseCategory.findFirst({
          where: { id: parsed.data.expenseCategoryId, schoolId },
          select: { id: true },
        })
      : null;

    // The beneficiary must be one of this school's employees — a staff id from
    // the request must never reach another school's payroll.
    const beneficiary = parsed.data.beneficiaryStaffId
      ? await db.staff.findFirst({
          where: { id: parsed.data.beneficiaryStaffId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.beneficiaryStaffId && !beneficiary) {
      return failure(t.errors.notFound);
    }

    const session = await openSessionFor(schoolId);
    if (parsed.data.method === "CASH" && !session) {
      return failure(t.treasury.noOpenSession);
    }

    // Never pay out more cash than the drawer holds — the ledger would show a
    // negative till, which is not a state a drawer can be in.
    if (parsed.data.method === "CASH" && session) {
      const drawer = await db.cashSession.findUnique({
        where: { id: session.id },
        select: {
          openingFloatCentimes: true,
          operations: {
            where: { status: "POSTED" },
            select: { cashImpactCentimes: true },
          },
        },
      });
      const available =
        (drawer?.openingFloatCentimes ?? 0) +
        (drawer?.operations ?? []).reduce(
          (total, operation) => total + operation.cashImpactCentimes,
          0,
        );
      if (parsed.data.amountCentimes > available) {
        return failure(
          interpolate(t.treasury.insufficientCash, {
            amount: centimesToDirhams(available).toFixed(2),
          }),
        );
      }
    }

    await recordDisbursement({
      schoolId,
      createdById: context.user.id,
      cashSessionId: parsed.data.method === "CASH" ? (session?.id ?? null) : null,
      expenseCategoryId: category?.id ?? null,
      beneficiaryStaffId: beneficiary?.id ?? null,
      beneficiaryName: parsed.data.beneficiaryName,
      label: parsed.data.label,
      method: parsed.data.method,
      amountCentimes: parsed.data.amountCentimes,
      reference: parsed.data.reference,
      chequeNumber: parsed.data.chequeNumber,
      bankName: parsed.data.bankName,
      occurredAt: parsed.data.occurredAt ?? new Date(),
    });

    refresh();
    return success(t.treasury.disbursementRecorded);
  });
}

// ── Transfert ────────────────────────────────────────────────────────────────

export async function recordTransferAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_TRANSFER);

    const parsed = transferSchema(t).safeParse({
      fromRegisterId: field(formData, "fromRegisterId"),
      target: field(formData, "target"),
      toRegisterId: optionalId(formData, "toRegisterId"),
      bankAccountLabel: field(formData, "bankAccountLabel"),
      amount: field(formData, "amount"),
      reference: field(formData, "reference"),
      occurredAt: field(formData, "occurredAt"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // Both tills must be this school's.
    const from = await db.cashRegister.findFirst({
      where: { id: parsed.data.fromRegisterId, schoolId },
      select: { id: true, name: true },
    });
    if (!from) return failure(t.errors.notFound);

    const to =
      parsed.data.target === "REGISTER" && parsed.data.toRegisterId
        ? await db.cashRegister.findFirst({
            where: { id: parsed.data.toRegisterId, schoolId },
            select: { id: true, name: true },
          })
        : null;
    if (parsed.data.target === "REGISTER" && !to) return failure(t.errors.notFound);

    // Money can only leave a drawer somebody is holding.
    const fromSession = await db.cashSession.findFirst({
      where: { cashRegisterId: from.id, status: "OPEN" },
      select: {
        id: true,
        openingFloatCentimes: true,
        operations: {
          where: { status: "POSTED" },
          select: { cashImpactCentimes: true },
        },
      },
    });
    if (!fromSession) return failure(t.treasury.noOpenSession);

    const available =
      fromSession.openingFloatCentimes +
      fromSession.operations.reduce(
        (total, operation) => total + operation.cashImpactCentimes,
        0,
      );
    if (parsed.data.amountCentimes > available) {
      return failure(
        interpolate(t.treasury.insufficientCash, {
          amount: centimesToDirhams(available).toFixed(2),
        }),
      );
    }

    const result = await recordTransfer({
      schoolId,
      createdById: context.user.id,
      fromSessionId: fromSession.id,
      fromRegisterId: from.id,
      toRegisterId: to?.id ?? null,
      bankAccountLabel:
        parsed.data.target === "BANK" ? parsed.data.bankAccountLabel : null,
      amountCentimes: parsed.data.amountCentimes,
      reference: parsed.data.reference,
      occurredAt: parsed.data.occurredAt ?? new Date(),
      label:
        parsed.data.target === "BANK"
          ? (parsed.data.bankAccountLabel ?? from.name)
          : `${from.name} → ${to?.name ?? ""}`,
    });

    refresh();

    // Money that left a drawer for a till nobody has opened is in transit, and
    // saying so is the difference between a known state and a missing bundle.
    if (parsed.data.target === "REGISTER" && !result.receivedIntoSession) {
      return success(t.treasury.transferPendingReceipt);
    }
    return success(t.treasury.transferRecorded);
  });
}

// ── Chèques ──────────────────────────────────────────────────────────────────

export async function setChequeStatusAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CHEQUES);

    const parsed = chequeStatusSchema(t).safeParse({
      id: field(formData, "id"),
      status: field(formData, "status"),
      settledOn: field(formData, "settledOn"),
      bounceReason: field(formData, "bounceReason"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const cheque = await db.cheque.findFirst({
      where: { id: parsed.data.id, schoolId },
      select: { id: true },
    });
    if (!cheque) return failure(t.errors.notFound);

    // Bouncing a cheque cancels the receipt it settled, which puts the money
    // back on the family's schedule — so it needs the cancelling permission too.
    if (parsed.data.status === "BOUNCED") {
      await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CANCEL);
    }

    await setChequeStatus(cheque.id, parsed.data.status, context.user.id, {
      settledOn: parsed.data.settledOn,
      bounceReason: parsed.data.bounceReason,
    });

    refresh();
    return success(t.treasury.chequeUpdated);
  });
}
