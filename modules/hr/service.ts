import "server-only";

import { db } from "@/lib/db";
import {
  dispatch,
  notify,
  staffAccount,
} from "@/modules/notifications/service";
import {
  codePrefixOf,
  formatEntityCode,
  sequenceFromCode,
} from "@/lib/school-settings";
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
import {
  recordDisbursement,
  ReversalBlockedError,
  type TxClient,
} from "@/modules/treasury/service";
import type { TenderMethod } from "@/modules/treasury/enums";

/**
 * Either the ordinary client or a transaction's.
 *
 * The advance balances are read both ways: on their own by the payroll screen,
 * and inside the transaction that is about to write a deduction against them.
 */
type PayrollClient = Pick<TxClient, "salaryAdvance">;

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
 *   3. **A bulletin is paid at most once.** The décaissement and the link back
 *      to the payslip are written in one transaction, and the payslip is
 *      claimed with a conditional `updateMany` — so of two simultaneous
 *      payouts exactly one commits and the other is told it is already paid.
 *   4. **A register mark lands on a day, not a moment.** Every write normalises
 *      through `startOfDay`, which is what makes the unique index bite.
 */

// ── Matricules ───────────────────────────────────────────────────────────────

/**
 * Allocates the next matricule for a school.
 *
 * Takes the highest sequence already issued rather than counting the rows, for
 * the reason `allocateStudentCode` does: a count goes *down* when somebody is
 * deleted, so the school with seven employees and a leaver hands the next hire
 * a matricule that is already taken — and goes on doing so for ever, reporting
 * "that staff number is already used" about a number nobody typed.
 *
 * The unique index on `[schoolId, code]` is still what guarantees the number is
 * free; this only has to make a collision rare.
 */
export async function allocateStaffCode(
  schoolId: string,
  year = new Date().getFullYear(),
): Promise<string> {
  const { staffCodeFormat } = await loadSchoolSettings(schoolId);
  const prefix = codePrefixOf(staffCodeFormat, year);

  // Every code of the year, unsorted — a lexicographic top-N drops the true
  // maximum under an unpadded format. See `allocateFamilyCode` for the full note.
  const candidates = await db.staff.findMany({
    where: { schoolId, code: { startsWith: prefix } },
    select: { code: true },
  });

  const highest = candidates.reduce((max, row) => {
    const sequence = sequenceFromCode(staffCodeFormat, year, row.code);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);

  return formatEntityCode(staffCodeFormat, year, highest + 1);
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

  /*
    `createMany` without `skipDuplicates` — so somebody marking one person by
    hand between the read above and this write would collide on
    `(staffId, date)`. Swallowed rather than surfaced: the day is marked either
    way, and the hand-made mark is the more deliberate of the two, so letting it
    stand is the right outcome.

    Not `skipDuplicates: true`, which MySQL does support: it compiles to
    `INSERT IGNORE`, and that downgrades a bad foreign key or a truncated value
    to a warning as readily as it does the collision this is here to absorb.
    Catching the one race deliberately is narrower than silencing every error
    the statement can raise.
  */
  try {
    const created = await db.staffAttendance.createMany({
      data: missing.map((staffId) => ({
        staffId,
        date,
        status: input.status,
        isJustified: false,
        minutesLate: 0,
        recordedById: input.recordedById,
      })),
    });
    return created.count;
  } catch {
    return 0;
  }
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

export type SaveSalaryResult =
  | { ok: true; id: string; netCentimes: number }
  /** Money has left against it; the figures are no longer a form's to restate. */
  | { ok: false; reason: "ALREADY_PAID" }
  /** The retenue is larger than the avances it claims to recover. */
  | { ok: false; reason: "OVER_RECOVERED"; outstandingCentimes: number };

/**
 * Writes a month's bulletin, computing its net.
 *
 * Upserts on `(staffId, periodYear, periodMonth)`: running the payroll twice for
 * September must correct September rather than raise a second payslip for it.
 * The contract is looked up and stamped on so the document says which terms it
 * was drawn under, even after those terms are superseded.
 *
 * Refuses when the payslip has already been paid — the figures on a document
 * somebody has been handed, against money that has left, are not something a
 * form may quietly restate. Cancel the décaissement first.
 *
 * ── Why the whole thing is one transaction ──────────────────────────────────
 * The bulletin, the avance recoveries it settles and the statuses those leave
 * behind are one fact recorded in three tables. Written as three round trips,
 * a failure between them left a payslip carrying a retenue no avance backed —
 * which is the state the checking below exists to prevent, reached by another
 * road. The advances are read once, inside, and every decision is taken from
 * that read: there is no window in which the ceiling can move.
 *
 * `status` never arrives as PAID. Only `payStaffSalary` may set that, because
 * only it writes the décaissement that makes it true — see `salarySchema`,
 * which refuses the value before it ever reaches here.
 */
export async function saveSalary(
  input: SalaryInput,
): Promise<SaveSalaryResult> {
  if (input.status === "PAID") return { ok: false, reason: "ALREADY_PAID" };

  return db.$transaction(async (tx) => {
    const existing = await tx.salaryPayment.findUnique({
      where: {
        staffId_periodYear_periodMonth: {
          staffId: input.staffId,
          periodYear: input.periodYear,
          periodMonth: input.periodMonth,
        },
      },
      select: { id: true, status: true },
    });

    if (existing?.status === "PAID") {
      return { ok: false, reason: "ALREADY_PAID" } as const;
    }

    /*
      The avance deduction is checked *before* the bulletin is written.

      It used to be checked after: the row was upserted, the recovery then
      refused, and the screen showed an error over a payslip that had already
      been saved — carrying a retenue no avance backed and a net computed from
      it. A document that says one thing while the balances behind it say
      another is worse than a rejected form.

      The month being restated is excluded from its own balance: its recoveries
      are about to be replaced, and counting them would make the advance look
      more settled than it is.
    */
    const advances = await outstandingAdvancesFor(tx, {
      staffId: input.staffId,
    });
    const outstandingCentimes = totalOutstanding(advances, existing?.id ?? null);

    if (input.advanceCentimes > outstandingCentimes) {
      return { ok: false, reason: "OVER_RECOVERED", outstandingCentimes } as const;
    }

    const contract = await tx.employmentContract.findFirst({
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

    const row = await tx.salaryPayment.upsert({
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
      Post the month's avance deduction against the advances it actually
      settles. Done here rather than left to the caller so it cannot be
      forgotten: the box on the bulletin and the balance on the advance are two
      views of one fact, and a screen that wrote only the first would leave "how
      much does she still owe" answerable in two contradictory ways.
    */
    await applyAdvanceRecovery(tx, row.id, advances, input.advanceCentimes);

    return { ok: true, id: row.id, netCentimes } as const;
  });
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
 * Thrown to roll a payout back when the row turns out to have been claimed by
 * somebody else between the read and the write.
 *
 * A thrown error rather than a returned failure because returning one out of a
 * `$transaction` callback *commits* it — which would leave the décaissement
 * standing against a bulletin this call never managed to mark paid, the exact
 * double-payment the claim exists to refuse.
 */
class PayoutRaceLost extends Error {
  constructor() {
    super("payout lost the race");
    this.name = "PayoutRaceLost";
  }
}

function isRaceLost(error: unknown): boolean {
  return error instanceof PayoutRaceLost || (error as Error)?.name === "PayoutRaceLost";
}

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
 *
 * ── Why the claim is a conditional update ───────────────────────────────────
 * Reading the payslip, deciding it is unpaid and then writing the link is three
 * steps, and two clicks a moment apart both used to get past the middle one:
 * each wrote its *own* décaissement, so each claimed a different
 * `cashOperationId` and the unique index — which the comment here used to cite
 * as the guard — was never troubled. Somebody was paid twice for September and
 * the drawer was short. So the payslip is now claimed by an `updateMany` that
 * names the state it expects, inside the same transaction that writes the
 * money: whichever of the two gets there second matches no rows, and its
 * décaissement is rolled back with it.
 */
export async function payStaffSalary(
  input: PayoutInput,
): Promise<PayoutResult> {
  try {
    return await payStaffSalaryInTransaction(input);
  } catch (error) {
    if (isRaceLost(error)) return { ok: false, reason: "ALREADY_PAID" };
    throw error;
  }
}

function payStaffSalaryInTransaction(input: PayoutInput): Promise<PayoutResult> {
  return db.$transaction(async (tx) => {
    const salary = await tx.salaryPayment.findUnique({
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

    if (!salary) return { ok: false, reason: "NOT_FOUND" } as const;
    if (salary.status === "PAID" || salary.cashOperationId) {
      return { ok: false, reason: "ALREADY_PAID" } as const;
    }
    if (salary.status === "CANCELLED") {
      return { ok: false, reason: "CANCELLED" } as const;
    }
    if (salary.netCentimes <= 0) {
      return { ok: false, reason: "NOTHING_TO_PAY" } as const;
    }

    const beneficiaryName = staffName(salary.staff);
    const label = `Salaire ${String(salary.periodMonth).padStart(2, "0")}/${salary.periodYear} — ${beneficiaryName}`;

    const operation = await recordDisbursement(
      {
        schoolId: input.schoolId,
        createdById: input.createdById,
        cashSessionId: input.cashSessionId,
        // A salary is posted under a rubrique, never a motif: the label already
        // names the month and the employee, which is what a bulletin's line says.
        categoryId: input.categoryId,
        subcategoryId: null,
        motifId: null,
        notes: null,
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
      },
      tx,
    );

    const claimed = await tx.salaryPayment.updateMany({
      // The state this payout was decided against, restated as a condition.
      where: {
        id: salary.id,
        cashOperationId: null,
        status: { notIn: ["PAID", "CANCELLED"] },
      },
      data: {
        status: "PAID",
        paidOn: input.paidOn,
        cashOperationId: operation.id,
      },
    });
    // Thrown, not returned: a returned failure would commit the décaissement
    // written a few lines up. See `PayoutRaceLost`.
    if (claimed.count === 0) throw new PayoutRaceLost();

    return {
      ok: true,
      operationId: operation.id,
      netCentimes: salary.netCentimes,
    } as const;
  });
}

// ── Leave ────────────────────────────────────────────────────────────────────

export type LeaveDecision = {
  leaveId: string;
  status: string;
  decidedById: string;
  decisionNote: string | null;
};

/**
 * Recomputes whether somebody is away today, from the requests themselves.
 *
 * ── Why it is derived and not stamped ───────────────────────────────────────
 * It used to be two `if`s on the decision being made: approve something
 * covering today and you were ON_LEAVE, decide anything else and you went back
 * to ACTIVE. Both halves were wrong. Rejecting one request put back to work
 * somebody a *different*, still-approved request had away — the code only ever
 * looked at the request in front of it. And nothing ever reversed the first
 * half, so ON_LEAVE outlived the leave and an employee stayed "on leave" until
 * a second request happened to be refused.
 *
 * Counting the approved requests that cover today answers the question the
 * column is actually asking, and answers it the same way whichever request was
 * just decided. Exported so anything that changes a request's dates can call it
 * too.
 *
 * SUSPENDED and TERMINATED are never touched: those say something a holiday
 * cannot overrule.
 */
export async function refreshStaffLeaveStatus(
  staffId: string,
  on: Date = new Date(),
): Promise<void> {
  const person = await db.staff.findUnique({
    where: { id: staffId },
    select: { status: true },
  });
  if (!person) return;
  if (person.status !== "ACTIVE" && person.status !== "ON_LEAVE") return;

  const today = startOfDay(on);
  const away = await db.leaveRequest.count({
    where: {
      staffId,
      status: "APPROVED",
      startsOn: { lte: today },
      endsOn: { gte: today },
    },
  });

  const status = away > 0 ? "ON_LEAVE" : "ACTIVE";
  if (status !== person.status) {
    await db.staff.update({ where: { id: staffId }, data: { status } });
  }
}

/**
 * Records a decision on a leave request, and moves the employee's own status
 * with it.
 *
 * Done here rather than left to whoever approves, because the status is what
 * the register and the payroll both read, and a school that forgets the second
 * click ends up marking absent somebody it granted the week off.
 */
export async function decideLeave(
  input: LeaveDecision,
): Promise<{ staffId: string } | null> {
  const request = await db.leaveRequest.findUnique({
    where: { id: input.leaveId },
    select: { id: true, staffId: true },
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

  await refreshStaffLeaveStatus(request.staffId);

  await dispatch("LEAVE_DECIDED", () =>
    tellTheEmployee(request.id, input.status),
  );

  return { staffId: request.staffId };
}

/**
 * Tells somebody what was decided about their own congé.
 *
 * ── The one HR notification that is not administrative ──────────────────────
 * A leave request is the one thing in this module an employee is genuinely
 * *waiting* on — they have a train to book or a family to tell — and until now
 * the answer arrived by them asking somebody. Everything else RH does is the
 * school's business about a person; this is the person's own business.
 *
 * Reaches nobody when the employee has no account, which is most of a payroll.
 * See `staffAccount`.
 */
async function tellTheEmployee(
  leaveId: string,
  status: string,
): Promise<void> {
  const request = await db.leaveRequest.findUnique({
    where: { id: leaveId },
    select: {
      id: true,
      startsOn: true,
      staffId: true,
      staff: { select: { schoolId: true, school: { select: { organizationId: true } } } },
    },
  });
  if (!request) return;

  await notify({
    organizationId: request.staff.school.organizationId,
    schoolId: request.staff.schoolId,
    kind: "LEAVE_DECIDED",
    subjectId: request.id,
    // A decision reversed is a second answer, and the employee needs both.
    dedupeOn: status,
    params: { date: request.startsOn.toISOString(), status },
    targets: await staffAccount(request.staffId),
  });
}

// ── Avances sur salaire ──────────────────────────────────────────────────────

export type AdvanceInput = {
  staffId: string;
  amountCentimes: number;
  instalmentCount: number;
  reason: string | null;
  notes: string | null;
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

  const status = approve ? "APPROVED" : "CANCELLED";

  await db.salaryAdvance.update({
    where: { id: advance.id },
    data: {
      status,
      approvedById,
      approvedAt: new Date(),
      decisionNote,
    },
  });

  await dispatch("ADVANCE_DECIDED", () =>
    tellAboutAdvance(advance.id, status),
  );

  return { ok: true };
}

/**
 * Tells somebody whether they are getting the avance they asked for.
 *
 * Somebody asks for an advance because they need the money, which makes the
 * answer the most time-sensitive thing RH produces — and the amount travels in
 * centimes so the employee reads it in their own language's formatting rather
 * than the payroll clerk's. Note that this is the *decision*, not the handover:
 * `payAdvance` is a separate act by a different person, and telling somebody
 * their advance was approved is not telling them it is at the desk.
 */
async function tellAboutAdvance(
  advanceId: string,
  status: string,
): Promise<void> {
  const advance = await db.salaryAdvance.findUnique({
    where: { id: advanceId },
    select: {
      id: true,
      amountCentimes: true,
      staffId: true,
      staff: {
        select: { schoolId: true, school: { select: { organizationId: true } } },
      },
    },
  });
  if (!advance) return;

  await notify({
    organizationId: advance.staff.school.organizationId,
    schoolId: advance.staff.schoolId,
    kind: "ADVANCE_DECIDED",
    subjectId: advance.id,
    dedupeOn: status,
    params: { amountCentimes: advance.amountCentimes, status },
    targets: await staffAccount(advance.staffId),
  });
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
  try {
    return await payAdvanceInTransaction(input);
  } catch (error) {
    if (isRaceLost(error)) return { ok: false, reason: "ALREADY_PAID" };
    throw error;
  }
}

function payAdvanceInTransaction(
  input: PayAdvanceInput,
): Promise<AdvanceResult<{ operationId: string }>> {
  return db.$transaction(async (tx) => {
    const advance = await tx.salaryAdvance.findUnique({
      where: { id: input.advanceId },
      select: {
        id: true,
        status: true,
        amountCentimes: true,
        cashOperationId: true,
        staff: {
          select: { id: true, code: true, firstName: true, lastName: true },
        },
      },
    });
    if (!advance) return { ok: false, reason: "NOT_FOUND" } as const;
    if (advance.cashOperationId || advance.status === "PAID") {
      return { ok: false, reason: "ALREADY_PAID" } as const;
    }
    if (!isAdvancePayable(advance.status)) {
      return { ok: false, reason: "NOT_APPROVED" } as const;
    }

    const beneficiaryName = staffName(advance.staff);
    const operation = await recordDisbursement(
      {
        schoolId: input.schoolId,
        createdById: input.createdById,
        cashSessionId: input.cashSessionId,
        categoryId: input.categoryId,
        subcategoryId: null,
        motifId: null,
        notes: null,
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
      },
      tx,
    );

    // Claimed by condition rather than trusted from the read above, and inside
    // the transaction that wrote the money — see the note on `payStaffSalary`.
    const claimed = await tx.salaryAdvance.updateMany({
      where: { id: advance.id, cashOperationId: null, status: "APPROVED" },
      data: {
        status: "PAID",
        paidOn: input.paidOn,
        cashOperationId: operation.id,
      },
    });
    if (claimed.count === 0) throw new PayoutRaceLost();

    return { ok: true, value: { operationId: operation.id } } as const;
  });
}

/**
 * One advance with every recovery posted against it, named by the bulletin that
 * posted it.
 *
 * The recoveries are kept as rows rather than pre-summed because who is asking
 * changes the answer: a bulletin being restated must not count its *own* old
 * deduction against the advance it is about to re-post, and a screen listing
 * the school's advances must count all of them. Summing at the query would fix
 * one reader's answer for the other.
 */
export type AdvanceBalance = {
  id: string;
  staffId: string;
  status: string;
  amountCentimes: number;
  instalmentCount: number;
  recoveries: { salaryPaymentId: string; amountCentimes: number }[];
};

/** What one employee owes in all, and what this month's instalments come to. */
export type AdvanceTotals = {
  outstandingCentimes: number;
  suggestedCentimes: number;
};

/**
 * Every advance still owed by the staff a scope selects.
 *
 * ── The one place this is read ──────────────────────────────────────────────
 * There were two: this, and a copy in queries.ts that fed the payroll screen.
 * They disagreed by design — only this one excluded the month being restated —
 * so the "still owed" figure a bursar read beside the deduction box was not the
 * ceiling the server would enforce against it, and the rejection then quoted a
 * third number again. `queries.ts` now reads this, which is why it is exported
 * from the file that owns the invariant rather than reimplemented in the file
 * that displays it.
 *
 * Takes a client so it can be read inside the transaction that is about to
 * write against the figure — see `saveSalary`.
 */
export async function outstandingAdvancesFor(
  client: PayrollClient,
  scope: { staffId: string } | { staff: { schoolId: string } },
): Promise<AdvanceBalance[]> {
  const advances = await client.salaryAdvance.findMany({
    where: { ...scope, status: { in: [...OWED_ADVANCE_STATUSES] } },
    // Oldest first: an advance from March is settled before one from May, which
    // is how anybody would do it on paper and what makes the order defensible.
    orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      staffId: true,
      status: true,
      amountCentimes: true,
      instalmentCount: true,
      recoveries: { select: { salaryPaymentId: true, amountCentimes: true } },
    },
  });

  return advances;
}

/**
 * What has come off one advance, ignoring the bulletin being restated.
 *
 * `excludeSalaryId` is the month whose recoveries are about to be replaced.
 * Counting them would make the advance look more settled than it is and refuse
 * a bursar the right to re-post the very deduction they are correcting.
 */
function recoveredOn(
  advance: AdvanceBalance,
  excludeSalaryId: string | null,
): number {
  return advance.recoveries.reduce(
    (total, row) =>
      row.salaryPaymentId === excludeSalaryId ? total : total + row.amountCentimes,
    0,
  );
}

/** What one advance still owes, on the same terms. */
function outstandingOf(
  advance: AdvanceBalance,
  excludeSalaryId: string | null,
): number {
  return outstandingAdvance({
    status: advance.status,
    amountCentimes: advance.amountCentimes,
    recoveredCentimes: recoveredOn(advance, excludeSalaryId),
  });
}

/** What a set of advances still owes in all. */
export function totalOutstanding(
  advances: AdvanceBalance[],
  excludeSalaryId: string | null,
): number {
  return advances.reduce(
    (total, advance) => total + outstandingOf(advance, excludeSalaryId),
    0,
  );
}

/**
 * The same advances folded per employee, for a screen showing the whole school.
 *
 * `excludeSalaryIdFor` names, per employee, the bulletin that is about to be
 * restated — so the payroll screen shows each line the ceiling that line's own
 * save will be checked against, rather than a school-wide figure that is right
 * for nobody.
 */
export function advanceTotalsByStaff(
  advances: AdvanceBalance[],
  excludeSalaryIdFor: (staffId: string) => string | null = () => null,
): Record<string, AdvanceTotals> {
  const totals: Record<string, AdvanceTotals> = {};

  for (const advance of advances) {
    const exclude = excludeSalaryIdFor(advance.staffId);
    const recoveredCentimes = recoveredOn(advance, exclude);
    const shaped = {
      status: advance.status,
      amountCentimes: advance.amountCentimes,
      instalmentCount: advance.instalmentCount,
      recoveredCentimes,
    };

    const held = totals[advance.staffId] ?? {
      outstandingCentimes: 0,
      suggestedCentimes: 0,
    };
    held.outstandingCentimes += outstandingAdvance(shaped);
    held.suggestedCentimes += advanceInstalment(shaped);
    totals[advance.staffId] = held;
  }

  return totals;
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
 * Idempotent by construction: the month's own rows are cleared first, so
 * restating September's bulletin restates September's recoveries and every
 * balance follows.
 *
 * Takes the advances its caller already read, rather than reading them again.
 * They were read inside the same transaction and the amount was proved against
 * them there; a second read could only disagree with the check that let this be
 * called at all.
 */
async function applyAdvanceRecovery(
  tx: TxClient,
  salaryPaymentId: string,
  advances: AdvanceBalance[],
  advanceCentimes: number,
): Promise<void> {
  await tx.salaryAdvanceRecovery.deleteMany({ where: { salaryPaymentId } });

  let left = advanceCentimes;
  for (const advance of advances) {
    if (left <= 0) break;
    // This month's own rows are the ones just deleted, so they never count.
    const take = Math.min(left, outstandingOf(advance, salaryPaymentId));
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
      await tx.salaryAdvance.update({
        where: { id: advance.id },
        data: { status },
      });
    }
  }
}

/**
 * Puts a bulletin or an avance back to unpaid when the caisse reverses the
 * movement that settled it.
 *
 * Run inside `cancelOperation`'s transaction — see modules/treasury/service.ts.
 * The payroll says what is *owed* and the ledger says what *left*, and the one
 * thing that must never happen is the two disagreeing: a bulletin still stamped
 * PAID against a reversed entry has an employee's file claiming money that came
 * back into the drawer.
 *
 * ── The one case it refuses ──────────────────────────────────────────────────
 * An avance already recovered out of a payslip cannot be un-paid: the deduction
 * on that month's bulletin was taken against money the employee had in hand,
 * and unwinding the payment while the recovery stands would leave them docked
 * for an avance they never received. The bulletin has to be restated first, so
 * the reversal is blocked rather than half-applied.
 */
export async function detachPayrollFromOperations(
  tx: TxClient,
  operationIds: string[],
): Promise<void> {
  if (operationIds.length === 0) return;

  await tx.salaryPayment.updateMany({
    where: { cashOperationId: { in: operationIds } },
    // Back to APPROVED rather than DRAFT: the figures were agreed and only the
    // payment is being undone.
    data: { status: "APPROVED", paidOn: null, cashOperationId: null },
  });

  const advances = await tx.salaryAdvance.findMany({
    where: { cashOperationId: { in: operationIds } },
    select: { id: true, _count: { select: { recoveries: true } } },
  });

  if (advances.some((advance) => advance._count.recoveries > 0)) {
    throw new ReversalBlockedError();
  }

  await tx.salaryAdvance.updateMany({
    where: { id: { in: advances.map((advance) => advance.id) } },
    data: { status: "APPROVED", paidOn: null, cashOperationId: null },
  });
}
