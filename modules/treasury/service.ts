import "server-only";

import { db } from "@/lib/db";
import {
  canMoveCheque,
  cashImpactOf,
  chequeUndoesReceipt,
  documentCode,
  expectedDrawerTotal,
  isStaleSession,
  OPEN_CHEQUE_STATUSES,
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
 *   1. **A till is open at most once, by the person who holds it.** The first
 *      half is guarded by the `openKey` unique index, set only through
 *      `openSessionKey`; the second by `openSession`, because a drawer two
 *      people can reach has a shortfall belonging to nobody.
 *   1b. **A shift belongs to a calendar day.** Yesterday's session is closed
 *      uncounted before anything can be posted today — see `resolveCashSession`,
 *      which every movement of cash goes through.
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
 * The client inside `db.$transaction`, for the helpers that take one.
 *
 * Derived from the client rather than imported from Prisma's namespace so it
 * follows the extensions in lib/db.ts — a hand-written `Prisma.TransactionClient`
 * would silently lose the audit extension's typing.
 */
export type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Allocates the next document number for a school and calendar year.
 *
 * Counts what already exists rather than keeping a counter table: the volume is
 * a few thousand a year, the count is indexed, and a sequence table that can
 * drift out of step with the rows it numbers is worse than a scan.
 *
 * Takes the transaction client and is called *inside* it, so the count and the
 * insert that consumes it cannot be separated by another cashier's receipt. The
 * unique index on `[schoolId, code]` is still the real guarantee — see
 * `isDuplicateKey` and the retry around `recordPayment`.
 */
async function nextPaymentCode(
  tx: TxClient,
  schoolId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);

  const used = await tx.payment.count({
    where: { schoolId, createdAt: { gte: yearStart } },
  });

  return documentCode("R", year, used + 1);
}

/**
 * Whether a write failed on a unique index, optionally on a named column.
 *
 * Matched structurally rather than with `instanceof PrismaClientKnownRequestError`:
 * the extended client in lib/db.ts re-wraps errors, and a failed `instanceof`
 * here would turn a retryable collision into a five-hundred handed to a cashier
 * with a parent standing in front of them.
 *
 * `column` matters because only *some* collisions are worth retrying. Two
 * cashiers reaching for the same receipt number is a race that the next attempt
 * wins; anything else is a request that will fail identically five times over.
 */
function isDuplicateKey(error: unknown, column?: string): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: unknown }).code !== "P2002"
  ) {
    return false;
  }
  if (!column) return true;

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return JSON.stringify(target ?? "").includes(column);
}

/**
 * Retries a write that allocates a receipt number, when it lost the number.
 *
 * Two cashiers writing at the same second read the same receipt count and ask
 * for the same code; the unique index refuses the second, and the next attempt
 * sees the first one's row. Retried rather than pre-locked because the collision
 * is rare and a lock on every receipt is not.
 *
 * Shared rather than inlined at the encaissement, because the cheque unwind
 * allocates a code too — it issues the replacement receipt — and without this it
 * turned a bounced cheque into a five-hundred whenever somebody happened to be
 * taking money at the same moment.
 *
 * Narrowed to the code column: any other unique failure will fail identically
 * five times over, so re-running it only delays the error.
 */
async function withReceiptCodeRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 4 || !isDuplicateKey(error, "code")) throw error;
    }
  }
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export type OpenSessionInput = {
  schoolId: string;
  cashRegisterId: string;
  openedById: string;
  openingFloatCentimes: number;
  notes: string | null;
};

export type OpenSessionResult =
  | { ok: true; id: string }
  /** The till is somebody else's — see `CashRegister.holderId`. */
  | { ok: false; reason: "NOT_YOUR_TILL" }
  /** Somebody already has it open, including this same person. */
  | { ok: false; reason: "ALREADY_OPEN" }
  | { ok: false; reason: "NOT_FOUND" };

/**
 * Opens a till for a shift.
 *
 * ── Two rules, both enforced here rather than in the screen ──────────────────
 * A held till may be opened only by the person who holds it. A Server Function
 * is reachable by direct POST, so a check on the screen that hides other
 * people's tills protects nothing — and the whole value of one drawer per
 * cashier is that a shortfall has exactly one name attached to it.
 *
 * A till already open cannot be opened again. Guarded by the `openKey` unique
 * index underneath as well; this only makes the failure a message rather than a
 * constraint violation, because two colleagues reaching for the same drawer is
 * a race between people, not a bug.
 */
export async function openSession(
  input: OpenSessionInput,
): Promise<OpenSessionResult> {
  // Scoped by the school as well as the id. The action re-derives it too, but a
  // till is money and the invariant belongs where it cannot be skipped by the
  // next caller rather than only in the one that exists today.
  const register = await db.cashRegister.findFirst({
    where: { id: input.cashRegisterId, schoolId: input.schoolId, isActive: true },
    select: { id: true, holderId: true },
  });
  if (!register) return { ok: false, reason: "NOT_FOUND" };

  // An unheld till is the shared drawer — anyone with the permission may take
  // it. A held one belongs to its holder and to nobody else.
  if (register.holderId !== null && register.holderId !== input.openedById) {
    return { ok: false, reason: "NOT_YOUR_TILL" };
  }

  const existing = await db.cashSession.findFirst({
    where: { cashRegisterId: register.id, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "ALREADY_OPEN" };

  const session = await db.cashSession.create({
    data: {
      cashRegisterId: register.id,
      openedById: input.openedById,
      openingFloatCentimes: input.openingFloatCentimes,
      notes: input.notes,
      status: "OPEN",
      openKey: openSessionKey(register.id, "OPEN"),
    },
    select: { id: true },
  });

  return { ok: true, id: session.id };
}

/**
 * The float plus every posted cash movement — what the drawer should hold, and
 * therefore the ceiling on what may leave it.
 *
 * Exported because every screen that lets cash out checks against it — the
 * décaissement, the transfert, a salary, an avance, a reversal handing money
 * back — and a second implementation of the same sum is how one screen comes to
 * allow what another refuses. Null when the session is not open.
 */
export async function availableCashInSession(
  sessionId: string,
): Promise<number | null> {
  const session = await db.cashSession.findFirst({
    where: { id: sessionId, status: "OPEN" },
    select: {
      openingFloatCentimes: true,
      operations: {
        where: { status: "POSTED" },
        select: { cashImpactCentimes: true },
      },
    },
  });
  if (!session) return null;

  return expectedDrawerTotal(
    session.openingFloatCentimes,
    session.operations.map((o) => o.cashImpactCentimes),
  );
}

/**
 * The drawer's contents when they will not cover `amountCentimes`, else null.
 *
 * The rule — cash that is not in the till cannot leave it — lives here so the
 * décaissement, the transfert, a salary, an avance and both reversal paths all
 * apply the same one. The *sentence* stays with the caller: this layer holds no
 * dictionary, and the figure is read by whoever is standing at the drawer.
 *
 * Named for the question rather than the answer: it returns what the drawer
 * actually holds, and null when that is enough. `cashShortfall` read as though
 * a number meant the gap, which is not what it ever was.
 */
export async function availableIfShortOf(
  sessionId: string,
  amountCentimes: number,
): Promise<number | null> {
  const available = (await availableCashInSession(sessionId)) ?? 0;
  return amountCentimes > available ? available : null;
}

export type CashSessionResolution =
  /** Usable: post into it. */
  | { state: "OPEN"; sessionId: string }
  /** Nothing open for this cashier — they must open their till first. */
  | { state: "NONE" }
  /** Yesterday's shift, now closed uncounted. Today's must be opened. */
  | { state: "STALE_CLOSED"; openedAt: Date; expectedCentimes: number };

/**
 * The session a cash movement may be posted into, closing yesterday's on the way.
 *
 * ── This is the gate every movement of cash goes through ─────────────────────
 * Encaissement, décaissement and transfert all call it, so the day rule cannot
 * hold on one screen and leak on another. It is deliberately *not* a read: it
 * has a side effect, and the side effect is the point.
 *
 * ── Why a stale session is closed rather than reused or refused ──────────────
 * Refusing and leaving it open would strand the cashier: they cannot post, and
 * the till they need to reopen is already open. Reusing it would date today's
 * takings into yesterday's drawer, so neither day would ever reconcile — the
 * one failure a caisse exists to prevent.
 *
 * So it is closed, and closed *uncounted*: nobody was standing there at
 * midnight, and writing `counted = expected` would assert a count that never
 * happened. The expected figure is a fact and is frozen; the counted figure and
 * the variance stay null, and `wasAutoClosed` says why. Whoever holds the till
 * then opens today's with a fresh float, and the discrepancy — if there is one
 * — surfaces against a real count instead of being papered over.
 *
 * The caller is told which of the three states it got, because "you have no
 * till open" and "your till was yesterday's" need different sentences.
 */
export async function resolveCashSession(
  schoolId: string,
  userId: string,
  now: Date = new Date(),
): Promise<CashSessionResolution> {
  const session = await db.cashSession.findFirst({
    where: {
      status: "OPEN",
      cashRegister: { schoolId },
      // The cashier's own shift: whoever opened it, or whoever holds the till.
      // Not simply "any open session in the school" — that was what let one
      // person's receipt land in another person's drawer.
      OR: [{ openedById: userId }, { cashRegister: { holderId: userId } }],
    },
    orderBy: { openedAt: "desc" },
    select: { id: true, openedAt: true },
  });
  if (!session) return { state: "NONE" };

  if (!isStaleSession(session.openedAt, now)) {
    return { state: "OPEN", sessionId: session.id };
  }

  const expectedCentimes = (await availableCashInSession(session.id)) ?? 0;
  await finaliseSession(session.id, {
    closedById: null,
    countedCentimes: null,
    expectedCentimes,
    wasAutoClosed: true,
  });

  return { state: "STALE_CLOSED", openedAt: session.openedAt, expectedCentimes };
}

/**
 * Writes the closing figures onto a session and releases the one-open-per-till
 * constraint.
 *
 * Shared by the counted close and the day-boundary one so the two cannot drift
 * — in particular so both always clear `openKey`, which is the only thing
 * standing between a school and two open drawers on one till.
 */
async function finaliseSession(
  sessionId: string,
  figures: {
    closedById: string | null;
    countedCentimes: number | null;
    expectedCentimes: number;
    wasAutoClosed: boolean;
    notes?: string | null;
  },
): Promise<void> {
  const session = await db.cashSession.findUnique({
    where: { id: sessionId },
    select: { cashRegisterId: true },
  });
  if (!session) return;

  await db.cashSession.update({
    where: { id: sessionId },
    data: {
      status: "CLOSED",
      closedById: figures.closedById,
      closedAt: new Date(),
      countedCentimes: figures.countedCentimes,
      expectedCentimes: figures.expectedCentimes,
      // Unknowable when nobody counted — see CashSession.wasAutoClosed.
      varianceCentimes:
        figures.countedCentimes === null
          ? null
          : figures.countedCentimes - figures.expectedCentimes,
      wasAutoClosed: figures.wasAutoClosed,
      ...(figures.notes !== undefined ? { notes: figures.notes } : {}),
      openKey: openSessionKey(session.cashRegisterId, "CLOSED"),
    },
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
  const expectedCentimes = await availableCashInSession(sessionId);
  if (expectedCentimes === null) return null;

  await finaliseSession(sessionId, {
    closedById,
    countedCentimes,
    expectedCentimes,
    // Somebody stood at the drawer and counted it. That is the difference this
    // flag records.
    wasAutoClosed: false,
    notes,
  });

  return {
    expectedCentimes,
    countedCentimes,
    varianceCentimes: countedCentimes - expectedCentimes,
  };
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

  /*
    One line, one allocation.

    A request naming the same schedule line twice used to pass the over-payment
    check twice — each half was compared against an outstanding figure that knew
    nothing about the other — and only the unique index downstream caught it, as
    a crash. Summing them first makes the two halves one allocation, which is
    what the cashier meant, and puts the whole of it in front of the check.
  */
  const merged = new Map<string, number>();
  for (const allocation of input.allocations) {
    merged.set(
      allocation.enrollmentFeeId,
      (merged.get(allocation.enrollmentFeeId) ?? 0) + allocation.amountCentimes,
    );
  }
  const allocations: AllocationInput[] = [...merged].map(
    ([enrollmentFeeId, amountCentimes]) => ({ enrollmentFeeId, amountCentimes }),
  );

  return withReceiptCodeRetry(() =>
    recordPaymentOnce({ ...input, allocations }, tenderTotal),
  );
}

async function recordPaymentOnce(
  input: RecordPaymentInput,
  tenderTotal: number,
): Promise<RecordPaymentResult> {
  return db.$transaction(async (tx) => {
    const code = await nextPaymentCode(tx, input.schoolId);

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
 *
 * `reason` is written onto the receipt alongside the name of whoever cancelled
 * it, and both are required of every caller. A cancellation is the one movement
 * in this ledger with no paper behind it, so the note and the name are the only
 * account of it that will exist when a parent disputes the receipt in June.
 *
 * The text arrives already in the reader's language: the service layer holds no
 * dictionary, so an automatic cancellation — a cheque that bounced — has its
 * sentence composed by the action that triggers it.
 */
export type CancelPaymentResult =
  | { ok: true }
  | { ok: false; reason: CancelPaymentFailure };

export type CancelPaymentFailure =
  /** Already cancelled, or not this school's. */
  | "NOT_FOUND"
  /** Cash has to go back over the counter, and the canceller holds no till. */
  | "NO_DRAWER"
  /** The drawer does not hold what is being handed back. */
  | "INSUFFICIENT_CASH";

/** The shape both the standalone cancellation and the bounce path work from. */
type CancellablePayment = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  familyId: string | null;
  code: string;
  paidAt: Date;
  totalCentimes: number;
  cashSessionId: string | null;
  operation: {
    id: string;
    method: string;
    cashImpactCentimes: number;
  } | null;
};

async function findCancellablePayment(
  paymentId: string,
  schoolId: string,
): Promise<CancellablePayment | null> {
  return db.payment.findFirst({
    // Scoped by the school, not by the id alone — see `openSession`.
    where: { id: paymentId, schoolId, status: "POSTED" },
    select: {
      id: true,
      schoolId: true,
      schoolYearId: true,
      familyId: true,
      code: true,
      paidAt: true,
      totalCentimes: true,
      cashSessionId: true,
      operation: {
        select: { id: true, method: true, cashImpactCentimes: true },
      },
    },
  });
}

/**
 * Where a reversal's cash goes, and whether it may go there at all.
 *
 * ── Why the canceller's own till and no other ────────────────────────────────
 * Handing money back is a movement out of the drawer the person doing it is
 * standing at. Posting it into "whichever till happens to be open" — which is
 * what this used to do — takes the shortfall out of a colleague's count for a
 * receipt they never wrote, and that colleague is the one who signs for the
 * variance at closing time.
 *
 * ── Why it can be refused ────────────────────────────────────────────────────
 * Cash that is not in the drawer cannot come out of it. A receipt taken
 * yesterday and cancelled today is refunded from today's float, and if today's
 * float will not cover it the refusal is the truth rather than an obstacle —
 * the ledger would otherwise show a till holding less than nothing.
 *
 * Nothing to hand back (a cheque or a virement, or a bounce where the school
 * keeps the cash) needs no till: the reversal moves no notes, so it is posted
 * without a session.
 */
async function resolveReversalDrawer(
  schoolId: string,
  actorId: string,
  cashImpactCentimes: number,
): Promise<
  { ok: true; sessionId: string | null } | { ok: false; reason: CancelPaymentFailure }
> {
  if (cashImpactCentimes === 0) return { ok: true, sessionId: null };

  const resolution = await resolveCashSession(schoolId, actorId);
  if (resolution.state !== "OPEN") return { ok: false, reason: "NO_DRAWER" };

  // Through the shared rule, not a second implementation of it: this is the
  // same "cash that is not in the drawer cannot leave it" the décaissement and
  // the transfert ask, and two copies is how one screen comes to allow what
  // another refuses.
  if (cashImpactCentimes < 0) {
    const short = await availableIfShortOf(
      resolution.sessionId,
      -cashImpactCentimes,
    );
    if (short !== null) return { ok: false, reason: "INSUFFICIENT_CASH" };
  }

  return { ok: true, sessionId: resolution.sessionId };
}

type CancelInTxOptions = {
  reversalSessionId: string | null;
  reversalCashImpactCentimes: number;
  /**
   * Cheques that must survive the cancellation — the ones a replacement receipt
   * is about to take over. Everything else the receipt was settled with is
   * handed back.
   */
  keepChequeIds?: readonly string[];
};

/** The cancellation itself, so the bounce path can do it in its own transaction. */
async function cancelPaymentInTx(
  tx: TxClient,
  payment: CancellablePayment,
  cancelledById: string,
  reason: string,
  options: CancelInTxOptions,
): Promise<void> {
  const now = new Date();

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: reason,
      cancelledById,
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
        cashSessionId: options.reversalSessionId,
        // Same kind as the original, flagged by `reversesOperationId`. Booking
        // it as a décaissement would report a refunded receipt as if the
        // school had spent the money on something.
        kind: "ENCAISSEMENT",
        method: payment.operation.method,
        amountCentimes: payment.totalCentimes,
        cashImpactCentimes: options.reversalCashImpactCentimes,
        label: payment.code,
        reference: payment.code,
        occurredAt: now,
        status: "POSTED",
        reversesOperationId: payment.operation.id,
        createdById: cancelledById,
      },
    });
  }

  // A cheque that paid a cancelled receipt is handed back, not banked — unless
  // a replacement receipt is taking it over, in which case it is still the
  // school's to bank and must not be marked returned.
  await tx.cheque.updateMany({
    where: {
      tender: { paymentId: payment.id },
      status: { in: [...OPEN_CHEQUE_STATUSES] },
      ...(options.keepChequeIds && options.keepChequeIds.length > 0
        ? { id: { notIn: [...options.keepChequeIds] } }
        : {}),
    },
    data: { status: "RETURNED", settledOn: now },
  });
}

export async function cancelPayment(
  paymentId: string,
  schoolId: string,
  cancelledById: string,
  reason: string,
): Promise<CancelPaymentResult> {
  const payment = await findCancellablePayment(paymentId, schoolId);
  if (!payment) return { ok: false, reason: "NOT_FOUND" };

  // Mirror image: whatever cash the original moved, this moves back.
  const reversalCashImpactCentimes = -(
    payment.operation?.cashImpactCentimes ?? 0
  );

  const drawer = await resolveReversalDrawer(
    payment.schoolId,
    cancelledById,
    reversalCashImpactCentimes,
  );
  if (!drawer.ok) return { ok: false, reason: drawer.reason };

  await db.$transaction((tx) =>
    cancelPaymentInTx(tx, payment, cancelledById, reason, {
      reversalSessionId: drawer.sessionId,
      reversalCashImpactCentimes,
    }),
  );

  return { ok: true };
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
  /** The supplier this went to, where it was one — see Supplier. */
  supplierId?: string | null;
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
  /** What the bursar wrote about it — see CashOperation.notes. */
  notes: string | null;
};

/**
 * Pays money out, and raises the cheque when that is how it was paid.
 *
 * ── Why it takes a transaction ──────────────────────────────────────────────
 * Called on its own it opens one, which is what the décaissement screen wants.
 * But paying a bulletin or an avance has to write the operation *and* point the
 * payslip at it in one go — see `payStaffSalary`. Left to open its own
 * transaction, the operation committed before the link was written, so a
 * failure in between let money out of the ledger against a payslip still
 * reading unpaid, and two concurrent payouts each got their own operation
 * without either violating the unique index that was supposed to stop them.
 */
export async function recordDisbursement(
  input: DisbursementInput,
  outerTx?: TxClient,
): Promise<{ id: string }> {
  const write = async (tx: TxClient) => {
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
        notes: input.notes,
        occurredAt: input.occurredAt,
        status: "POSTED",
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        motifId: input.motifId,
        bankId: input.bankId,
        beneficiaryStaffId: input.beneficiaryStaffId ?? null,
        supplierId: input.supplierId ?? null,
        beneficiaryName: input.beneficiaryName,
        chequeId: cheque?.id ?? null,
        createdById: input.createdById,
      },
      select: { id: true },
    });
  };

  return outerTx ? write(outerTx) : db.$transaction(write);
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
  /** What the bursar wrote about it — see CashOperation.notes. */
  notes: string | null;
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

  return db.$transaction(async (tx) => {
    // Read inside the transaction: a till that closes between the look-up and
    // the write would otherwise take the arriving leg into a counted session,
    // moving a drawer somebody has already signed for.
    const destinationSession = input.toRegisterId
      ? await tx.cashSession.findFirst({
          where: { cashRegisterId: input.toRegisterId, status: "OPEN" },
          select: { id: true },
        })
      : null;

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
        notes: input.notes,
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
          notes: input.notes,
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
 * An incoming cheque that ends without paying — bounced, handed back, or struck
 * out — puts its fees back on the family automatically: the receipt it settled
 * is cancelled, which is the same mechanism as any other cancellation, so there
 * is exactly one way money ever goes back onto a schedule line.
 */
export async function setChequeStatus(
  chequeId: string,
  schoolId: string,
  status: string,
  actedById: string,
  options: {
    settledOn?: Date | null;
    bounceReason?: string | null;
    /**
     * The sentence written onto the receipt this cheque settled, when ending it
     * cancels one. Composed by the caller because it is read by a parent at the
     * desk and this layer has no dictionary to write it in their language.
     */
    cancelReason?: string;
  } = {},
): Promise<boolean> {
  // Scoped by the school, not by the id alone — see `openSession`.
  const cheque = await db.cheque.findFirst({
    where: { id: chequeId, schoolId },
    select: {
      id: true,
      status: true,
      direction: true,
      tender: { select: { id: true, paymentId: true } },
    },
  });
  if (!cheque) return false;

  /*
    The transition table is consulted rather than trusted from the request.

    A Server Function is reachable by direct POST, and without this a crafted
    one could take a CASHED cheque back to PENDING — money that has arrived
    un-arriving, with the receipt it settled left standing. Refusing is the
    whole reason `CHEQUE_TRANSITIONS` is a declaration and not a set of buttons.
  */
  if (!canMoveCheque(cheque.status, status)) return false;

  const now = options.settledOn ?? new Date();

  /*
    Bounced, handed back and struck out are one situation here: the paper is
    not going to pay, so the receipt it settled has to come undone. Restricting
    this to BOUNCED — which is what it did — meant a cashier who struck out a
    mistyped cheque, or handed one back to a family paying cash instead, left
    the receipt standing: the fees stayed settled by a cheque that no longer
    existed and the caisse went on counting the money.

    Outgoing cheques and cheques tracked on their own settle no receipt, so
    ending them moves nothing but the row itself *here*. An outgoing cheque
    that paid a décaissement is undone by reversing that movement instead, and
    `setChequeStatusAction` routes it through `cancelOperation` before it ever
    reaches this function — see the note there.
  */
  const undoingReceipt =
    chequeUndoesReceipt(status) &&
    cheque.direction === "INCOMING" &&
    cheque.tender !== null;

  /*
    The mark and its consequences are one transaction.

    They used to be two statements, and a failure between them left the worst
    state this module can reach: a cheque marked unpaid while the receipt it
    settled still stood, so the family read as having paid money the bank had
    just refused. Marking the paper and putting the fees back are one act.
  */
  const unwind = undoingReceipt
    ? await prepareChequeUnwind(
        cheque.tender!.id,
        cheque.tender!.paymentId,
        schoolId,
        // The note used to be the bare token "CHEQUE_BOUNCED", which is what a
        // parent then saw printed beside their cancelled receipt. The caller
        // hands down a written sentence instead, and the fallback is only ever
        // reached by a caller that forgot one.
        options.cancelReason ?? "Chèque non encaissé",
      )
    : null;

  // Wrapped in the retry because the unwind issues a replacement receipt, and
  // so competes for a receipt number with whoever is at the desk.
  await withReceiptCodeRetry(() =>
    db.$transaction(async (tx) => {
      await tx.cheque.update({
        where: { id: chequeId },
        data: {
          status,
          depositedOn: status === "DEPOSITED" ? now : undefined,
          // Every ending is stamped, including CANCELLED: the follow-up screen
          // offers a date on all of them, and one that was silently dropped
          // left a struck-out cheque with no record of the day it left the pile.
          settledOn:
            status === "CASHED" || chequeUndoesReceipt(status) ? now : undefined,
          // Cleared on the way out of BOUNCED as well: a cheque re-presented and
          // cleared must not still carry the reason it failed the first time.
          bounceReason:
            status === "BOUNCED" ? (options.bounceReason ?? null) : null,
        },
      });

      if (unwind) await applyChequeUnwind(tx, unwind, actedById);
    }),
  );

  return true;
}

/**
 * Puts an unpaid cheque's fees back on the family without taking the rest of the
 * receipt with them.
 *
 * Reached from every ending where the cheque never became money — bounced,
 * handed back, struck out. They differ only in what the bursar writes on the
 * receipt; what has to happen to the money is identical, so it happens here
 * once.
 *
 * ── The case this exists for ─────────────────────────────────────────────────
 * A parent settles 2 000 with 500 in cash and a 1 500 cheque. The cheque comes
 * back unpaid. Cancelling the whole receipt is right as far as the fees go —
 * the allocations were one indivisible act and nobody can say which month the
 * 500 paid — but it used to reverse the *cash* as well, and the school never
 * gave that 500 back. The drawer was told to hold 500 less than it did, and the
 * family was re-charged for money they had genuinely handed over.
 *
 * So the receipt is cancelled with the cash **retained**, and everything that
 * did not fail is re-issued as a second receipt against the same schedule
 * lines. What the family owes falls by exactly the cheque; the drawer does not
 * move at all, because no note ever left it.
 *
 * ── Why the replacement posts no cash impact ─────────────────────────────────
 * The 500 arrived on the original operation and was never reversed — it is
 * already counted in whichever session took it, which may well be closed. A
 * replacement claiming to bring it in again would have the school counting the
 * same notes twice.
 */
type ChequeUnwind = {
  payment: CancellablePayment;
  reason: string;
  reversalCashImpactCentimes: number;
  survivingTotal: number;
  surviving: {
    id: string;
    method: string;
    amountCentimes: number;
    reference: string | null;
    bankId: string | null;
    bankName: string | null;
    chequeId: string | null;
  }[];
  /** Where the surviving money is re-allocated. Empty when it cannot be. */
  replacementAllocations: AllocationInput[];
};

/** Everything the unwind needs to know, read before the transaction opens. */
async function prepareChequeUnwind(
  unpaidTenderId: string,
  paymentId: string,
  schoolId: string,
  reason: string,
): Promise<ChequeUnwind | null> {
  const payment = await findCancellablePayment(paymentId, schoolId);
  if (!payment) return null;

  const tenders = await db.paymentTender.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      method: true,
      amountCentimes: true,
      reference: true,
      bankId: true,
      bankName: true,
      chequeId: true,
    },
  });

  const surviving = tenders.filter((tender) => tender.id !== unpaidTenderId);
  const survivingTotal = sumCentimes(surviving.map((t) => t.amountCentimes));

  /*
    ── The re-allocation is planned here, before anything is written ──────────
    Room is measured against every *other* posted receipt, so the plan already
    knows what the cancellation is about to free. It cannot go stale either:
    while this receipt is still POSTED, a concurrent one sees the lines as
    *more* settled than they are about to be, so nothing can take the room being
    reclaimed. That is what lets the transaction below write the plan as it
    stands rather than re-deriving it mid-flight.
  */
  const allocations = await db.paymentAllocation.findMany({
    where: { paymentId },
    orderBy: [{ enrollmentFee: { dueDate: "asc" } }],
    select: {
      enrollmentFeeId: true,
      amountCentimes: true,
      enrollmentFee: {
        select: {
          status: true,
          amountCentimes: true,
          allocations: {
            where: {
              payment: { status: "POSTED" },
              NOT: { paymentId },
            },
            select: { amountCentimes: true },
          },
        },
      },
    },
  });

  const replacementAllocations: AllocationInput[] = [];
  let left = survivingTotal;

  for (const allocation of allocations) {
    if (left <= 0) break;
    const line = allocation.enrollmentFee;
    if (line.status !== "DUE") continue;

    const roomAfterCancel = outstandingOf(
      line.amountCentimes,
      sumCentimes(line.allocations.map((other) => other.amountCentimes)),
    );
    const take = Math.min(left, roomAfterCancel, allocation.amountCentimes);
    if (take <= 0) continue;

    replacementAllocations.push({
      enrollmentFeeId: allocation.enrollmentFeeId,
      amountCentimes: take,
    });
    left -= take;
  }

  /*
    ── When not every centime can be placed ───────────────────────────────────
    Only reachable if a line the receipt paid has since stopped being owed,
    which the fee grid now refuses while money is on it. Rather than issue a
    receipt whose tenders and allocations disagree — the one thing a receipt may
    never do — the whole payment is reversed as it always was, cash included.
    The bursar then has notes in the drawer and no charge to put them against,
    which is a conversation to have with the family rather than a figure to
    invent.
  */
  const placeable = survivingTotal - left;
  const reissuing = placeable === survivingTotal && survivingTotal > 0;

  // Every centime of cash on the receipt survives: a cheque moves no notes, so
  // nothing the school is holding is affected by its failing to pay.
  const retainedCashCentimes = reissuing
    ? sumCentimes(
        surviving
          .filter((tender) => tender.method === "CASH")
          .map((tender) => tender.amountCentimes),
      )
    : 0;
  const reversalCashImpactCentimes = -(
    (payment.operation?.cashImpactCentimes ?? 0) - retainedCashCentimes
  );

  return {
    payment,
    reason,
    reversalCashImpactCentimes,
    survivingTotal: reissuing ? survivingTotal : 0,
    surviving,
    replacementAllocations: reissuing ? replacementAllocations : [],
  };
}

/** The unwind itself, inside the transaction that ends the cheque. */
async function applyChequeUnwind(
  tx: TxClient,
  unwind: ChequeUnwind,
  actedById: string,
): Promise<void> {
  const {
    payment,
    reason,
    reversalCashImpactCentimes,
    survivingTotal,
    surviving,
    replacementAllocations,
  } = unwind;

  await cancelPaymentInTx(tx, payment, actedById, reason, {
    reversalSessionId: payment.cashSessionId,
    reversalCashImpactCentimes,
    keepChequeIds:
      survivingTotal > 0
        ? surviving
            .map((tender) => tender.chequeId)
            .filter((id): id is string => id !== null)
        : // Nothing is being re-issued, so no cheque is being taken over: the
          // rest of the receipt goes back to the family like any cancellation.
          [],
  });

  if (survivingTotal <= 0) return;

  {
    const replacement = await tx.payment.create({
      data: {
        schoolId: payment.schoolId,
        schoolYearId: payment.schoolYearId,
        familyId: payment.familyId,
        code: await nextPaymentCode(tx, payment.schoolId),
        // The day the money actually arrived, not the day the cheque failed:
        // this receipt stands in for the part of the original that held good.
        paidAt: payment.paidAt,
        totalCentimes: survivingTotal,
        status: "POSTED",
        cashSessionId: payment.cashSessionId,
        createdById: actedById,
        notes: reason,
        allocations: { create: replacementAllocations },
      },
      select: { id: true, code: true },
    });

    for (const tender of surviving) {
      /*
        `PaymentTender.chequeId` is unique — one piece of paper, one tender —
        so the link is released from the cancelled receipt before the live one
        claims it. Raising a second Cheque row instead would have the school
        chasing a cheque it is already holding.
      */
      if (tender.chequeId) {
        await tx.paymentTender.update({
          where: { id: tender.id },
          data: { chequeId: null },
        });
      }

      await tx.paymentTender.create({
        data: {
          paymentId: replacement.id,
          method: tender.method,
          amountCentimes: tender.amountCentimes,
          reference: tender.reference,
          bankId: tender.bankId,
          bankName: tender.bankName,
          chequeId: tender.chequeId,
        },
      });
    }

    await tx.cashOperation.create({
      data: {
        schoolId: payment.schoolId,
        cashSessionId: payment.cashSessionId,
        kind: "ENCAISSEMENT",
        method: summariseMethod(
          surviving.map((tender) => tender.method as TenderMethod),
        ),
        amountCentimes: survivingTotal,
        // Zero, deliberately — see the note above.
        cashImpactCentimes: 0,
        label: replacement.code,
        reference: replacement.code,
        occurredAt: new Date(),
        status: "POSTED",
        paymentId: replacement.id,
        createdById: actedById,
      },
    });
  }
}

// ── Annuler un mouvement ─────────────────────────────────────────────────────

/**
 * Thrown by a `cancelOperation` hook that refuses the reversal.
 *
 * A hook runs inside the transaction, so refusing has to unwind the mirror
 * entries written a moment earlier — and the only thing that unwinds a Prisma
 * transaction is a throw. Caught by `cancelOperation` and turned back into an
 * ordinary `BLOCKED` result, so callers still never see an exception for an
 * expected refusal.
 */
export class ReversalBlockedError extends Error {
  constructor(message = "REVERSAL_BLOCKED") {
    super(message);
    this.name = "ReversalBlockedError";
  }
}

/**
 * Thrown when a drawer will not cover the cash a reversal has to hand back.
 *
 * A throw for the same reason as `ReversalBlockedError`: the check now runs
 * inside the transaction, and unwinding a Prisma transaction takes an exception.
 * Caught by `cancelOperation` and returned as the ordinary `INSUFFICIENT_CASH`
 * result, so callers still never see it.
 */
class InsufficientCashError extends Error {
  constructor() {
    super("INSUFFICIENT_CASH");
    this.name = "InsufficientCashError";
  }
}

export type CancelOperationFailure =
  | "NOT_FOUND"
  /** Receipts are cancelled through `cancelPayment`, which also frees the fees. */
  | "IS_RECEIPT"
  | "ALREADY_REVERSED"
  /** The cash has to go back into a drawer, and no one is holding it open. */
  | "NO_DRAWER"
  | "INSUFFICIENT_CASH"
  /** Something downstream of the movement will not let go of it. */
  | "BLOCKED";

export type CancelOperationResult =
  | { ok: true; reversedIds: string[] }
  | { ok: false; reason: CancelOperationFailure };

/** One leg of what is being reversed, and where its mirror has to land. */
type ReversalLeg = {
  operationId: string;
  kind: string;
  method: string;
  amountCentimes: number;
  mirrorCashImpactCentimes: number;
  sessionId: string | null;
};

/**
 * Cancels a movement that is not a receipt: a salary, a supplier, a transfer.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Every other kind of mistake in this module had a way back and this one did
 * not. A salary paid twice, an amount typed with a zero too many, a transfer
 * sent to the wrong till — all of them were permanent, and a bursar with no way
 * to correct the books corrects them somewhere else, on paper, where nobody
 * can see it.
 *
 * ── The same reversal rule as a receipt ──────────────────────────────────────
 * The original stays POSTED and a mirror entry points back at it through
 * `reversesOperationId`. The money really did move on the day it moved; striking
 * the original out *and* posting a mirror would take it off the drawer twice.
 * `reversesOperationId` being unique is what stops the same movement being
 * cancelled twice.
 *
 * ── Money goes back where it came from ───────────────────────────────────────
 * A mirror that moves cash is posted into the open session of the *same till*
 * the original touched — that is the drawer the notes physically return to, and
 * a till nobody is holding cannot receive them. Both legs of a till-to-till
 * transfer are reversed together, each into its own drawer, because half a
 * reversed transfer is money that has vanished.
 *
 * `label` arrives already written in the reader's language, like every other
 * sentence this layer records — see `cancelPayment`.
 */
export async function cancelOperation(
  operationId: string,
  schoolId: string,
  cancelledById: string,
  label: string,
  onReversed?: (tx: TxClient, operationIds: string[]) => Promise<void>,
): Promise<CancelOperationResult> {
  const operation = await db.cashOperation.findFirst({
    where: { id: operationId, schoolId },
    select: {
      id: true,
      status: true,
      paymentId: true,
      transferGroupId: true,
      reversesOperationId: true,
      reversedBy: { select: { id: true } },
    },
  });
  if (!operation || operation.status !== "POSTED") {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (operation.paymentId) return { ok: false, reason: "IS_RECEIPT" };
  // A correcting entry is not itself correctable: undoing one is re-doing the
  // movement, which is a fresh operation somebody has to stand behind.
  if (operation.reversesOperationId) return { ok: false, reason: "NOT_FOUND" };
  if (operation.reversedBy) return { ok: false, reason: "ALREADY_REVERSED" };

  const originals = await db.cashOperation.findMany({
    where: operation.transferGroupId
      ? {
          schoolId,
          transferGroupId: operation.transferGroupId,
          status: "POSTED",
          reversedBy: { is: null },
        }
      : { id: operation.id },
    select: {
      id: true,
      kind: true,
      method: true,
      amountCentimes: true,
      cashImpactCentimes: true,
      cashSession: { select: { cashRegisterId: true } },
    },
  });

  const legs: ReversalLeg[] = [];

  for (const original of originals) {
    const mirrorCashImpactCentimes = -original.cashImpactCentimes;

    if (mirrorCashImpactCentimes === 0) {
      legs.push({
        operationId: original.id,
        kind: original.kind,
        method: original.method,
        amountCentimes: original.amountCentimes,
        mirrorCashImpactCentimes,
        sessionId: null,
      });
      continue;
    }

    // The drawer the notes go back into: the till that moved them, or — for a
    // cash movement that somehow reached the ledger without a session — the one
    // the person correcting it is holding.
    const registerId = original.cashSession?.cashRegisterId ?? null;
    const session = registerId
      ? await db.cashSession.findFirst({
          where: { cashRegisterId: registerId, status: "OPEN" },
          select: { id: true },
        })
      : await (async () => {
          const resolution = await resolveCashSession(schoolId, cancelledById);
          return resolution.state === "OPEN"
            ? { id: resolution.sessionId }
            : null;
        })();
    if (!session) return { ok: false, reason: "NO_DRAWER" };

    legs.push({
      operationId: original.id,
      kind: original.kind,
      method: original.method,
      amountCentimes: original.amountCentimes,
      mirrorCashImpactCentimes,
      sessionId: session.id,
    });
  }

  if (legs.length === 0) return { ok: false, reason: "NOT_FOUND" };

  /**
   * Refuses the whole reversal when a drawer will not cover its share.
   *
   * ── Why inside the transaction, and why accumulated ──────────────────────
   * The check used to run in the loop above, outside the transaction and once
   * per leg against the *full* balance. Two legs landing in the same drawer
   * were therefore each told there was room for them separately, so a
   * two-legged reversal could take out more than the till held; and any
   * movement posted between the check and the write was simply not seen.
   *
   * Summed per session and re-read here, so the legs are weighed against each
   * other and against the balance as it stands at the moment of writing.
   */
  async function refuseIfAnyDrawerShort(tx: TxClient): Promise<void> {
    const draw = new Map<string, number>();
    for (const leg of legs) {
      if (leg.sessionId === null || leg.mirrorCashImpactCentimes >= 0) continue;
      draw.set(
        leg.sessionId,
        (draw.get(leg.sessionId) ?? 0) - leg.mirrorCashImpactCentimes,
      );
    }

    for (const [sessionId, wanted] of draw) {
      const session = await tx.cashSession.findFirst({
        where: { id: sessionId, status: "OPEN" },
        select: {
          openingFloatCentimes: true,
          operations: {
            where: { status: "POSTED" },
            select: { cashImpactCentimes: true },
          },
        },
      });
      const available = session
        ? expectedDrawerTotal(
            session.openingFloatCentimes,
            session.operations.map((o) => o.cashImpactCentimes),
          )
        : 0;
      if (wanted > available) throw new InsufficientCashError();
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await refuseIfAnyDrawerShort(tx);

      for (const leg of legs) {
        await tx.cashOperation.create({
          data: {
            schoolId,
            cashSessionId: leg.sessionId,
            // The kind it corrects, never the opposite one: a reversed salary
            // booked as an encaissement would read as income the school earned.
            kind: leg.kind,
            method: leg.method,
            amountCentimes: leg.amountCentimes,
            cashImpactCentimes: leg.mirrorCashImpactCentimes,
            label,
            occurredAt: new Date(),
            status: "POSTED",
            reversesOperationId: leg.operationId,
            createdById: cancelledById,
          },
        });
      }

      // An outgoing cheque the school wrote is void once the movement is undone.
      await tx.cheque.updateMany({
        where: {
          operations: { some: { id: { in: legs.map((leg) => leg.operationId) } } },
          status: { in: [...OPEN_CHEQUE_STATUSES] },
        },
        data: { status: "CANCELLED", settledOn: new Date() },
      });

      await onReversed?.(
        tx,
        legs.map((leg) => leg.operationId),
      );
    });
  } catch (error) {
    if (error instanceof ReversalBlockedError) {
      return { ok: false, reason: "BLOCKED" };
    }
    if (error instanceof InsufficientCashError) {
      return { ok: false, reason: "INSUFFICIENT_CASH" };
    }
    // A second cancellation racing the first loses on `reversesOperationId`.
    if (isDuplicateKey(error)) return { ok: false, reason: "ALREADY_REVERSED" };
    throw error;
  }

  return { ok: true, reversedIds: legs.map((leg) => leg.operationId) };
}
