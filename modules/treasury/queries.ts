import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { outstandingOf, sumCentimes } from "@/modules/treasury/enums";

/**
 * Reads for the treasury module.
 *
 * Every read is confined to `context.currentSchool` and never to a school id
 * from the request — money is the last place a crafted id should be able to
 * reach across a tenant boundary. The list screens and the forms go through the
 * same clauses, which is what stops the encaissement screen offering a line the
 * ledger would then refuse.
 */

/** No school selected: match nothing rather than everything. */
function schoolScope(context: AuthContext) {
  return { schoolId: context.currentSchool?.id ?? "__none__" };
}

/** Posted rows only — cancelled movements stay in the ledger but count nowhere. */
const POSTED = { status: "POSTED" } as const;

export type RegisterRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  isActive: boolean;
  /** The open session, when there is one. This is what "la caisse est ouverte" means. */
  openSession: {
    id: string;
    openedAt: string;
    openedByName: string;
    openingFloatCentimes: number;
    /** Float plus every posted cash movement since — the live drawer figure. */
    expectedCentimes: number;
    operationCount: number;
  } | null;
};

/**
 * The tills, each with its open session if it has one.
 *
 * The expected balance is computed here rather than on the client because it is
 * the number a cashier will be held to: it must come from the ledger itself, in
 * one place, so the figure on the dashboard and the figure the closing screen
 * checks against can never be two different sums.
 */
export async function listRegisters(
  context: AuthContext,
): Promise<RegisterRow[]> {
  const registers = await db.cashRegister.findMany({
    where: schoolScope(context),
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      sessions: {
        where: { status: "OPEN" },
        include: {
          openedBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
          operations: {
            where: POSTED,
            select: { cashImpactCentimes: true },
          },
        },
      },
    },
  });

  return registers.map((register) => {
    const session = register.sessions[0] ?? null;

    return {
      id: register.id,
      code: register.code,
      name: register.name,
      nameAr: register.nameAr,
      isActive: register.isActive,
      openSession: session
        ? {
            id: session.id,
            openedAt: session.openedAt.toISOString(),
            openedByName: displayName(session.openedBy),
            openingFloatCentimes: session.openingFloatCentimes,
            expectedCentimes:
              session.openingFloatCentimes +
              sumCentimes(
                session.operations.map(
                  (operation) => operation.cashImpactCentimes,
                ),
              ),
            operationCount: session.operations.length,
          }
        : null,
    };
  });
}

/**
 * The session a cashier is currently posting into, if any.
 *
 * Deliberately "any open session in this school" rather than "mine": a small
 * school has one drawer and two people who take money at it, and requiring each
 * to open their own would make the count meaningless.
 */
export async function findOpenSession(context: AuthContext) {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return null;

  return db.cashSession.findFirst({
    where: { status: "OPEN", cashRegister: { schoolId } },
    include: {
      cashRegister: { select: { id: true, name: true, code: true } },
      openedBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { openedAt: "desc" },
  });
}

export type SessionRow = {
  id: string;
  registerName: string;
  openedAt: string;
  openedByName: string;
  closedAt: string | null;
  closedByName: string | null;
  openingFloatCentimes: number;
  countedCentimes: number | null;
  expectedCentimes: number | null;
  varianceCentimes: number | null;
  status: string;
  operationCount: number;
};

export async function listSessions(
  context: AuthContext,
  limit = 30,
): Promise<SessionRow[]> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return [];

  const sessions = await db.cashSession.findMany({
    where: { cashRegister: { schoolId } },
    orderBy: { openedAt: "desc" },
    take: limit,
    include: {
      cashRegister: { select: { name: true } },
      openedBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      closedBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      _count: { select: { operations: true } },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    registerName: session.cashRegister.name,
    openedAt: session.openedAt.toISOString(),
    openedByName: displayName(session.openedBy),
    closedAt: session.closedAt?.toISOString() ?? null,
    closedByName: session.closedBy
      ? displayName(session.closedBy)
      : null,
    openingFloatCentimes: session.openingFloatCentimes,
    countedCentimes: session.countedCentimes,
    expectedCentimes: session.expectedCentimes,
    varianceCentimes: session.varianceCentimes,
    status: session.status,
    operationCount: session._count.operations,
  }));
}

export type OperationRow = {
  id: string;
  kind: string;
  method: string;
  amountCentimes: number;
  cashImpactCentimes: number;
  label: string;
  reference: string | null;
  occurredAt: string;
  status: string;
  registerName: string | null;
  categoryName: string | null;
  beneficiaryName: string | null;
  createdByName: string;
  /** Set when this row is a receipt, so the ledger can link through to it. */
  paymentId: string | null;
  paymentCode: string | null;
  /** True when this row is itself a correcting entry. */
  isReversal: boolean;
  /** True when a later correcting entry has undone this one. */
  isReversed: boolean;
};

export type OperationFilters = {
  kind?: string;
  status?: string;
  sessionId?: string;
};

/** The Opérations ledger: everything that moved, newest first. */
export async function listOperations(
  context: AuthContext,
  filters: OperationFilters = {},
  limit = 200,
): Promise<OperationRow[]> {
  const operations = await db.cashOperation.findMany({
    where: {
      ...schoolScope(context),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sessionId ? { cashSessionId: filters.sessionId } : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      cashSession: { select: { cashRegister: { select: { name: true } } } },
      expenseCategory: { select: { name: true } },
      createdBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      payment: { select: { id: true, code: true } },
      reversedBy: { select: { id: true } },
    },
  });

  return operations.map((operation) => ({
    id: operation.id,
    kind: operation.kind,
    method: operation.method,
    amountCentimes: operation.amountCentimes,
    cashImpactCentimes: operation.cashImpactCentimes,
    label: operation.label,
    reference: operation.reference,
    occurredAt: operation.occurredAt.toISOString(),
    status: operation.status,
    registerName: operation.cashSession?.cashRegister.name ?? null,
    categoryName: operation.expenseCategory?.name ?? null,
    beneficiaryName: operation.beneficiaryName,
    createdByName: displayName(operation.createdBy),
    paymentId: operation.payment?.id ?? null,
    paymentCode: operation.payment?.code ?? null,
    isReversal: operation.reversesOperationId !== null,
    isReversed: operation.reversedBy !== null,
  }));
}

export type ChequeRow = {
  id: string;
  direction: string;
  number: string;
  bankName: string | null;
  drawerName: string | null;
  amountCentimes: number;
  issuedOn: string | null;
  dueOn: string | null;
  status: string;
  depositedOn: string | null;
  settledOn: string | null;
  bounceReason: string | null;
  /** The receipt it settled, when it came in as a payment tender. */
  paymentCode: string | null;
  familyName: string | null;
};

/** Suivi Chèques: every cheque, soonest due first among those still open. */
export async function listCheques(
  context: AuthContext,
  status?: string,
): Promise<ChequeRow[]> {
  const cheques = await db.cheque.findMany({
    where: {
      ...schoolScope(context),
      ...(status ? { status } : {}),
    },
    orderBy: [{ dueOn: "asc" }, { createdAt: "desc" }],
    include: {
      tender: {
        select: {
          payment: {
            select: { code: true, family: { select: { name: true } } },
          },
        },
      },
    },
  });

  return cheques.map((cheque) => ({
    id: cheque.id,
    direction: cheque.direction,
    number: cheque.number,
    bankName: cheque.bankName,
    drawerName: cheque.drawerName,
    amountCentimes: cheque.amountCentimes,
    issuedOn: cheque.issuedOn?.toISOString() ?? null,
    dueOn: cheque.dueOn?.toISOString() ?? null,
    status: cheque.status,
    depositedOn: cheque.depositedOn?.toISOString() ?? null,
    settledOn: cheque.settledOn?.toISOString() ?? null,
    bounceReason: cheque.bounceReason,
    paymentCode: cheque.tender?.payment.code ?? null,
    familyName: cheque.tender?.payment.family?.name ?? null,
  }));
}

export type ExpenseCategoryOption = {
  id: string;
  code: string;
  name: string;
};

export async function listExpenseCategories(
  context: AuthContext,
): Promise<ExpenseCategoryOption[]> {
  const categories = await db.expenseCategory.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true },
  });
  return categories;
}

// ── The encaissement screen ──────────────────────────────────────────────────

export type PayableLine = {
  id: string;
  feeTypeName: string;
  periodIndex: number;
  dueDate: string;
  dueMonth: number;
  dueYear: number;
  amountCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
};

export type PayableChild = {
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  lines: PayableLine[];
  outstandingCentimes: number;
};

export type PayableFamily = {
  familyId: string;
  familyCode: string;
  familyName: string;
  children: PayableChild[];
  outstandingCentimes: number;
};

/**
 * Everything a household still owes for the year in context, child by child.
 *
 * This is the read the encaissement screen is built on, and the reason it
 * returns the *family* rather than a pupil: a parent with three children pays
 * once, and the screen has to be able to put all three of their schedules in
 * front of them at the same time. Passing a single pupil would make paying for a
 * fratrie three transactions again.
 *
 * `paidCentimes` is summed from posted allocations only — a cancelled receipt
 * must put the money back on the line it was settling, or a family would appear
 * to have paid for a receipt that no longer exists.
 */
export async function findPayableFamily(
  context: AuthContext,
  familyId: string,
): Promise<PayableFamily | null> {
  const schoolId = context.currentSchool?.id;
  const schoolYearId = context.currentSchoolYear?.id;
  if (!schoolId || !schoolYearId) return null;

  const family = await db.family.findFirst({
    // Scoped by the school in context, never by the id alone.
    where: { id: familyId, schoolId },
    select: {
      id: true,
      code: true,
      name: true,
      children: {
        where: { isActive: true },
        orderBy: [{ firstName: "asc" }],
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          enrollments: {
            where: { schoolYearId },
            select: {
              schoolClass: { select: { code: true } },
              fees: {
                // WAIVED and CANCELLED lines are already out of the reckoning.
                where: { status: "DUE" },
                orderBy: [{ dueDate: "asc" }, { periodIndex: "asc" }],
                select: {
                  id: true,
                  periodIndex: true,
                  dueDate: true,
                  dueMonth: true,
                  dueYear: true,
                  amountCentimes: true,
                  feeType: { select: { name: true } },
                  allocations: {
                    where: { payment: { status: "POSTED" } },
                    select: { amountCentimes: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!family) return null;

  const children: PayableChild[] = family.children.map((student) => {
    const enrolment = student.enrollments[0] ?? null;

    const lines: PayableLine[] = (enrolment?.fees ?? []).map((fee) => {
      const paidCentimes = sumCentimes(
        fee.allocations.map((allocation) => allocation.amountCentimes),
      );
      return {
        id: fee.id,
        feeTypeName: fee.feeType.name,
        periodIndex: fee.periodIndex,
        dueDate: fee.dueDate.toISOString(),
        dueMonth: fee.dueMonth,
        dueYear: fee.dueYear,
        amountCentimes: fee.amountCentimes,
        paidCentimes,
        outstandingCentimes: outstandingOf(fee.amountCentimes, paidCentimes),
      };
    });

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      studentCode: student.code,
      className: enrolment?.schoolClass?.code ?? null,
      lines,
      outstandingCentimes: sumCentimes(
        lines.map((line) => line.outstandingCentimes),
      ),
    };
  });

  return {
    familyId: family.id,
    familyCode: family.code,
    familyName: family.name,
    children,
    outstandingCentimes: sumCentimes(
      children.map((child) => child.outstandingCentimes),
    ),
  };
}

export type PaymentStanding = {
  /** What the year's schedule charges this pupil, less waived and cancelled lines. */
  chargedCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  /**
   * The part of `outstandingCentimes` whose due date has already passed.
   *
   * This, not the outstanding total, is what says a family is behind. A pupil
   * billed over nine instalments owes most of the year in September and is not
   * late for any of it — reporting that as arrears would put every family in the
   * school on the chasing list on the first day of term.
   */
  overdueCentimes: number;
  /** Nothing due has gone unpaid. True before anything is charged at all. */
  isUpToDate: boolean;
  /** How many schedule lines are fully settled, out of how many are payable. */
  settledLines: number;
  totalLines: number;
  lastPaidAt: string | null;
};

/**
 * Where one pupil stands against their échéancier, for the year in context.
 *
 * Lives here rather than in the students module because it is summed from this
 * module's tables — `students` reaches it through this function, exactly as the
 * dashboard composes each module's own counts instead of re-deriving them.
 */
export async function studentPaymentStanding(
  context: AuthContext,
  studentId: string,
): Promise<PaymentStanding> {
  const empty: PaymentStanding = {
    chargedCentimes: 0,
    paidCentimes: 0,
    outstandingCentimes: 0,
    overdueCentimes: 0,
    isUpToDate: true,
    settledLines: 0,
    totalLines: 0,
    lastPaidAt: null,
  };

  const schoolId = context.currentSchool?.id;
  const schoolYearId = context.currentSchoolYear?.id;
  if (!schoolId || !schoolYearId) return empty;

  const lines = await db.enrollmentFee.findMany({
    where: {
      status: "DUE",
      enrollment: {
        studentId,
        schoolYearId,
        // Scoped by the school in context, never by the pupil id alone.
        student: { schoolId },
      },
    },
    select: {
      amountCentimes: true,
      dueDate: true,
      allocations: {
        where: { payment: { status: "POSTED" } },
        select: { amountCentimes: true, payment: { select: { paidAt: true } } },
      },
    },
  });

  if (lines.length === 0) return empty;

  // End of today: an instalment falling due today is not late yet.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  let chargedCentimes = 0;
  let paidCentimes = 0;
  let outstandingCentimes = 0;
  let overdueCentimes = 0;
  let settledLines = 0;
  let lastPaidAt: Date | null = null;

  for (const line of lines) {
    const paid = sumCentimes(
      line.allocations.map((allocation) => allocation.amountCentimes),
    );
    const outstanding = outstandingOf(line.amountCentimes, paid);

    chargedCentimes += line.amountCentimes;
    paidCentimes += paid;
    outstandingCentimes += outstanding;
    if (outstanding === 0) settledLines += 1;
    if (outstanding > 0 && line.dueDate <= endOfToday) {
      overdueCentimes += outstanding;
    }

    for (const allocation of line.allocations) {
      if (!lastPaidAt || allocation.payment.paidAt > lastPaidAt) {
        lastPaidAt = allocation.payment.paidAt;
      }
    }
  }

  return {
    chargedCentimes,
    paidCentimes,
    outstandingCentimes,
    overdueCentimes,
    isUpToDate: overdueCentimes === 0,
    settledLines,
    totalLines: lines.length,
    lastPaidAt: lastPaidAt?.toISOString() ?? null,
  };
}

export type FamilyOption = {
  id: string;
  code: string;
  name: string;
  childCount: number;
};

/** The family picker on the encaissement screen. */
export async function listFamilyOptions(
  context: AuthContext,
): Promise<FamilyOption[]> {
  const families = await db.family.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { children: true } },
    },
  });

  return families.map((family) => ({
    id: family.id,
    code: family.code,
    name: family.name,
    childCount: family._count.children,
  }));
}

export type PaymentRow = {
  id: string;
  code: string;
  familyName: string | null;
  paidAt: string;
  totalCentimes: number;
  status: string;
  methods: string[];
  createdByName: string;
  allocationCount: number;
};

export async function listPayments(
  context: AuthContext,
  limit = 100,
): Promise<PaymentRow[]> {
  const payments = await db.payment.findMany({
    where: schoolScope(context),
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      family: { select: { name: true } },
      createdBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      tenders: { select: { method: true } },
      _count: { select: { allocations: true } },
    },
  });

  return payments.map((payment) => ({
    id: payment.id,
    code: payment.code,
    familyName: payment.family?.name ?? null,
    paidAt: payment.paidAt.toISOString(),
    totalCentimes: payment.totalCentimes,
    status: payment.status,
    methods: Array.from(new Set(payment.tenders.map((t) => t.method))),
    createdByName: displayName(payment.createdBy),
    allocationCount: payment._count.allocations,
  }));
}

export type TreasurySummary = {
  /** Cash the school's open drawers should currently hold. */
  drawerCentimes: number;
  openRegisterCount: number;
  collectedTodayCentimes: number;
  disbursedTodayCentimes: number;
  chequesPendingCount: number;
  chequesPendingCentimes: number;
  chequesBouncedCount: number;
};

/** The figures on the caisse landing page. */
export async function treasurySummary(
  context: AuthContext,
): Promise<TreasurySummary> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) {
    return {
      drawerCentimes: 0,
      openRegisterCount: 0,
      collectedTodayCentimes: 0,
      disbursedTodayCentimes: 0,
      chequesPendingCount: 0,
      chequesPendingCentimes: 0,
      chequesBouncedCount: 0,
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [openSessions, todayOperations, pendingCheques, bouncedCount] =
    await Promise.all([
      db.cashSession.findMany({
        where: { status: "OPEN", cashRegister: { schoolId } },
        select: {
          openingFloatCentimes: true,
          operations: {
            where: POSTED,
            select: { cashImpactCentimes: true },
          },
        },
      }),
      db.cashOperation.findMany({
        where: { schoolId, ...POSTED, occurredAt: { gte: startOfDay } },
        select: {
          kind: true,
          amountCentimes: true,
          reversesOperationId: true,
        },
      }),
      db.cheque.findMany({
        where: {
          schoolId,
          direction: "INCOMING",
          status: { in: ["PENDING", "DEPOSITED"] },
        },
        select: { amountCentimes: true },
      }),
      db.cheque.count({
        where: { schoolId, status: "BOUNCED" },
      }),
    ]);

  const drawerCentimes = sumCentimes(
    openSessions.map(
      (session) =>
        session.openingFloatCentimes +
        sumCentimes(session.operations.map((o) => o.cashImpactCentimes)),
    ),
  );

  /**
   * Nets a day's figure: what was taken, less what was reversed the same day.
   *
   * A reversing entry carries the kind it corrects, so a receipt cancelled an
   * hour after it was written must come *off* the day's takings rather than be
   * added to them — which is what summing `amountCentimes` blindly would do,
   * reporting double the money on the worst possible day to be wrong about it.
   */
  const netToday = (kind: string) =>
    sumCentimes(
      todayOperations
        .filter((operation) => operation.kind === kind)
        .map((operation) =>
          operation.reversesOperationId === null
            ? operation.amountCentimes
            : -operation.amountCentimes,
        ),
    );

  return {
    drawerCentimes,
    openRegisterCount: openSessions.length,
    collectedTodayCentimes: netToday("ENCAISSEMENT"),
    disbursedTodayCentimes: netToday("DECAISSEMENT"),
    chequesPendingCount: pendingCheques.length,
    chequesPendingCentimes: sumCentimes(
      pendingCheques.map((cheque) => cheque.amountCentimes),
    ),
    chequesBouncedCount: bouncedCount,
  };
}
