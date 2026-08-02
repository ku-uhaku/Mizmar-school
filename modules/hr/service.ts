import "server-only";

import { db } from "@/lib/db";
import { formatEntityCode } from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import {
  activeContractKey,
  advanceInstalment,
  isAdvanceDecidable,
  isAdvancePayable,
  netSalary,
  outstandingAdvance,
  OWED_ADVANCE_STATUSES,
  staffName,
  startOfDay,
  type ContractStatus,
  type SalaryGains,
  type SalaryDeductions,
} from "@/modules/hr/enums";
import { recordDisbursement } from "@/modules/treasury/service";
import type { TenderMethod } from "@/modules/treasury/enums";

/**
 * Writes and data invariants for the RH module.
 *
 * Four of them matter, and every one is something the database cannot say:
 *
 *   1. **An employee holds one live contract.** Enforced by the `activeKey`
 *      unique index, which only `setContractStatus` and `saveContract` write —
 *      never by hand. Activating a new contract ends the old one in the same
 *      transaction, so there is no instant in which somebody has two or none.
 *   2. **A bulletin's net equals its own lines.** `netSalary` is the only thing
 *      that computes it, here and in the form's preview alike.
 *   3. **A bulletin is paid at most once.** The décaissement is written inside
 *      the transaction that marks the payslip PAID, and the unique
 *      `cashOperationId` refuses a second one — so a double-click cannot pay
 *      somebody twice for September.
 *   4. **A register mark lands on a day, not a moment.** Every write normalises
 *      through `startOfDay`, which is what makes the unique index bite.
 */

// ── Matricules ───────────────────────────────────────────────────────────────

/**
 * Allocates the next matricule for a school.
 *
 * Counts what exists rather than keeping a counter, exactly as
 * `nextPaymentCode` does in the caisse: the volume is dozens a year, and a
 * sequence table that can drift out of step with its rows is worse than a scan.
 * The unique index on `[schoolId, code]` is what actually guarantees the number
 * is free — this only has to make a collision rare.
 */
export async function allocateStaffCode(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { staffCodeFormat } = await loadSchoolSettings(schoolId);
  const used = await db.staff.count({ where: { schoolId } });
  return formatEntityCode(staffCodeFormat, year, used + 1);
}

// ── Contracts ────────────────────────────────────────────────────────────────

export type ContractInput = {
  staffId: string;
  kind: string;
  startsOn: Date;
  endsOn: Date | null;
  trialEndsOn: Date | null;
  baseSalaryCentimes: number;
  weeklyHours: number | null;
  status: ContractStatus;
  notes: string | null;
};

/**
 * Writes a contract, ending whatever it replaces.
 *
 * ── Why the old one is ended here ───────────────────────────────────────────
 * The unique index would simply refuse a second live contract, which as an
 * error message is useless: signing a renewal *is* how a school ends the
 * previous one, and asking the director to go and close last year's first turns
 * one act into two, with a window in between where somebody has no contract at
 * all. So activating one ends the other in the same transaction.
 *
 * Returns the contract's id.
 */
export async function saveContract(
  input: ContractInput,
  contractId: string | null,
): Promise<string> {
  return db.$transaction(async (tx) => {
    if (input.status === "ACTIVE") {
      const superseded = await tx.employmentContract.findMany({
        where: {
          staffId: input.staffId,
          status: "ACTIVE",
          ...(contractId ? { NOT: { id: contractId } } : {}),
        },
        select: { id: true },
      });

      for (const contract of superseded) {
        await tx.employmentContract.update({
          where: { id: contract.id },
          data: { status: "ENDED", activeKey: null },
        });
      }
    }

    const data = {
      staffId: input.staffId,
      kind: input.kind,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      trialEndsOn: input.trialEndsOn,
      baseSalaryCentimes: input.baseSalaryCentimes,
      weeklyHours: input.weeklyHours,
      status: input.status,
      notes: input.notes,
      // Never a literal — see lib/db-keys.ts.
      activeKey: activeContractKey(input.staffId, input.status),
    };

    const row = contractId
      ? await tx.employmentContract.update({
          where: { id: contractId },
          data,
          select: { id: true },
        })
      : await tx.employmentContract.create({ data, select: { id: true } });

    return row.id;
  });
}

/** Ends a contract without writing a replacement — somebody simply left. */
export async function endContract(contractId: string): Promise<void> {
  await db.employmentContract.update({
    where: { id: contractId },
    data: { status: "ENDED", activeKey: null },
  });
}

// ── The register ─────────────────────────────────────────────────────────────

export type AttendanceInput = {
  staffId: string;
  date: Date;
  status: string;
  isJustified: boolean;
  minutesLate: number;
  notes: string | null;
  recordedById: string;
};

/**
 * Marks one person on one day, correcting the day if it was already marked.
 *
 * An upsert rather than a create, because re-marking a register is how a
 * mistake is fixed — a second row would leave two opinions about the same
 * Tuesday and no rule for which wins.
 */
export async function markAttendance(input: AttendanceInput): Promise<string> {
  const date = startOfDay(input.date);

  const row = await db.staffAttendance.upsert({
    where: { staffId_date: { staffId: input.staffId, date } },
    update: {
      status: input.status,
      isJustified: input.isJustified,
      // Only LATE carries a delay; anything else keeping one would be a leftover
      // from a mark that has since been corrected.
      minutesLate: input.status === "LATE" ? input.minutesLate : 0,
      notes: input.notes,
      recordedById: input.recordedById,
    },
    create: {
      staffId: input.staffId,
      date,
      status: input.status,
      isJustified: input.isJustified,
      minutesLate: input.status === "LATE" ? input.minutesLate : 0,
      notes: input.notes,
      recordedById: input.recordedById,
    },
    select: { id: true },
  });

  return row.id;
}

/**
 * Marks everybody unmarked on a day with one status — the "tout le monde est
 * là" button.
 *
 * Deliberately only fills the gaps: a morning already recorded as an absence
 * must not be overwritten by somebody hitting the button at noon, which is the
 * one way a bulk action can quietly erase the very fact it exists to record.
 * Returns how many marks were written.
 */
export async function markDayInBulk(input: {
  staffIds: string[];
  date: Date;
  status: string;
  recordedById: string;
}): Promise<number> {
  const date = startOfDay(input.date);

  const alreadyMarked = await db.staffAttendance.findMany({
    where: { staffId: { in: input.staffIds }, date },
    select: { staffId: true },
  });
  const marked = new Set(alreadyMarked.map((mark) => mark.staffId));

  const missing = input.staffIds.filter((staffId) => !marked.has(staffId));
  if (missing.length === 0) return 0;

  await db.staffAttendance.createMany({
    data: missing.map((staffId) => ({
      staffId,
      date,
      status: input.status,
      isJustified: false,
      minutesLate: 0,
      recordedById: input.recordedById,
    })),
  });

  return missing.length;
}

// ── Payroll ──────────────────────────────────────────────────────────────────

export type SalaryInput = SalaryGains &
  SalaryDeductions & {
    staffId: string;
    periodYear: number;
    periodMonth: number;
    deductionLabel: string | null;
    status: string;
    notes: string | null;
  };

/**
 * Writes a month's bulletin, computing its net.
 *
 * Upserts on `(staffId, periodYear, periodMonth)`: running the payroll twice for
 * September must correct September rather than raise a second payslip for it.
 * The contract is looked up and stamped on so the document says which terms it
 * was drawn under, even after those terms are superseded.
 *
 * Returns null when the payslip has already been paid — the figures on a
 * document somebody has been handed, against money that has left, are not
 * something a form may quietly restate. Cancel the décaissement first.
 */
export async function saveSalary(
  input: SalaryInput,
): Promise<
  | { id: string; netCentimes: number; overRecovered?: number }
  | null
> {
  const existing = await db.salaryPayment.findUnique({
    where: {
      staffId_periodYear_periodMonth: {
        staffId: input.staffId,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
      },
    },
    select: { id: true, status: true },
  });

  if (existing?.status === "PAID") return null;

  const contract = await db.employmentContract.findFirst({
    where: { staffId: input.staffId, status: "ACTIVE" },
    select: { id: true },
  });

  const netCentimes = netSalary(input, input);

  const data = {
    contractId: contract?.id ?? null,
    baseCentimes: input.baseCentimes,
    allowanceCentimes: input.allowanceCentimes,
    overtimeCentimes: input.overtimeCentimes,
    bonusCentimes: input.bonusCentimes,
    absenceCentimes: input.absenceCentimes,
    advanceCentimes: input.advanceCentimes,
    socialCentimes: input.socialCentimes,
    taxCentimes: input.taxCentimes,
    otherDeductionCentimes: input.otherDeductionCentimes,
    deductionLabel: input.deductionLabel,
    // Always derived, never taken from the form — see the note on the column.
    netCentimes,
    status: input.status,
    notes: input.notes,
  };

  const row = await db.salaryPayment.upsert({
    where: {
      staffId_periodYear_periodMonth: {
        staffId: input.staffId,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
      },
    },
    update: data,
    create: {
      staffId: input.staffId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      ...data,
    },
    select: { id: true },
  });

  /*
    Post the month's avance deduction against the advances it actually settles.

    Done here rather than left to the caller so it cannot be forgotten: the box
    on the bulletin and the balance on the advance are two views of one fact,
    and a screen that wrote only the first would leave "how much does she still
    owe" answerable in two contradictory ways. Refused rather than absorbed when
    it exceeds what is owed — see `applyAdvanceRecovery`.
  */
  const recovery = await applyAdvanceRecovery(
    row.id,
    input.staffId,
    input.advanceCentimes,
  );
  if (!recovery.ok) {
    return {
      id: row.id,
      netCentimes,
      overRecovered: recovery.outstandingCentimes,
    };
  }

  return { id: row.id, netCentimes };
}

export type PayoutInput = {
  salaryId: string;
  schoolId: string;
  createdById: string;
  method: TenderMethod;
  cashSessionId: string | null;
  categoryId: string | null;
  reference: string | null;
  chequeNumber: string | null;
  bankName: string | null;
  paidOn: Date;
};

export type PayoutFailure =
  | "NOT_FOUND"
  | "ALREADY_PAID"
  | "CANCELLED"
  | "NOTHING_TO_PAY";

export type PayoutResult =
  | { ok: true; operationId: string; netCentimes: number }
  | { ok: false; reason: PayoutFailure };

/**
 * Pays a bulletin: writes the décaissement, and points the payslip at it.
 *
 * ── Why the caisse does the writing ─────────────────────────────────────────
 * A salary leaving the school is a movement of money like any other, and the
 * ledger is the only place a balance is ever computed from. Writing it here
 * directly would give the school two sets of books that agree only as long as
 * everybody remembers to update both, so this calls `recordDisbursement` —
 * the same function the décaissement screen calls — and inherits the cash
 * impact, the cheque and the audit trail for free.
 *
 * ── Why paying is not the same act as approving ─────────────────────────────
 * The payslip says what is owed and this says what left. They are separated by
 * days in practice, and by a permission in the app: preparing the payroll is
 * `HR_PAYROLL`, letting money out of the till is the caisse's
 * `TREASURY_DISBURSE`. See the note in permissions.ts.
 */
export async function payStaffSalary(
  input: PayoutInput,
): Promise<PayoutResult> {
  const salary = await db.salaryPayment.findUnique({
    where: { id: input.salaryId },
    select: {
      id: true,
      status: true,
      netCentimes: true,
      periodYear: true,
      periodMonth: true,
      cashOperationId: true,
      staff: {
        select: { id: true, code: true, firstName: true, lastName: true },
      },
    },
  });

  if (!salary) return { ok: false, reason: "NOT_FOUND" };
  if (salary.status === "PAID" || salary.cashOperationId) {
    return { ok: false, reason: "ALREADY_PAID" };
  }
  if (salary.status === "CANCELLED") return { ok: false, reason: "CANCELLED" };
  if (salary.netCentimes <= 0) return { ok: false, reason: "NOTHING_TO_PAY" };

  const beneficiaryName = staffName(salary.staff);
  const label = `Salaire ${String(salary.periodMonth).padStart(2, "0")}/${salary.periodYear} — ${beneficiaryName}`;

  const operation = await recordDisbursement({
    schoolId: input.schoolId,
    createdById: input.createdById,
    cashSessionId: input.cashSessionId,
    // A salary is posted under a rubrique, never a motif: the label already
    // names the month and the employee, which is what a bulletin's line says.
    categoryId: input.categoryId,
    subcategoryId: null,
    motifId: null,
    bankId: null,
    beneficiaryStaffId: salary.staff.id,
    beneficiaryName,
    label,
    method: input.method,
    amountCentimes: salary.netCentimes,
    reference: input.reference,
    chequeNumber: input.chequeNumber,
    bankName: input.bankName,
    occurredAt: input.paidOn,
  });

  // The unique index on `cashOperationId` is the real guard against a
  // double-click: a second payout for the same bulletin cannot claim the link.
  await db.salaryPayment.update({
    where: { id: salary.id },
    data: {
      status: "PAID",
      paidOn: input.paidOn,
      cashOperationId: operation.id,
    },
  });

  return {
    ok: true,
    operationId: operation.id,
    netCentimes: salary.netCentimes,
  };
}

// ── Leave ────────────────────────────────────────────────────────────────────

export type LeaveDecision = {
  leaveId: string;
  status: string;
  decidedById: string;
  decisionNote: string | null;
};

/**
 * Records a decision on a leave request, and moves the employee's own status
 * with it.
 *
 * Approving leave that is running today sets the employee ON_LEAVE, and a
 * decision that no longer covers today puts them back to ACTIVE. Done here
 * rather than left to whoever approves, because the status is what the register
 * and the payroll both read, and a school that forgets the second click ends up
 * marking absent somebody it granted the week off.
 *
 * Nobody TERMINATED or SUSPENDED is touched — those say something a holiday
 * cannot overrule.
 */
export async function decideLeave(
  input: LeaveDecision,
): Promise<{ staffId: string } | null> {
  const request = await db.leaveRequest.findUnique({
    where: { id: input.leaveId },
    select: {
      id: true,
      staffId: true,
      startsOn: true,
      endsOn: true,
      staff: { select: { status: true } },
    },
  });
  if (!request) return null;

  await db.leaveRequest.update({
    where: { id: request.id },
    data: {
      status: input.status,
      decidedById: input.decidedById,
      decidedAt: new Date(),
      decisionNote: input.decisionNote,
    },
  });

  const today = startOfDay(new Date());
  const coversToday =
    startOfDay(request.startsOn) <= today && startOfDay(request.endsOn) >= today;

  if (request.staff.status === "ACTIVE" && input.status === "APPROVED" && coversToday) {
    await db.staff.update({
      where: { id: request.staffId },
      data: { status: "ON_LEAVE" },
    });
  } else if (request.staff.status === "ON_LEAVE" && input.status !== "APPROVED") {
    await db.staff.update({
      where: { id: request.staffId },
      data: { status: "ACTIVE" },
    });
  }

  return { staffId: request.staffId };
}

// ── Avances sur salaire ──────────────────────────────────────────────────────

export type AdvanceInput = {
  staffId: string;
  amountCentimes: number;
  instalmentCount: number;
  reason: string | null;
  notes: string | null;
  recoverFromYear: number | null;
  recoverFromMonth: number | null;
};

export type AdvanceFailure =
  | "NOT_FOUND"
  | "ALREADY_DECIDED"
  | "NOT_APPROVED"
  | "ALREADY_PAID"
  | "LOCKED";

export type AdvanceResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; reason: AdvanceFailure };

/**
 * Raises or restates a request for an avance sur salaire.
 *
 * Editable only while nothing has happened to it. Once it is approved somebody
 * has agreed to a figure, and once it is paid the money has gone — restating
 * either from a form would rewrite a decision or a receipt, which is the same
 * reason `saveSalary` refuses a bulletin that has been paid.
 */
export async function saveAdvance(
  input: AdvanceInput,
  advanceId: string | null,
): Promise<AdvanceResult<{ id: string }>> {
  const data = {
    amountCentimes: input.amountCentimes,
    instalmentCount: input.instalmentCount,
    reason: input.reason,
    notes: input.notes,
    recoverFromYear: input.recoverFromYear,
    recoverFromMonth: input.recoverFromMonth,
  };

  if (advanceId) {
    const existing = await db.salaryAdvance.findUnique({
      where: { id: advanceId },
      select: { id: true, status: true },
    });
    if (!existing) return { ok: false, reason: "NOT_FOUND" };
    if (existing.status !== "REQUESTED") return { ok: false, reason: "LOCKED" };

    await db.salaryAdvance.update({ where: { id: existing.id }, data });
    return { ok: true, value: { id: existing.id } };
  }

  const created = await db.salaryAdvance.create({
    data: { staffId: input.staffId, status: "REQUESTED", ...data },
    select: { id: true },
  });
  return { ok: true, value: { id: created.id } };
}

/**
 * Approves or refuses a request.
 *
 * Separate from paying it for the same reason approving a bulletin is separate
 * from disbursing it: agreeing that somebody may have an advance and letting
 * money out of the till are two acts, done by two people, and the second is
 * gated on the caisse's own permission.
 */
export async function decideAdvance(
  advanceId: string,
  approve: boolean,
  approvedById: string,
  decisionNote: string | null,
): Promise<AdvanceResult> {
  const advance = await db.salaryAdvance.findUnique({
    where: { id: advanceId },
    select: { id: true, status: true },
  });
  if (!advance) return { ok: false, reason: "NOT_FOUND" };
  if (!isAdvanceDecidable(advance.status)) {
    return { ok: false, reason: "ALREADY_DECIDED" };
  }

  await db.salaryAdvance.update({
    where: { id: advance.id },
    data: {
      status: approve ? "APPROVED" : "CANCELLED",
      approvedById,
      approvedAt: new Date(),
      decisionNote,
    },
  });

  return { ok: true };
}

export type PayAdvanceInput = {
  advanceId: string;
  schoolId: string;
  createdById: string;
  method: TenderMethod;
  cashSessionId: string | null;
  categoryId: string | null;
  reference: string | null;
  chequeNumber: string | null;
  bankName: string | null;
  paidOn: Date;
};

/**
 * Hands the money over: writes the décaissement and points the advance at it.
 *
 * The caisse does the writing, exactly as it does for a salary — the ledger is
 * the only place a balance is ever computed from, and an advance paid straight
 * out of this module would be money the school spent that its own books never
 * saw. `recordDisbursement` is the same function the décaissement screen calls,
 * so the cash impact, the cheque and the audit trail all come for free.
 */
export async function payAdvance(
  input: PayAdvanceInput,
): Promise<AdvanceResult<{ operationId: string }>> {
  const advance = await db.salaryAdvance.findUnique({
    where: { id: input.advanceId },
    select: {
      id: true,
      status: true,
      amountCentimes: true,
      cashOperationId: true,
      staff: { select: { id: true, code: true, firstName: true, lastName: true } },
    },
  });
  if (!advance) return { ok: false, reason: "NOT_FOUND" };
  if (advance.cashOperationId || advance.status === "PAID") {
    return { ok: false, reason: "ALREADY_PAID" };
  }
  if (!isAdvancePayable(advance.status)) {
    return { ok: false, reason: "NOT_APPROVED" };
  }

  const beneficiaryName = staffName(advance.staff);
  const operation = await recordDisbursement({
    schoolId: input.schoolId,
    createdById: input.createdById,
    cashSessionId: input.cashSessionId,
    categoryId: input.categoryId,
    subcategoryId: null,
    motifId: null,
    bankId: null,
    beneficiaryStaffId: advance.staff.id,
    beneficiaryName,
    label: `Avance sur salaire — ${beneficiaryName}`,
    method: input.method,
    amountCentimes: advance.amountCentimes,
    reference: input.reference,
    chequeNumber: input.chequeNumber,
    bankName: input.bankName,
    occurredAt: input.paidOn,
  });

  // The unique index on `cashOperationId` is the real guard against a
  // double-click: a second payout cannot claim the link.
  await db.salaryAdvance.update({
    where: { id: advance.id },
    data: { status: "PAID", paidOn: input.paidOn, cashOperationId: operation.id },
  });

  return { ok: true, value: { operationId: operation.id } };
}

/** One advance with what has already come off it — the shape the maths needs. */
type AdvanceBalance = {
  id: string;
  status: string;
  amountCentimes: number;
  instalmentCount: number;
  recoveredCentimes: number;
};

async function outstandingAdvancesFor(
  staffId: string,
  excludeSalaryId: string | null,
): Promise<AdvanceBalance[]> {
  const advances = await db.salaryAdvance.findMany({
    where: { staffId, status: { in: [...OWED_ADVANCE_STATUSES] } },
    // Oldest first: an advance from March is settled before one from May, which
    // is how anybody would do it on paper and what makes the order defensible.
    orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      amountCentimes: true,
      instalmentCount: true,
      recoveries: {
        // The month being restated does not count against itself: its old rows
        // are about to be replaced, and counting them would make the advance
        // look more settled than it is.
        where: excludeSalaryId ? { NOT: { salaryPaymentId: excludeSalaryId } } : {},
        select: { amountCentimes: true },
      },
    },
  });

  return advances.map((advance) => ({
    id: advance.id,
    status: advance.status,
    amountCentimes: advance.amountCentimes,
    instalmentCount: advance.instalmentCount,
    recoveredCentimes: advance.recoveries.reduce(
      (total, row) => total + row.amountCentimes,
      0,
    ),
  }));
}

/**
 * What this month should take back, and how much is outstanding in all.
 *
 * Read by the payroll screen so the deduction box arrives filled in from what
 * is genuinely owed, rather than from whatever the bursar remembers. A pure
 * read — nothing is written until the bulletin is saved.
 */
export async function plannedAdvanceRecovery(
  staffId: string,
  excludeSalaryId: string | null = null,
): Promise<{ suggestedCentimes: number; outstandingCentimes: number }> {
  const advances = await outstandingAdvancesFor(staffId, excludeSalaryId);

  return {
    suggestedCentimes: advances.reduce(
      (total, advance) => total + advanceInstalment(advance),
      0,
    ),
    outstandingCentimes: advances.reduce(
      (total, advance) => total + outstandingAdvance(advance),
      0,
    ),
  };
}

/**
 * Spreads a month's `advanceCentimes` across what the employee actually owes.
 *
 * ── Why the deduction is allocated rather than merely stored ─────────────────
 * The box on the bulletin is one number, but it pays down particular advances,
 * and until it is written against them "how much is still owed on the March
 * advance" has no answer. So the figure is applied oldest-first and each part
 * recorded against the advance it settles — the same shape as a payment's
 * allocations against a family's schedule lines.
 *
 * Deducting more than is owed is refused rather than absorbed: it means the
 * bursar typed a figure that does not correspond to any advance, and silently
 * keeping the difference would be money withheld from a wage against nothing.
 *
 * Idempotent by construction: the month's own rows are cleared first, so
 * restating September's bulletin restates September's recoveries and every
 * balance follows.
 */
export async function applyAdvanceRecovery(
  salaryPaymentId: string,
  staffId: string,
  advanceCentimes: number,
): Promise<{ ok: true } | { ok: false; outstandingCentimes: number }> {
  const advances = await outstandingAdvancesFor(staffId, salaryPaymentId);
  const outstandingCentimes = advances.reduce(
    (total, advance) => total + outstandingAdvance(advance),
    0,
  );

  if (advanceCentimes > outstandingCentimes) {
    return { ok: false, outstandingCentimes };
  }

  await db.$transaction(async (tx) => {
    await tx.salaryAdvanceRecovery.deleteMany({ where: { salaryPaymentId } });

    let left = advanceCentimes;
    for (const advance of advances) {
      if (left <= 0) break;
      const take = Math.min(left, outstandingAdvance(advance));
      if (take <= 0) continue;

      await tx.salaryAdvanceRecovery.create({
        data: { advanceId: advance.id, salaryPaymentId, amountCentimes: take },
      });
      left -= take;
    }

    /*
      Restamp every touched advance's status.

      Both directions matter: one fully recovered becomes RECOVERED, and one
      whose recovery is being *undone* — because the bulletin was restated
      downwards — has to go back to PAID. Only ever a mirror of the arithmetic;
      `outstandingAdvance` stays the authority.
    */
    for (const advance of advances) {
      const settled = await tx.salaryAdvanceRecovery.aggregate({
        where: { advanceId: advance.id },
        _sum: { amountCentimes: true },
      });
      const recovered = settled._sum.amountCentimes ?? 0;
      const status = recovered >= advance.amountCentimes ? "RECOVERED" : "PAID";
      if (status !== advance.status) {
        await tx.salaryAdvance.update({ where: { id: advance.id }, data: { status } });
      }
    }
  });

  return { ok: true };
}
