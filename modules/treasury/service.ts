import "server-only";

import { db } from "@/lib/db";
import {
  cashImpactOf,
  documentCode,
  openSessionKey,
  outstandingOf,
  summariseMethod,
  sumCentimes,
  type TenderMethod,
} from "@/modules/treasury/enums";

/**
 * Writes and data invariants for the treasury module.
 *
 * Three rules are enforced here and nowhere else, because every one of them is
 * a rule the database cannot express and a screen must not be trusted with:
 *
 *   1. **A till is open at most once.** Guarded by the `openKey` unique index,
 *      set only through `openSessionKey` — never written by hand.
 *   2. **A receipt's parts equal its whole.** Tenders sum to the total, and so
 *      do allocations. Checked again here after the form has checked it, because
 *      a Server Function is reachable by direct POST.
 *   3. **A schedule line is never over-paid.** Outstanding is re-read *inside*
 *      the transaction that allocates against it, so two cashiers taking money
 *      for the same month at the same moment cannot both succeed.
 *
 * Nothing here is ever deleted. Cancelling writes a reversing operation and
 * flips a status, so a closed session's total stays what it was on the day.
 */

/**
 * Allocates the next document number for a school and calendar year.
 *
 * Counts what already exists rather than keeping a counter table: the volume is
 * a few thousand a year, the count is indexed, and a sequence table that can
 * drift out of step with the rows it numbers is worse than a scan. The unique
 * index on `[schoolId, code]` is what actually guarantees the number is free —
 * this only has to make a collision rare.
 */
async function nextPaymentCode(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);

  const used = await db.payment.count({
    where: { schoolId, createdAt: { gte: yearStart } },
  });

  return documentCode("R", year, used + 1);
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export type OpenSessionInput = {
  cashRegisterId: string;
  openedById: string;
  openingFloatCentimes: number;
  notes: string | null;
};

/**
 * Opens a till for a shift.
 *
 * Returns null when the register already has an open session — the caller turns
 * that into a message rather than an error, because two people opening the same
 * drawer is a race between colleagues, not a bug.
 */
export async function openSession(
  input: OpenSessionInput,
): Promise<{ id: string } | null> {
  const existing = await db.cashSession.findFirst({
    where: { cashRegisterId: input.cashRegisterId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return null;

  return db.cashSession.create({
    data: {
      cashRegisterId: input.cashRegisterId,
      openedById: input.openedById,
      openingFloatCentimes: input.openingFloatCentimes,
      notes: input.notes,
      status: "OPEN",
      openKey: openSessionKey(input.cashRegisterId, "OPEN"),
    },
    select: { id: true },
  });
}

export type CloseSessionResult = {
  expectedCentimes: number;
  countedCentimes: number;
  varianceCentimes: number;
};

/**
 * Counts a till closed.
 *
 * The expected figure is frozen onto the row rather than recomputed on every
 * read. A cancellation posted the following week must not retroactively change
 * what the drawer was expected to hold at the moment it was counted — that
 * number is evidence about a shift, and it stops being true if it keeps moving.
 */
export async function closeSession(
  sessionId: string,
  closedById: string,
  countedCentimes: number,
  notes: string | null,
): Promise<CloseSessionResult | null> {
  const session = await db.cashSession.findFirst({
    where: { id: sessionId, status: "OPEN" },
    select: {
      id: true,
      cashRegisterId: true,
      openingFloatCentimes: true,
      operations: {
        where: { status: "POSTED" },
        select: { cashImpactCentimes: true },
      },
    },
  });
  if (!session) return null;

  const expectedCentimes =
    session.openingFloatCentimes +
    sumCentimes(session.operations.map((o) => o.cashImpactCentimes));
  const varianceCentimes = countedCentimes - expectedCentimes;

  await db.cashSession.update({
    where: { id: sessionId },
    data: {
      status: "CLOSED",
      closedById,
      closedAt: new Date(),
      countedCentimes,
      expectedCentimes,
      varianceCentimes,
      notes,
      // Releases the one-open-session-per-till constraint.
      openKey: openSessionKey(session.cashRegisterId, "CLOSED"),
    },
  });

  return { expectedCentimes, countedCentimes, varianceCentimes };
}

// ── Encaissement ─────────────────────────────────────────────────────────────

export type TenderInput = {
  method: TenderMethod;
  amountCentimes: number;
  reference: string | null;
  /** The declared bank, when it is one of the school's — see Bank. */
  bankId: string | null;
  bankName: string | null;
  chequeNumber: string | null;
  chequeDueOn: Date | null;
  drawerName: string | null;
};

export type AllocationInput = {
  enrollmentFeeId: string;
  amountCentimes: number;
};

export type RecordPaymentInput = {
  schoolId: string;
  schoolYearId: string;
  familyId: string | null;
  createdById: string;
  cashSessionId: string | null;
  paidAt: Date;
  notes: string | null;
  tenders: TenderInput[];
  allocations: AllocationInput[];
};

export type PaymentFailure =
  | "NO_LINES"
  | "TOTALS_DISAGREE"
  | "LINE_UNREACHABLE"
  | "OVER_ALLOCATED";

export type RecordPaymentResult =
  | { ok: true; paymentId: string; code: string; totalCentimes: number }
  | { ok: false; reason: PaymentFailure; lineId?: string };

/**
 * Records a receipt: the money taken, the forms it came in, and the schedule
 * lines it settles.
 *
 * The whole thing is one transaction because a receipt that saved its cheque but
 * not its allocations, or its allocations but not its ledger entry, is worse
 * than one that failed outright — the first two leave a family's balance wrong
 * and nobody knowing it.
 */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  if (input.allocations.length === 0) return { ok: false, reason: "NO_LINES" };

  const tenderTotal = sumCentimes(input.tenders.map((t) => t.amountCentimes));
  const allocationTotal = sumCentimes(
    input.allocations.map((a) => a.amountCentimes),
  );
  if (tenderTotal <= 0 || tenderTotal !== allocationTotal) {
    return { ok: false, reason: "TOTALS_DISAGREE" };
  }

  const code = await nextPaymentCode(input.schoolId);

  return db.$transaction(async (tx) => {
    // Re-read every line inside the transaction, scoped to this school and year
    // — an id from the request may not reach another tenant's schedule, and the
    // outstanding amount must be the one true at the moment of writing.
    const lines = await tx.enrollmentFee.findMany({
      where: {
        id: { in: input.allocations.map((a) => a.enrollmentFeeId) },
        status: "DUE",
        enrollment: {
          schoolYearId: input.schoolYearId,
          student: {
            schoolId: input.schoolId,
            ...(input.familyId ? { familyId: input.familyId } : {}),
          },
        },
      },
      select: {
        id: true,
        amountCentimes: true,
        allocations: {
          where: { payment: { status: "POSTED" } },
          select: { amountCentimes: true },
        },
      },
    });

    const byId = new Map(lines.map((line) => [line.id, line]));

    for (const allocation of input.allocations) {
      const line = byId.get(allocation.enrollmentFeeId);
      if (!line) {
        return {
          ok: false as const,
          reason: "LINE_UNREACHABLE" as const,
          lineId: allocation.enrollmentFeeId,
        };
      }

      const alreadyPaid = sumCentimes(
        line.allocations.map((a) => a.amountCentimes),
      );
      const outstanding = outstandingOf(line.amountCentimes, alreadyPaid);

      if (allocation.amountCentimes <= 0 || allocation.amountCentimes > outstanding) {
        return {
          ok: false as const,
          reason: "OVER_ALLOCATED" as const,
          lineId: line.id,
        };
      }
    }

    const payment = await tx.payment.create({
      data: {
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        familyId: input.familyId,
        code,
        paidAt: input.paidAt,
        totalCentimes: tenderTotal,
        status: "POSTED",
        cashSessionId: input.cashSessionId,
        createdById: input.createdById,
        notes: input.notes,
        allocations: {
          create: input.allocations.map((allocation) => ({
            enrollmentFeeId: allocation.enrollmentFeeId,
            amountCentimes: allocation.amountCentimes,
          })),
        },
      },
      select: { id: true, code: true },
    });

    // A cheque tender brings a cheque into being — that is what puts it on the
    // Suivi Chèques screen and keeps it there until it clears.
    for (const tender of input.tenders) {
      const cheque =
        tender.method === "CHEQUE" && tender.chequeNumber
          ? await tx.cheque.create({
              data: {
                schoolId: input.schoolId,
                direction: "INCOMING",
                number: tender.chequeNumber,
                bankId: tender.bankId,
                bankName: tender.bankName,
                drawerName: tender.drawerName,
                amountCentimes: tender.amountCentimes,
                issuedOn: input.paidAt,
                dueOn: tender.chequeDueOn,
                status: "PENDING",
              },
              select: { id: true },
            })
          : null;

      await tx.paymentTender.create({
        data: {
          paymentId: payment.id,
          method: tender.method,
          amountCentimes: tender.amountCentimes,
          reference: tender.reference,
          bankId: tender.bankId,
          bankName: tender.bankName,
          chequeId: cheque?.id ?? null,
        },
      });
    }

    const method = summariseMethod(input.tenders.map((t) => t.method));
    const cashPortion = sumCentimes(
      input.tenders
        .filter((tender) => tender.method === "CASH")
        .map((tender) => tender.amountCentimes),
    );

    await tx.cashOperation.create({
      data: {
        schoolId: input.schoolId,
        cashSessionId: input.cashSessionId,
        kind: "ENCAISSEMENT",
        method,
        amountCentimes: tenderTotal,
        cashImpactCentimes: cashImpactOf("ENCAISSEMENT", method, cashPortion),
        label: payment.code,
        reference: payment.code,
        occurredAt: input.paidAt,
        status: "POSTED",
        paymentId: payment.id,
        createdById: input.createdById,
      },
    });

    return {
      ok: true as const,
      paymentId: payment.id,
      code: payment.code,
      totalCentimes: tenderTotal,
    };
  });
}

/**
 * Cancels a receipt.
 *
 * The receipt and its allocations stay exactly where they are; what changes is
 * the status, which is what every "how much is still owed" sum filters on — so
 * the money lands back on the schedule lines the moment this runs, without a
 * single row being edited. A mirror operation carries the reversal into the
 * ledger, dated today, because that is when the correction was made.
 */
export async function cancelPayment(
  paymentId: string,
  cancelledById: string,
  reason: string | null,
): Promise<boolean> {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, status: "POSTED" },
    select: {
      id: true,
      schoolId: true,
      code: true,
      totalCentimes: true,
      cashSessionId: true,
      operation: {
        select: { id: true, method: true, cashImpactCentimes: true },
      },
    },
  });
  if (!payment) return false;

  // The reversal lands in whichever session is open now — never the original's,
  // which may well have been counted and closed days ago.
  const openSession = payment.cashSessionId
    ? await db.cashSession.findFirst({
        where: { status: "OPEN", cashRegister: { schoolId: payment.schoolId } },
        select: { id: true },
      })
    : null;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    if (payment.operation) {
      // The original operation stays POSTED, and that is the crux of the whole
      // reversal design. The money really did come in that day: striking it out
      // *and* posting a mirror entry would take it off the drawer twice, and a
      // till that balanced in the morning would show a shortfall by evening.
      // What changes is the payment's status, which is what every "how much has
      // been paid" sum filters on — so the charges go back on the family without
      // a single ledger line being rewritten.
      await tx.cashOperation.create({
        data: {
          schoolId: payment.schoolId,
          cashSessionId: openSession?.id ?? null,
          // Same kind as the original, flagged by `reversesOperationId`. Booking
          // it as a décaissement would report a refunded receipt as if the
          // school had spent the money on something.
          kind: "ENCAISSEMENT",
          method: payment.operation.method,
          amountCentimes: payment.totalCentimes,
          // Mirror image: whatever cash the original moved, this moves back.
          cashImpactCentimes: -payment.operation.cashImpactCentimes,
          label: payment.code,
          reference: payment.code,
          occurredAt: new Date(),
          status: "POSTED",
          reversesOperationId: payment.operation.id,
          createdById: cancelledById,
        },
      });
    }

    // A cheque that paid a cancelled receipt is handed back, not banked.
    await tx.cheque.updateMany({
      where: {
        tender: { paymentId: payment.id },
        status: { in: ["PENDING", "DEPOSITED"] },
      },
      data: { status: "RETURNED", settledOn: new Date() },
    });
  });

  return true;
}

// ── Décaissement ─────────────────────────────────────────────────────────────

export type DisbursementInput = {
  schoolId: string;
  createdById: string;
  cashSessionId: string | null;
  /** Rubrique, sub-rubrique and motif — see prisma/schema/treasury/. */
  categoryId: string | null;
  subcategoryId: string | null;
  motifId: string | null;
  /**
   * The employee paid, when the beneficiary is on the payroll. Null for a
   * landlord or a haulier — see the note on the column. `beneficiaryName` is
   * required either way, so the ledger reads the same for both.
   */
  beneficiaryStaffId?: string | null;
  beneficiaryName: string;
  label: string;
  method: TenderMethod;
  amountCentimes: number;
  reference: string | null;
  chequeNumber: string | null;
  /** The declared bank, when it is one of them. */
  bankId: string | null;
  bankName: string | null;
  occurredAt: Date;
};

/** Pays money out, and raises the cheque when that is how it was paid. */
export async function recordDisbursement(
  input: DisbursementInput,
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const cheque =
      input.method === "CHEQUE" && input.chequeNumber
        ? await tx.cheque.create({
            data: {
              schoolId: input.schoolId,
              direction: "OUTGOING",
              number: input.chequeNumber,
              bankId: input.bankId,
              bankName: input.bankName,
              drawerName: input.beneficiaryName,
              amountCentimes: input.amountCentimes,
              issuedOn: input.occurredAt,
              status: "PENDING",
            },
            select: { id: true },
          })
        : null;

    return tx.cashOperation.create({
      data: {
        schoolId: input.schoolId,
        cashSessionId: input.cashSessionId,
        kind: "DECAISSEMENT",
        method: input.method,
        amountCentimes: input.amountCentimes,
        cashImpactCentimes: cashImpactOf(
          "DECAISSEMENT",
          input.method,
          input.amountCentimes,
        ),
        label: input.label,
        reference: input.reference,
        occurredAt: input.occurredAt,
        status: "POSTED",
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        motifId: input.motifId,
        bankId: input.bankId,
        beneficiaryStaffId: input.beneficiaryStaffId ?? null,
        beneficiaryName: input.beneficiaryName,
        chequeId: cheque?.id ?? null,
        createdById: input.createdById,
      },
      select: { id: true },
    });
  });
}

// ── Transfert ────────────────────────────────────────────────────────────────

export type TransferInput = {
  schoolId: string;
  createdById: string;
  fromSessionId: string;
  fromRegisterId: string;
  toRegisterId: string | null;
  bankId: string | null;
  bankAccountLabel: string | null;
  amountCentimes: number;
  reference: string | null;
  occurredAt: Date;
  label: string;
};

/**
 * Moves money out of one till, into another one or into the bank.
 *
 * A till-to-till handover writes **two** legs sharing a `transferGroupId` — the
 * money leaves one drawer and arrives in the other, and a single row could only
 * ever say one of those. The receiving leg is only written if that till is open:
 * money cannot arrive in a drawer nobody is holding, and it stays out of the
 * sending one until somebody opens the other and it is recorded.
 *
 * A transfer to the bank has one leg, because the bank is not a till.
 */
export async function recordTransfer(
  input: TransferInput,
): Promise<{ id: string; receivedIntoSession: boolean }> {
  const transferGroupId = crypto.randomUUID();

  const destinationSession = input.toRegisterId
    ? await db.cashSession.findFirst({
        where: { cashRegisterId: input.toRegisterId, status: "OPEN" },
        select: { id: true },
      })
    : null;

  return db.$transaction(async (tx) => {
    const out = await tx.cashOperation.create({
      data: {
        schoolId: input.schoolId,
        cashSessionId: input.fromSessionId,
        kind: "TRANSFERT",
        method: "CASH",
        amountCentimes: input.amountCentimes,
        cashImpactCentimes: -input.amountCentimes,
        label: input.label,
        reference: input.reference,
        occurredAt: input.occurredAt,
        status: "POSTED",
        transferGroupId,
        counterpartRegisterId: input.toRegisterId,
        bankId: input.bankId,
        bankAccountLabel: input.bankAccountLabel,
        createdById: input.createdById,
      },
      select: { id: true },
    });

    if (destinationSession) {
      await tx.cashOperation.create({
        data: {
          schoolId: input.schoolId,
          cashSessionId: destinationSession.id,
          kind: "TRANSFERT",
          method: "CASH",
          amountCentimes: input.amountCentimes,
          cashImpactCentimes: input.amountCentimes,
          label: input.label,
          reference: input.reference,
          occurredAt: input.occurredAt,
          status: "POSTED",
          transferGroupId,
          counterpartRegisterId: input.fromRegisterId,
          createdById: input.createdById,
        },
      });
    }

    return {
      id: out.id,
      receivedIntoSession: destinationSession !== null,
    };
  });
}

// ── Chèques ──────────────────────────────────────────────────────────────────

/**
 * Moves a cheque along its lifecycle, stamping whichever date the new status
 * makes meaningful.
 *
 * A bounced incoming cheque puts its fees back on the family automatically: the
 * receipt it settled is cancelled, which is the same mechanism as any other
 * cancellation, so there is exactly one way money ever goes back onto a
 * schedule line.
 */
export async function setChequeStatus(
  chequeId: string,
  status: string,
  actedById: string,
  options: { settledOn?: Date | null; bounceReason?: string | null } = {},
): Promise<boolean> {
  const cheque = await db.cheque.findUnique({
    where: { id: chequeId },
    select: {
      id: true,
      direction: true,
      tender: { select: { paymentId: true } },
    },
  });
  if (!cheque) return false;

  const now = options.settledOn ?? new Date();

  await db.cheque.update({
    where: { id: chequeId },
    data: {
      status,
      depositedOn: status === "DEPOSITED" ? now : undefined,
      settledOn:
        status === "CASHED" || status === "BOUNCED" || status === "RETURNED"
          ? now
          : undefined,
      bounceReason: status === "BOUNCED" ? options.bounceReason ?? null : null,
    },
  });

  if (status === "BOUNCED" && cheque.direction === "INCOMING" && cheque.tender) {
    await cancelPayment(cheque.tender.paymentId, actedById, "CHEQUE_BOUNCED");
  }

  return true;
}
