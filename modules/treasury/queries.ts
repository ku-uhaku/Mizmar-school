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
  notes: string | null;
  position: number;
  isActive: boolean;
  /** The cashier this drawer belongs to — see CashRegister.holderId. */
  holderId: string | null;
  holderName: string | null;
  /**
   * Shifts ever held on this till. Nonzero means it has history, which is what
   * decides whether it may be deleted or only retired — see the action.
   */
  sessionCount: number;
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
      holder: {
        select: { email: true, profile: { select: { firstName: true, lastName: true } } },
      },
      _count: { select: { sessions: true } },
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
      notes: register.notes,
      position: register.position,
      isActive: register.isActive,
      holderId: register.holderId,
      holderName: register.holder ? displayName(register.holder) : null,
      sessionCount: register._count.sessions,
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
 * The caller's own open session, if they have one.
 *
 * Scoped to the *user*, not merely to the school. It used to return whichever
 * session happened to be open anywhere in the school, which is what let a
 * secretary's receipt land in the bursar's drawer — and made the evening count
 * unanswerable for both of them. Now "my caisse" has one answer: the shift I
 * opened, or the one on the till I hold.
 *
 * Stale sessions are *not* filtered out here. This is a read and the screens
 * need to be able to say "yours is yesterday's" — closing it is the writing
 * path's job, in `resolveCashSession`.
 */
export async function findOpenSession(context: AuthContext) {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return null;

  return db.cashSession.findFirst({
    where: {
      status: "OPEN",
      cashRegister: { schoolId },
      OR: [
        { openedById: context.user.id },
        { cashRegister: { holderId: context.user.id } },
      ],
    },
    include: {
      cashRegister: { select: { id: true, name: true, code: true } },
      openedBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { openedAt: "desc" },
  });
}

export type CashierChoice = { id: string; label: string };

/**
 * Who may be given a till.
 *
 * The school's own members, not the whole organisation: a drawer is held at a
 * school, and offering somebody from the sister school would be offering an id
 * the action then refuses. The same clause is re-checked on write — see
 * `saveCashRegisterAction` — so a filtered dropdown is a convenience and never
 * the guard.
 */
export async function listCashierChoices(
  context: AuthContext,
): Promise<CashierChoice[]> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return [];

  const users = await db.user.findMany({
    where: { isActive: true, memberships: { some: { schoolId } } },
    orderBy: [{ profile: { lastName: "asc" } }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });

  return users.map((user) => ({ id: user.id, label: displayName(user) }));
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
  /** Closed by the day boundary rather than counted — see CashSession. */
  wasAutoClosed: boolean;
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
    wasAutoClosed: session.wasAutoClosed,
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
  subcategoryName: string | null;
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
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
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
    categoryName: operation.category?.name ?? null,
    subcategoryName: operation.subcategory?.name ?? null,
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
      bank: { select: { name: true } },
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
    // The declared bank wins over the free text — the relation is the one a
    // report can group by, and the text is only there for a bank we have not
    // declared. See Cheque.bankId.
    bankName: cheque.bank?.name ?? cheque.bankName,
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

export type SubcategoryOption = { id: string; code: string; name: string };

export type CategoryOption = {
  id: string;
  code: string;
  name: string;
  /** "IN" | "OUT" | "BOTH" — see modules/treasury/enums.ts. */
  kind: string;
  subcategories: SubcategoryOption[];
};

export type MotifOption = {
  id: string;
  code: string;
  name: string;
  /** Null for a motif offered under every rubrique — see OperationMotif. */
  categoryId: string | null;
};

export type BankOption = { id: string; code: string; name: string };

/**
 * The chart the caisse posts against: rubriques with their sub-rubriques
 * nested, so the form can narrow the second select from the first without a
 * round trip.
 *
 * `side` filters to what the screen may actually offer — a décaissement must
 * not be postable under an income-only rubrique. Inactive rows are dropped at
 * both levels: a retired rubrique stays on the operations that already used it
 * and disappears from the picker, which is what retiring one means.
 */
export async function listOperationCategories(
  context: AuthContext,
  side?: "IN" | "OUT",
): Promise<CategoryOption[]> {
  const categories = await db.operationCategory.findMany({
    where: {
      ...schoolScope(context),
      isActive: true,
      ...(side ? { kind: { in: [side, "BOTH"] } } : {}),
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      subcategories: {
        where: { isActive: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });
  return categories;
}

export async function listOperationMotifs(
  context: AuthContext,
): Promise<MotifOption[]> {
  return db.operationMotif.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, categoryId: true },
  });
}

export async function listBanks(context: AuthContext): Promise<BankOption[]> {
  return db.bank.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true },
  });
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

/**
 * One charge of the year — scolarité, bus, cantine — and where the pupil stands
 * against it on its own.
 *
 * The totals above it answer "does this family owe anything"; this answers "for
 * what", which is the question actually asked at the desk. A parent settling the
 * bus in cash wants to hear the bus figure, and a secretary reading them one
 * grand total has to open the fee grid and add up a row to find it.
 */
export type ServiceStanding = {
  feeTypeId: string;
  feeTypeName: string;
  chargedCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  overdueCentimes: number;
};

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
  /**
   * The same figures split per charge, in the order the fee grid lists them, so
   * the table on the payment tab and the grid on the fees tab read the same way
   * down the page.
   */
  byService: ServiceStanding[];
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
    byService: [],
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
      // `position` is what orders the breakdown — the same column the fee grid
      // orders its rows by, so the two screens cannot disagree.
      feeType: { select: { id: true, name: true, position: true } },
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

  // Accumulated in the same pass as the totals, so a charge's figures are summed
  // from exactly the lines the grand total was summed from — a second query
  // filtered differently is how the parts stop adding up to the whole.
  const services = new Map<string, ServiceStanding & { position: number }>();

  for (const line of lines) {
    const paid = sumCentimes(
      line.allocations.map((allocation) => allocation.amountCentimes),
    );
    const outstanding = outstandingOf(line.amountCentimes, paid);
    const overdue =
      outstanding > 0 && line.dueDate <= endOfToday ? outstanding : 0;

    chargedCentimes += line.amountCentimes;
    paidCentimes += paid;
    outstandingCentimes += outstanding;
    overdueCentimes += overdue;
    if (outstanding === 0) settledLines += 1;

    const service = services.get(line.feeType.id) ?? {
      feeTypeId: line.feeType.id,
      feeTypeName: line.feeType.name,
      position: line.feeType.position,
      chargedCentimes: 0,
      paidCentimes: 0,
      outstandingCentimes: 0,
      overdueCentimes: 0,
    };
    service.chargedCentimes += line.amountCentimes;
    service.paidCentimes += paid;
    service.outstandingCentimes += outstanding;
    service.overdueCentimes += overdue;
    services.set(line.feeType.id, service);

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
    byService: [...services.values()]
      .sort(
        (a, b) =>
          a.position - b.position || a.feeTypeName.localeCompare(b.feeTypeName),
      )
      .map((service) => ({
        feeTypeId: service.feeTypeId,
        feeTypeName: service.feeTypeName,
        chargedCentimes: service.chargedCentimes,
        paidCentimes: service.paidCentimes,
        outstandingCentimes: service.outstandingCentimes,
        overdueCentimes: service.overdueCentimes,
      })),
  };
}

export type SiblingStanding = {
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  standing: PaymentStanding;
};

export type FamilyStanding = {
  familyId: string;
  familyName: string;
  familyCode: string;
  /** The other children of the dossier — never the pupil being looked at. */
  siblings: SiblingStanding[];
  /** The household's totals, this pupil included. */
  chargedCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  overdueCentimes: number;
};

/**
 * The rest of the household's standing, for the pupil's payment tab.
 *
 * Loaded beside `studentPaymentStanding` rather than folded into it, because
 * the two answer different questions and the tab shows the fratrie only when
 * asked. Keeping them apart means a secretary who never ticks the box never
 * pays for the extra reads.
 *
 * Returns null when the child has no dossier familial — there is no household
 * to total — and the siblings list excludes the pupil themselves, whose figures
 * the tab already has. The totals do include them: "what does this family owe"
 * is the question a parent at the desk actually asks.
 */
export async function familyPaymentStanding(
  context: AuthContext,
  studentId: string,
  familyId: string,
): Promise<FamilyStanding | null> {
  const schoolId = context.currentSchool?.id;
  const schoolYearId = context.currentSchoolYear?.id;
  if (!schoolId || !schoolYearId) return null;

  const family = await db.family.findFirst({
    // Scoped by the school in context, never by the id from the request.
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
            select: { schoolClass: { select: { code: true } } },
          },
        },
      },
    },
  });

  if (!family) return null;

  // One standing per child, through the same function the pupil's own card
  // uses — so a sibling's figure can never disagree with their own file.
  const standings = await Promise.all(
    family.children.map(async (child) => ({
      studentId: child.id,
      studentName: `${child.firstName} ${child.lastName}`,
      studentCode: child.code,
      className: child.enrollments[0]?.schoolClass?.code ?? null,
      standing: await studentPaymentStanding(context, child.id),
    })),
  );

  const total = (pick: (standing: PaymentStanding) => number) =>
    sumCentimes(standings.map((entry) => pick(entry.standing)));

  return {
    familyId: family.id,
    familyCode: family.code,
    familyName: family.name,
    siblings: standings.filter((entry) => entry.studentId !== studentId),
    chargedCentimes: total((standing) => standing.chargedCentimes),
    paidCentimes: total((standing) => standing.paidCentimes),
    outstandingCentimes: total((standing) => standing.outstandingCentimes),
    overdueCentimes: total((standing) => standing.overdueCentimes),
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

/**
 * The receipts that settled *this pupil's* échéancier, for their own file.
 *
 * Matched through the allocations rather than through the household: a receipt
 * made out to a family may pay for one child and not another — that is the whole
 * point of allocating line by line — so listing every receipt the family ever
 * wrote would show a secretary money that never touched the child in front of
 * them. The fratrie's receipts are one click away on the siblings' own files.
 *
 * Cancelled receipts are included, like the caisse ledger, so a reprint of a
 * voided receipt is still reachable from where it was taken.
 */
export async function listStudentPayments(
  context: AuthContext,
  studentId: string,
  limit = 50,
): Promise<PaymentRow[]> {
  const payments = await db.payment.findMany({
    where: {
      ...schoolScope(context),
      allocations: {
        some: { enrollmentFee: { enrollment: { studentId } } },
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      family: { select: { name: true } },
      createdBy: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
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

// ── The printed receipt ──────────────────────────────────────────────────────

export type ReceiptAllocation = {
  studentName: string;
  studentCode: string;
  className: string | null;
  feeTypeName: string;
  dueDate: string;
  amountCentimes: number;
};

export type ReceiptTender = {
  method: string;
  amountCentimes: number;
  reference: string | null;
  bankName: string | null;
  chequeNumber: string | null;
  chequeDueOn: string | null;
};

export type Receipt = {
  id: string;
  code: string;
  status: string;
  paidAt: string;
  totalCentimes: number;
  notes: string | null;
  familyName: string | null;
  familyCode: string | null;
  createdByName: string;
  registerName: string | null;
  /** What the money settled, one row per schedule line. */
  allocations: ReceiptAllocation[];
  tenders: ReceiptTender[];
};

/**
 * One receipt, with everything the paper version has to name.
 *
 * A receipt is quoted back at the school months later — "you took 3 000 from me
 * in November" — so it prints *what the money settled*, line by line, not just
 * a total. Cancelled receipts stay readable on purpose: somebody holding a
 * printed copy of one needs to be able to look it up and be told it was undone.
 */
export async function findReceipt(
  context: AuthContext,
  paymentId: string,
): Promise<Receipt | null> {
  const payment = await db.payment.findFirst({
    // Scoped to the school in context, never by the id alone.
    where: { id: paymentId, ...schoolScope(context) },
    include: {
      family: { select: { name: true, code: true } },
      createdBy: {
        select: { email: true, profile: { select: { firstName: true, lastName: true } } },
      },
      cashSession: { select: { cashRegister: { select: { name: true } } } },
      tenders: { include: { cheque: true } },
      allocations: {
        orderBy: [{ enrollmentFee: { dueDate: "asc" } }],
        include: {
          enrollmentFee: {
            include: {
              feeType: { select: { name: true } },
              enrollment: {
                include: {
                  schoolClass: { select: { code: true } },
                  student: {
                    select: { code: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) return null;

  return {
    id: payment.id,
    code: payment.code,
    status: payment.status,
    paidAt: payment.paidAt.toISOString(),
    totalCentimes: payment.totalCentimes,
    notes: payment.notes,
    familyName: payment.family?.name ?? null,
    familyCode: payment.family?.code ?? null,
    createdByName: displayName(payment.createdBy),
    registerName: payment.cashSession?.cashRegister.name ?? null,
    allocations: payment.allocations.map((allocation) => ({
      studentName: `${allocation.enrollmentFee.enrollment.student.firstName} ${allocation.enrollmentFee.enrollment.student.lastName}`,
      studentCode: allocation.enrollmentFee.enrollment.student.code,
      className: allocation.enrollmentFee.enrollment.schoolClass?.code ?? null,
      feeTypeName: allocation.enrollmentFee.feeType.name,
      dueDate: allocation.enrollmentFee.dueDate.toISOString(),
      amountCentimes: allocation.amountCentimes,
    })),
    tenders: payment.tenders.map((tender) => ({
      method: tender.method,
      amountCentimes: tender.amountCentimes,
      reference: tender.reference,
      bankName: tender.bankName,
      chequeNumber: tender.cheque?.number ?? null,
      chequeDueOn: tender.cheque?.dueOn?.toISOString() ?? null,
    })),
  };
}

/**
 * What was collected each month of the year, for the dashboard's trend.
 *
 * Cancelled receipts are excluded — a ledger shows them struck through because
 * it must reconcile, but a trend line asking "how is collection going" would be
 * overstated by money that was given back.
 *
 * Months with no receipts are returned as zeros rather than omitted: a gap in a
 * trend line reads as "no data", and "nobody paid in February" is a fact worth
 * seeing. The series runs from the year's start to whichever is earlier, its end
 * or today, so a year in progress does not trail off through months that have
 * not happened.
 */
export async function collectionsByMonth(
  context: AuthContext,
): Promise<{ label: string; value: number }[]> {
  const yearId = context.currentSchoolYear?.id;
  const schoolId = context.currentSchool?.id;
  if (!yearId || !schoolId) return [];

  const year = await db.schoolYear.findUnique({
    where: { id: yearId },
    select: { startDate: true, endDate: true },
  });
  if (!year) return [];

  const payments = await db.payment.findMany({
    where: {
      schoolId,
      schoolYearId: yearId,
      status: { not: "CANCELLED" },
    },
    select: { paidAt: true, totalCentimes: true },
  });

  const totals = new Map<string, number>();
  for (const payment of payments) {
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    totals.set(key, (totals.get(key) ?? 0) + payment.totalCentimes);
  }

  const last = year.endDate < new Date() ? year.endDate : new Date();
  const series: { label: string; value: number }[] = [];

  const cursor = new Date(
    year.startDate.getFullYear(),
    year.startDate.getMonth(),
    1,
  );
  // A guard rather than a bare `while`: a year entered as spanning a decade
  // would otherwise build a series nobody could read.
  for (let step = 0; step < 24 && cursor <= last; step += 1) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    series.push({
      // `YYYY-MM` — the caller formats it, because only it knows the locale.
      label: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      value: totals.get(key) ?? 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return series;
}

/**
 * The school's whole year, split into what has been paid and what has not.
 *
 * Two segments and not three: "overdue" is a slice of outstanding, and showing
 * all three would make the parts sum to more than the whole. The overdue figure
 * is carried alongside instead, for the caller to state in words.
 */
export async function schoolCollectionStanding(context: AuthContext): Promise<{
  chargedCentimes: number;
  paidCentimes: number;
  outstandingCentimes: number;
  overdueCentimes: number;
}> {
  const yearId = context.currentSchoolYear?.id;
  const schoolId = context.currentSchool?.id;
  if (!yearId || !schoolId) {
    return {
      chargedCentimes: 0,
      paidCentimes: 0,
      outstandingCentimes: 0,
      overdueCentimes: 0,
    };
  }

  const lines = await db.enrollmentFee.findMany({
    where: {
      enrollment: {
        schoolYearId: yearId,
        student: { schoolId },
      },
    },
    select: {
      amountCentimes: true,
      dueDate: true,
      allocations: {
        where: { payment: { status: { not: "CANCELLED" } } },
        select: { amountCentimes: true },
      },
    },
  });

  const today = new Date();
  let charged = 0;
  let paid = 0;
  let overdue = 0;

  for (const line of lines) {
    const settled = line.allocations.reduce(
      (total, allocation) => total + allocation.amountCentimes,
      0,
    );
    charged += line.amountCentimes;
    paid += settled;

    const owing = line.amountCentimes - settled;
    if (owing > 0 && line.dueDate < today) overdue += owing;
  }

  return {
    chargedCentimes: charged,
    paidCentimes: paid,
    outstandingCentimes: Math.max(0, charged - paid),
    overdueCentimes: overdue,
  };
}
