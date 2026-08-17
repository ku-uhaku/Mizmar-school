"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";
import { PERMISSIONS } from "@/lib/permissions";
import { staffOfSchool } from "@/lib/scope";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  canMoveCheque,
  categoryKindsFor,
  chequeUndoesReceipt,
  methodNeedsDrawer,
  recordedAt,
  startOfDay,
} from "@/modules/treasury/enums";
import {
  availableIfShortOf,
  cancelOperation,
  cancelPayment,
  closeSession,
  openSession,
  recordDisbursement,
  recordPayment,
  recordTransfer,
  resolveCashSession,
  setChequeStatus,
  type CancelPaymentFailure,
} from "@/modules/treasury/service";
import { detachPayrollFromOperations } from "@/modules/hr/service";
import { detachFuelFromOperations } from "@/modules/transport/service";
import {
  cancelOperationSchema,
  cancelPaymentSchema,
  cashRegisterSchema,
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

/**
 * The school in context, or the reason there is none.
 *
 * The locale comes along because the sentences these actions compose quote
 * money and dates back to the cashier, and both have to be written the way the
 * rest of their screen writes them — see `formatAmount` and `formatDate`.
 */
async function currentSchool() {
  const [t, locale, context] = await Promise.all([
    getDictionary(),
    getLocale(),
    requireAuth(),
  ]);
  const schoolId = context.currentSchool?.id;
  return { t, locale, context, schoolId };
}

/**
 * The drawer a cash movement may be posted into, and the sentence to show when
 * there is not one.
 *
 * Every screen that touches cash goes through here rather than looking a
 * session up for itself, so the day rule cannot hold on the encaissement screen
 * and leak on the décaissement one. `resolveCashSession` closes yesterday's
 * shift on the way past — see the note on it — and this only turns the three
 * outcomes into either an id or a message.
 *
 * Only cash needs a drawer: a virement never comes near one, so the caller asks
 * only when it is actually taking notes.
 */
async function requireDrawer(
  t: Dictionary,
  locale: Locale,
  schoolId: string,
  userId: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
  const resolution = await resolveCashSession(schoolId, userId);

  if (resolution.state === "OPEN") {
    return { ok: true, sessionId: resolution.sessionId };
  }

  // Two different problems and two different next actions: one cashier has
  // simply not opened up yet, the other is standing at yesterday's drawer.
  if (resolution.state === "STALE_CLOSED") {
    return {
      ok: false,
      // Both through the shared formatters. The date used to be
      // `toISOString().slice(0, 10)`, which reads the *UTC* day and is one
      // behind for every hour before 01h00 in Morocco — so the one message
      // whose whole job is naming the day the shift belonged to named the
      // wrong one. The amount used to be `.toFixed(2)`, which put Latin digits
      // and no separator beside an Arabic screen's properly formatted figures.
      message: interpolate(t.treasury.sessionStaleClosed, {
        date: formatDate(resolution.openedAt, locale),
        amount: formatAmount(resolution.expectedCentimes, locale),
      }),
    };
  }

  return { ok: false, message: t.treasury.noOpenSession };
}

/**
 * The drawer a movement goes into when the operator named one.
 *
 * Wraps `requireDrawer` rather than replacing it: an unnamed till still means
 * "mine", which is the ordinary case and the one that must not need a click.
 *
 * ── Why the named one is re-derived and not trusted ─────────────────────────
 * A session id from the request is an id from the request. It is re-looked-up
 * here against this school, against `status: OPEN`, and against today — so a
 * crafted id cannot pay money out of the sister school's till, and a stale one
 * cannot post today's payout into yesterday's counted drawer. The picker on the
 * form is filtered by exactly these clauses (`listOpenDrawers`); this is the
 * guard, and the filtering is the convenience.
 */
async function requireChosenDrawer(
  t: Dictionary,
  locale: Locale,
  schoolId: string,
  userId: string,
  cashSessionId: string | null,
): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
  if (!cashSessionId) return requireDrawer(t, locale, schoolId, userId);

  const chosen = await db.cashSession.findFirst({
    where: {
      id: cashSessionId,
      status: "OPEN",
      cashRegister: { schoolId },
      openedAt: { gte: startOfDay(new Date()) },
    },
    select: { id: true },
  });

  // The same sentence as having no till at all: from the bursar's side the
  // drawer they picked is not one they may post into, and why it is not — closed
  // overnight, closed by somebody else while the form sat open — is a question
  // the tills screen answers and this message cannot.
  return chosen
    ? { ok: true, sessionId: chosen.id }
    : { ok: false, message: t.treasury.noOpenSession };
}

/**
 * Refuses to let more cash out of a drawer than it holds.
 *
 * Every screen that pays money out asks this, and asks it of the same sum the
 * caisse balances on (`availableCashInSession`), so no screen can allow what
 * another refuses. A ledger showing a till holding less than nothing is not a
 * state a drawer can be in.
 */
async function refuseIfShort(
  t: Dictionary,
  locale: Locale,
  sessionId: string,
  amountCentimes: number,
): Promise<string | null> {
  const available = await availableIfShortOf(sessionId, amountCentimes);
  if (available === null) return null;

  return interpolate(t.treasury.insufficientCash, {
    amount: formatAmount(available, locale),
  });
}

/** The sentence shown when a cancellation cannot go through. */
function cancelFailureMessage(t: Dictionary, reason: CancelPaymentFailure): string {
  switch (reason) {
    case "NOT_FOUND":
      return t.treasury.alreadyCancelled;
    case "NO_DRAWER":
      return t.treasury.cancelNeedsDrawer;
    case "INSUFFICIENT_CASH":
      return t.treasury.cancelNeedsCash;
  }
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function openSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const parsed = openSessionSchema(t).safeParse({
      cashRegisterId: field(formData, "cashRegisterId"),
      openingFloat: field(formData, "openingFloat"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The till must be one of this school's.
    const register = await db.cashRegister.findFirst({
      where: { id: parsed.data.cashRegisterId, schoolId, isActive: true },
      select: { id: true },
    });
    if (!register) return failure(t.errors.notFound);

    const opened = await openSession({
      schoolId,
      cashRegisterId: register.id,
      openedById: context.user.id,
      openingFloatCentimes: parsed.data.openingFloatCentimes,
      notes: parsed.data.notes,
    });

    if (!opened.ok) {
      // Three different refusals, three different things to do about them.
      if (opened.reason === "NOT_YOUR_TILL") {
        return failure(t.treasury.notYourTill);
      }
      if (opened.reason === "ALREADY_OPEN") return failure(t.treasury.alreadyOpen);
      return failure(t.errors.notFound);
    }

    refresh();
    return success(t.treasury.sessionOpened);
  });
}

export async function closeSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, locale, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const parsed = closeSessionSchema(t).safeParse({
      id: field(formData, "id"),
      counted: field(formData, "counted"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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
        amount: formatAmount(result.varianceCentimes, locale),
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
      bankId: String(formData.getAll("tenderBankId")[index] ?? ""),
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
    const { t, locale, context, schoolId } = await currentSchool();
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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The family must be one of this school's.
    const family = parsed.data.familyId
      ? await db.family.findFirst({
          where: { id: parsed.data.familyId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.familyId && !family) return failure(t.errors.notFound);

    // Cash needs a drawer to go into; the other seven methods do not — asked of
    // METHOD_DETAILS so this screen and the décaissement agree about which.
    const takesCash = parsed.data.tenders.some((tender) =>
      methodNeedsDrawer(tender.method),
    );
    let cashSessionId: string | null = null;
    if (takesCash) {
      const drawer = await requireDrawer(t, locale, schoolId, context.user.id);
      if (!drawer.ok) return failure(drawer.message);
      cashSessionId = drawer.sessionId;
    }

    /*
      Every bank a tender named is re-derived against this school in one query.
      The picker was filtered, but a direct POST was not — and a bank id from
      another school on an incoming cheque would file it under a row this
      school cannot see.
    */
    const namedBankIds = [
      ...new Set(
        parsed.data.tenders
          .map((tender) => tender.bankId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const reachableBanks = new Set(
      namedBankIds.length === 0
        ? []
        : (
            await db.bank.findMany({
              where: { id: { in: namedBankIds }, schoolId },
              select: { id: true },
            })
          ).map((bank) => bank.id),
    );

    const result = await recordPayment({
      schoolId,
      schoolYearId,
      familyId: family?.id ?? null,
      createdById: context.user.id,
      cashSessionId,
      paidAt: recordedAt(parsed.data.paidAt),
      notes: parsed.data.notes,
      tenders: parsed.data.tenders.map((tender) => ({
        method: tender.method,
        amountCentimes: tender.amountCentimes,
        reference: tender.reference,
        bankId:
          tender.bankId && reachableBanks.has(tender.bankId)
            ? tender.bankId
            : null,
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
    return success(
      interpolate(t.treasury.paymentRecorded, { code: result.code }),
    );
  });
}

/**
 * Cancels a receipt, on the record.
 *
 * The motif is validated here rather than trusted from the dialog: the dialog's
 * required-field check is a courtesy to the cashier, and this is the rule. What
 * lands on the row is the note plus the name of whoever wrote it, which is the
 * only account of the reversal that will exist once the day is closed.
 */
export async function cancelPaymentAction(
  paymentId: string,
  reason: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CANCEL);

    const parsed = cancelPaymentSchema(t).safeParse({ paymentId, reason });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // Scoped by school: a receipt id alone must not reach another tenant's.
    const payment = await db.payment.findFirst({
      where: { id: parsed.data.paymentId, schoolId },
      select: { id: true },
    });
    if (!payment) return failure(t.errors.notFound);

    const cancelled = await cancelPayment(
      payment.id,
      schoolId,
      context.user.id,
      parsed.data.reason,
    );
    if (!cancelled.ok) return failure(cancelFailureMessage(t, cancelled.reason));

    refresh();
    return success(t.treasury.paymentCancelled);
  });
}

/**
 * Cancels a movement that is not a receipt — a salary, a supplier, a transfer.
 *
 * Gated on `TREASURY_CANCEL`, the same code that governs undoing a receipt:
 * both put a figure back that somebody has already acted on, and both are the
 * bursar's to make rather than the desk's.
 *
 * The motif is required and is written into the correcting entry's label, which
 * is the only account of the reversal the ledger will carry — there is no paper
 * behind a cancellation.
 */
export async function cancelOperationAction(
  operationId: string,
  reason: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CANCEL);

    const parsed = cancelOperationSchema(t).safeParse({ operationId, reason });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const result = await cancelOperation(
      parsed.data.operationId,
      schoolId,
      context.user.id,
      // Composed here rather than in the service, which holds no dictionary.
      `${t.treasury.reversalOf} · ${parsed.data.reason}`,
      // Everything the movement settled goes back to unsettled: the money did
      // not leave after all, and a bulletin still marked PAID — or a tank of
      // diesel still marked approved — against a reversed entry is the ledger
      // disagreeing with the module that leans on it.
      async (tx, operationIds) => {
        await detachPayrollFromOperations(tx, operationIds);
        await detachFuelFromOperations(tx, operationIds);
      },
    );

    if (!result.ok) {
      switch (result.reason) {
        case "NOT_FOUND":
          return failure(t.errors.notFound);
        case "IS_RECEIPT":
          return failure(t.treasury.cancelReceiptInstead);
        case "ALREADY_REVERSED":
          return failure(t.treasury.alreadyReversed);
        case "NO_DRAWER":
          return failure(t.treasury.cancelNeedsDrawer);
        case "INSUFFICIENT_CASH":
          return failure(t.treasury.cancelNeedsCash);
        case "BLOCKED":
          return failure(t.treasury.reversalBlocked);
      }
    }

    refresh();
    return success(t.treasury.operationCancelled);
  });
}

// ── Décaissement ─────────────────────────────────────────────────────────────

export async function recordDisbursementAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, locale, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_DISBURSE);

    const parsed = disbursementSchema(t).safeParse({
      categoryId: optionalId(formData, "categoryId"),
      subcategoryId: optionalId(formData, "subcategoryId"),
      motifId: optionalId(formData, "motifId"),
      bankId: optionalId(formData, "bankId"),
      supplierId: optionalId(formData, "supplierId"),
      cashSessionId: optionalId(formData, "cashSessionId"),
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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    /*
      Every rubrique the form sent is re-derived against this school, and the
      sub-rubrique against the rubrique. The selects were already filtered, but a
      Server Function is reachable by direct POST — without this, a crafted
      `subcategoryId` would file a décaissement under another school's chart.
    */
    const category = parsed.data.categoryId
      ? await db.operationCategory.findFirst({
          where: {
            id: parsed.data.categoryId,
            schoolId,
            kind: { in: [...categoryKindsFor("OUT")] },
          },
          select: { id: true },
        })
      : null;
    if (parsed.data.categoryId && !category) return failure(t.errors.notFound);

    /*
      Every one of these refuses rather than resolving to null.

      Only the rubrique and the supplier used to. The other three fell through
      as null, so a stale picker or a crafted id filed the décaissement with no
      sub-rubrique, no motif and no bank — silently, with a success message, and
      no way for the bursar to know the movement had lost the chart entry they
      chose. Failing is the only answer that tells them.
    */
    // Scoped by the resolved parent, so a sub-rubrique can never be attached to
    // a rubrique it does not belong to.
    const subcategory =
      parsed.data.subcategoryId && category
        ? await db.operationSubcategory.findFirst({
            where: { id: parsed.data.subcategoryId, categoryId: category.id },
            select: { id: true },
          })
        : null;
    if (parsed.data.subcategoryId && !subcategory) {
      return failure(t.errors.notFound);
    }

    const motif = parsed.data.motifId
      ? await db.operationMotif.findFirst({
          where: { id: parsed.data.motifId, schoolId },
          select: { id: true, name: true },
        })
      : null;
    if (parsed.data.motifId && !motif) return failure(t.errors.notFound);

    const bank = parsed.data.bankId
      ? await db.bank.findFirst({
          where: { id: parsed.data.bankId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.bankId && !bank) return failure(t.errors.notFound);

    // The beneficiary must be one of this school's employees — a staff id from
    // the request must never reach another school's payroll.
    // Re-derived against this school, like every other reference the form
    // sends: a supplier id from another tenant would file the payment under a
    // row this school cannot see.
    const supplier = parsed.data.supplierId
      ? await db.supplier.findFirst({
          where: { id: parsed.data.supplierId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.supplierId && !supplier) {
      return failure(t.errors.notFound);
    }

    /*
      Only a payout in notes needs a till — a virement never comes near one, and
      neither does a card on the terminal. Asked of METHOD_DETAILS rather than
      of `=== "CASH"`, so the eight methods the caisse now offers each need a
      drawer exactly when they actually move one.
    */
    let cashSessionId: string | null = null;
    if (methodNeedsDrawer(parsed.data.method)) {
      const resolved = await requireChosenDrawer(
        t,
        locale,
        schoolId,
        context.user.id,
        parsed.data.cashSessionId,
      );
      if (!resolved.ok) return failure(resolved.message);
      cashSessionId = resolved.sessionId;
    }

    // Never pay out more cash than the drawer holds — the ledger would show a
    // negative till, which is not a state a drawer can be in.
    if (cashSessionId) {
      const short = await refuseIfShort(
        t,
        locale,
        cashSessionId,
        parsed.data.amountCentimes,
      );
      if (short) return failure(short);
    }

    await recordDisbursement({
      schoolId,
      createdById: context.user.id,
      cashSessionId,
      categoryId: category?.id ?? null,
      subcategoryId: subcategory?.id ?? null,
      motifId: motif?.id ?? null,
      bankId: bank?.id ?? null,
      // Staff are paid through the RH screens now — see the note on the form.
      beneficiaryStaffId: null,
      supplierId: supplier?.id ?? null,
      // Falls back to the libellé. The column is "always set" by design — see
      // the note on it — and the form no longer insists on a separate line for
      // it, so "Facture Lydec août" is both what the movement is and who it went
      // to rather than an empty cell in the ledger.
      beneficiaryName: parsed.data.beneficiaryName || parsed.data.label,
      label: parsed.data.label,
      method: parsed.data.method,
      amountCentimes: parsed.data.amountCentimes,
      reference: parsed.data.reference,
      chequeNumber: parsed.data.chequeNumber,
      bankName: parsed.data.bankName,
      occurredAt: recordedAt(parsed.data.occurredAt),
      notes: parsed.data.notes,
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
    const { t, locale, context, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_TRANSFER);

    const parsed = transferSchema(t).safeParse({
      fromRegisterId: field(formData, "fromRegisterId"),
      target: field(formData, "target"),
      toRegisterId: optionalId(formData, "toRegisterId"),
      bankId: optionalId(formData, "bankId"),
      bankAccountLabel: field(formData, "bankAccountLabel"),
      amount: field(formData, "amount"),
      reference: field(formData, "reference"),
      occurredAt: field(formData, "occurredAt"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
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
    if (parsed.data.target === "REGISTER" && !to)
      return failure(t.errors.notFound);

    /*
      Money leaves the caller's own drawer, and no other.

      Resolving the session from the *user* rather than from the register in the
      form is what makes that true: a transfer is a cashier handing over what
      they are holding, so a form naming somebody else's till has to fail even
      though both tills belong to this school. It also puts the day rule on this
      screen for free — `requireDrawer` closes yesterday's shift on the way past.
    */
    const drawer = await requireDrawer(t, locale, schoolId, context.user.id);
    if (!drawer.ok) return failure(drawer.message);

    const fromSession = await db.cashSession.findFirst({
      where: { id: drawer.sessionId, cashRegisterId: from.id },
      select: { id: true },
    });
    if (!fromSession) return failure(t.treasury.notYourTill);

    const short = await refuseIfShort(
      t,
      locale,
      fromSession.id,
      parsed.data.amountCentimes,
    );
    if (short) return failure(short);

    // Re-derived, like every other reference the form sends.
    const transferBank =
      parsed.data.target === "BANK" && parsed.data.bankId
        ? await db.bank.findFirst({
            where: { id: parsed.data.bankId, schoolId },
            select: { id: true, name: true },
          })
        : null;

    const result = await recordTransfer({
      schoolId,
      createdById: context.user.id,
      fromSessionId: fromSession.id,
      fromRegisterId: from.id,
      toRegisterId: to?.id ?? null,
      bankId: parsed.data.target === "BANK" ? (transferBank?.id ?? null) : null,
      bankAccountLabel:
        parsed.data.target === "BANK" ? parsed.data.bankAccountLabel : null,
      amountCentimes: parsed.data.amountCentimes,
      reference: parsed.data.reference,
      occurredAt: recordedAt(parsed.data.occurredAt),
      notes: parsed.data.notes,
      label:
        parsed.data.target === "BANK"
          ? (transferBank?.name ?? parsed.data.bankAccountLabel ?? from.name)
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
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const cheque = await db.cheque.findFirst({
      where: { id: parsed.data.id, schoolId },
      select: {
        id: true,
        status: true,
        direction: true,
        tender: { select: { payment: { select: { status: true } } } },
        /*
          The movement this cheque paid, when it is one the school wrote. Only
          a live one counts: a décaissement already reversed by hand has
          nothing left to undo, and an entry that is itself a correction is
          never the thing being corrected.
        */
        operations: {
          where: {
            status: "POSTED",
            reversesOperationId: null,
            reversedBy: { is: null },
          },
          select: { id: true },
        },
      },
    });
    if (!cheque) return failure(t.errors.notFound);

    /*
      Ending a cheque that settled a live receipt cancels that receipt, which
      puts the money back on the family's schedule — so it needs the cancelling
      permission, exactly as cancelling the receipt by hand would.

      Scoped to cheques that actually settle one rather than to the status
      alone: striking out a mistyped cheque that paid nothing reverses no
      money, and a cashier who may track cheques should not need the reversal
      permission to correct their own typing.
    */
    const undoesReceipt =
      chequeUndoesReceipt(parsed.data.status) &&
      cheque.direction === "INCOMING" &&
      cheque.tender?.payment.status === "POSTED";

    if (undoesReceipt) {
      await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CANCEL);
    }

    // Composed here because this layer has the dictionary. The cashier's own
    // words are appended when they gave any, so the cancelled receipt explains
    // itself without anyone opening the cheque.
    const written =
      parsed.data.status === "RETURNED"
        ? t.treasury.cancelledChequeReturned
        : parsed.data.status === "CANCELLED"
          ? t.treasury.cancelledChequeCancelled
          : t.treasury.cancelledChequeBounced;

    /*
      ── A cheque the school wrote, coming back unpaid ─────────────────────────
      The mirror of the incoming case, and it used to do nothing at all. Ending
      an outgoing cheque only ever stamped the row, so a salary cheque the bank
      refused left its décaissement POSTED and the bulletin still marked PAID:
      the employee read as paid with money that never left, and the only lever
      that would have put it right — cancelling the movement — was on another
      screen entirely.

      Reversing it here is the same act as cancelling the movement, through the
      same function and the same hooks, so there is exactly one way a
      décaissement is ever undone.
    */
    const undoesDisbursement =
      chequeUndoesReceipt(parsed.data.status) &&
      cheque.direction === "OUTGOING" &&
      cheque.operations.length > 0;

    if (undoesDisbursement) {
      await authorizeSchool(schoolId, PERMISSIONS.TREASURY_CANCEL);

      // `setChequeStatus` guards the move and is bypassed below, so the table
      // is consulted here instead — a crafted POST must not reverse a payment
      // by way of a transition the lifecycle forbids.
      if (!canMoveCheque(cheque.status, parsed.data.status)) {
        return failure(t.errors.invalid, {}, formValues(formData));
      }

      const result = await cancelOperation(
        cheque.operations[0].id,
        schoolId,
        context.user.id,
        parsed.data.bounceReason
          ? `${t.treasury.reversalOf} · ${written} — ${parsed.data.bounceReason}`
          : `${t.treasury.reversalOf} · ${written}`,
        async (tx, operationIds) => {
          await detachPayrollFromOperations(tx, operationIds);
          await detachFuelFromOperations(tx, operationIds);

          /*
            Stamped inside the reversal's own transaction, and deliberately
            after it: `cancelOperation` voids the paper it undoes as a blanket
            CANCELLED, which would lose the difference between a cheque the
            bank refused and one the bursar struck out. Writing the chosen
            ending last keeps that distinction without opening a window where
            the money is reversed and the cheque still reads as outstanding.
          */
          await tx.cheque.update({
            where: { id: cheque.id },
            data: {
              status: parsed.data.status,
              settledOn: parsed.data.settledOn ?? new Date(),
              bounceReason:
                parsed.data.status === "BOUNCED"
                  ? (parsed.data.bounceReason ?? null)
                  : null,
            },
          });
        },
      );

      if (!result.ok) {
        switch (result.reason) {
          case "NOT_FOUND":
            return failure(t.errors.notFound);
          case "IS_RECEIPT":
            return failure(t.treasury.cancelReceiptInstead);
          case "ALREADY_REVERSED":
            return failure(t.treasury.alreadyReversed);
          case "NO_DRAWER":
            return failure(t.treasury.cancelNeedsDrawer);
          case "INSUFFICIENT_CASH":
            return failure(t.treasury.cancelNeedsCash);
          case "BLOCKED":
            return failure(t.treasury.reversalBlocked);
        }
      }

      refresh();
      return success(t.treasury.chequeUpdated);
    }

    await setChequeStatus(cheque.id, schoolId, parsed.data.status, context.user.id, {
      settledOn: parsed.data.settledOn,
      bounceReason: parsed.data.bounceReason,
      cancelReason: parsed.data.bounceReason
        ? `${written} — ${parsed.data.bounceReason}`
        : written,
    });

    refresh();
    return success(t.treasury.chequeUpdated);
  });
}

// ── The tills themselves ─────────────────────────────────────────────────────

/**
 * Creates or renames a till.
 *
 * Behind TREASURY_SESSION rather than a code of its own: whoever may open and
 * close a drawer is whoever is answerable for how many drawers there are. A
 * cashier who may only collect does not get to invent a second till and start
 * posting into it.
 */
export async function saveCashRegisterAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const id = field(formData, "id");
    const parsed = cashRegisterSchema(t).safeParse({
      code: field(formData, "code"),
      name: field(formData, "name"),
      nameAr: field(formData, "nameAr"),
      holderId: optionalId(formData, "holderId"),
      position: field(formData, "position"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    if (id) {
      // Re-derived against the school in context, so a crafted id renames
      // nothing.
      const existing = await db.cashRegister.findFirst({
        where: { id, schoolId },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    // The unique index would throw; catching it here turns a stack trace into a
    // message pointing at the field the cashier has to change.
    const clash = await db.cashRegister.findFirst({
      where: {
        schoolId,
        code: parsed.data.code,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      return failure(t.treasury.registerCodeTaken, {
        code: t.treasury.registerCodeTaken,
      });
    }

    /*
      The holder, re-derived against this school's staff.

      Never taken from the form on trust: a user id from another organisation
      would hand somebody outside the school a drawer, and `holderId` is exactly
      what the posting rules are checked against. Belonging to this school is the
      test, not merely that the user exists — and it is the same `staffOfSchool`
      the picker offers from, so the list and the write cannot drift.
    */
    let holderId: string | null = null;
    if (parsed.data.holderId) {
      const holder = await db.user.findFirst({
        where: { id: parsed.data.holderId, ...staffOfSchool(schoolId) },
        select: { id: true },
      });
      if (!holder) return failure(t.errors.notFound);
      holderId = holder.id;
    }

    // One drawer per person: the unique index would throw, so the clash is
    // caught here and named instead.
    if (holderId) {
      const held = await db.cashRegister.findFirst({
        where: { holderId, ...(id ? { NOT: { id } } : {}) },
        select: { id: true },
      });
      if (held) {
        return failure(t.treasury.holderTaken, {
          holderId: t.treasury.holderTaken,
        });
      }
    }

    const data = {
      code: parsed.data.code,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      holderId,
      position: parsed.data.position,
      notes: parsed.data.notes,
    };

    if (id) {
      await db.cashRegister.updateMany({ where: { id, schoolId }, data });
    } else {
      await db.cashRegister.create({ data: { schoolId, ...data } });
    }

    refresh();
    return success(
      id ? t.treasury.registerUpdated : t.treasury.registerCreated,
    );
  });
}

/**
 * Retires a till, or brings it back.
 *
 * Retiring is refused while a session is open on it: the drawer still holds
 * cash somebody will be asked to account for, and a till that has quietly
 * vanished from the pickers is one nobody can close.
 */
export async function setCashRegisterActiveAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const id = field(formData, "id");
    const isActive = boolField(formData, "isActive");

    const register = await db.cashRegister.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        _count: { select: { sessions: { where: { status: "OPEN" } } } },
      },
    });
    if (!register) return failure(t.errors.notFound);

    if (!isActive && register._count.sessions > 0) {
      return failure(t.treasury.registerHasOpenSession);
    }

    await db.cashRegister.updateMany({
      where: { id: register.id, schoolId },
      data: { isActive },
    });

    refresh();
    return success(
      isActive ? t.treasury.registerRestored : t.treasury.registerRetired,
    );
  });
}

/**
 * Deletes a till that has never been used.
 *
 * Once a shift has been held on it the row is history — the sessions and every
 * operation posted through them point at it — so it may only be retired. That
 * is a `Restrict` the schema cannot express, since deleting the register would
 * cascade the sessions and take the ledger's audit trail with it.
 */
export async function deleteCashRegisterAction(
  registerId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentSchool();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TREASURY_SESSION);

    const register = await db.cashRegister.findFirst({
      where: { id: registerId, schoolId },
      select: { id: true, _count: { select: { sessions: true } } },
    });
    if (!register) return failure(t.errors.notFound);

    if (register._count.sessions > 0) {
      return failure(t.treasury.registerInUse);
    }

    await db.cashRegister.deleteMany({ where: { id: register.id, schoolId } });

    refresh();
    return success(t.treasury.registerDeleted);
  });
}

// ── Le paiement du personnel ─────────────────────────────────────────────────

