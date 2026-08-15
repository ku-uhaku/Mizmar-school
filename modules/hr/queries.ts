import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { schoolScope } from "@/lib/scope";
import {
  outstandingAdvance,
  suggestStatutory,
  type StatutorySuggestion,
  CHARGEABLE_ABSENCE_STATUSES,
  EMPLOYED_STATUSES,
  PAYABLE_SALARY_STATUSES,
  dailyRate,
  departmentOf,
  grossSalary,
  staffName,
  startOfDay,
} from "@/modules/hr/enums";
import {
  advanceTotalsByStaff,
  outstandingAdvancesFor,
} from "@/modules/hr/service";
import {
  listTeacherDuties,
  type TeacherDutyRow,
} from "@/modules/classes/queries";
import {
  listStaffVehicles,
  type StaffVehicleRow,
} from "@/modules/transport/queries";

/**
 * Reads for the RH module.
 *
 * Everything is scoped to `context.currentSchool`, and nothing is scoped to the
 * year: an employee is employed across school years, exactly like a vehicle. The
 * periods that *are* year-shaped — a month's payroll, a day's register — are
 * asked for by their own parameters rather than taken from the working context,
 * because a bursar preparing September in October is the ordinary case.
 *
 * `listStaffOptions` is this module's lending library: the fleet and the caisse
 * both pick an employee from it rather than repeating a name.
 *
 * ── What money a reader gets back ───────────────────────────────────────────
 * `HR_VIEW` opens the staff list; `HR_PAYROLL` opens what they earn. The screens
 * have always drawn that line, but they drew it in the *rendering*, which put
 * every salary in the payload of a page a reader without the code could open —
 * hidden on screen and one devtools panel away. So the line is drawn here
 * instead: `withPayroll` decides once, and the figures a reader may not see are
 * null before they leave the server. See `hideMoney`.
 */

/** Whether this reader may see what people are paid, in the current school. */
function withPayroll(context: AuthContext): boolean {
  return context.can(PERMISSIONS.HR_PAYROLL);
}

// ── The people ───────────────────────────────────────────────────────────────

export type StaffRow = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobRole: string;
  department: string;
  jobTitle: string | null;
  status: string;
  phone: string | null;
  email: string | null;
  hiredOn: string | null;
  leftOn: string | null;
  /** The account they sign in with, when they have one. */
  userId: string | null;
  userEmail: string | null;
  contractKind: string | null;
  /**
   * Monthly base from the live contract. Null when none is in force **and**
   * null for a reader without `HR_PAYROLL` — `hasLiveContract` is what says
   * which, so the "no contract signed" warning still works without disclosing
   * the figure to somebody who may not see it.
   */
  baseSalaryCentimes: number | null;
  hasLiveContract: boolean;
};

/** The live contract, or null. Extracted so list and detail cannot disagree. */
const ACTIVE_CONTRACT = {
  where: { status: "ACTIVE" },
  select: { id: true, kind: true, baseSalaryCentimes: true },
  take: 1,
} as const;

export async function listStaff(context: AuthContext): Promise<StaffRow[]> {
  const canSeePay = withPayroll(context);

  const staff = await db.staff.findMany({
    where: schoolScope(context),
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      user: { select: { id: true, email: true } },
      contracts: ACTIVE_CONTRACT,
    },
  });

  return staff.map((person) => {
    const contract = person.contracts[0] ?? null;
    return {
      id: person.id,
      code: person.code,
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: staffName(person),
      jobRole: person.jobRole,
      department: departmentOf(person.jobRole),
      jobTitle: person.jobTitle,
      status: person.status,
      phone: person.phone,
      email: person.email,
      hiredOn: person.hiredOn?.toISOString() ?? null,
      leftOn: person.leftOn?.toISOString() ?? null,
      userId: person.user?.id ?? null,
      userEmail: person.user?.email ?? null,
      contractKind: contract?.kind ?? null,
      baseSalaryCentimes: canSeePay
        ? (contract?.baseSalaryCentimes ?? null)
        : null,
      hasLiveContract: contract !== null,
    };
  });
}

export type ContractRow = {
  id: string;
  kind: string;
  startsOn: string;
  endsOn: string | null;
  trialEndsOn: string | null;
  baseSalaryCentimes: number;
  weeklyHours: number | null;
  status: string;
  notes: string | null;
};

export type SalaryRow = {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  periodYear: number;
  periodMonth: number;
  baseCentimes: number;
  allowanceCentimes: number;
  overtimeCentimes: number;
  bonusCentimes: number;
  absenceCentimes: number;
  advanceCentimes: number;
  socialCentimes: number;
  taxCentimes: number;
  otherDeductionCentimes: number;
  deductionLabel: string | null;
  grossCentimes: number;
  netCentimes: number;
  status: string;
  paidOn: string | null;
  /** Set once the décaissement exists — what makes the "paid" badge truthful. */
  cashOperationId: string | null;
  notes: string | null;
};

export type AttendanceRow = {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  date: string;
  status: string;
  isJustified: boolean;
  minutesLate: number;
  notes: string | null;
  recordedByName: string;
};

export type LeaveRow = {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  kind: string;
  startsOn: string;
  endsOn: string;
  dayCount: number;
  reason: string | null;
  status: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

/** Shapes a payslip row once, so the payroll list and the staff file agree. */
type SalaryRecord = {
  id: string;
  staffId: string;
  periodYear: number;
  periodMonth: number;
  baseCentimes: number;
  allowanceCentimes: number;
  overtimeCentimes: number;
  bonusCentimes: number;
  absenceCentimes: number;
  advanceCentimes: number;
  socialCentimes: number;
  taxCentimes: number;
  otherDeductionCentimes: number;
  deductionLabel: string | null;
  netCentimes: number;
  status: string;
  paidOn: Date | null;
  cashOperationId: string | null;
  notes: string | null;
};

function toSalaryRow(
  salary: SalaryRecord,
  person: { code: string; firstName: string; lastName: string },
): SalaryRow {
  return {
    id: salary.id,
    staffId: salary.staffId,
    staffName: staffName(person),
    staffCode: person.code,
    periodYear: salary.periodYear,
    periodMonth: salary.periodMonth,
    baseCentimes: salary.baseCentimes,
    allowanceCentimes: salary.allowanceCentimes,
    overtimeCentimes: salary.overtimeCentimes,
    bonusCentimes: salary.bonusCentimes,
    absenceCentimes: salary.absenceCentimes,
    advanceCentimes: salary.advanceCentimes,
    socialCentimes: salary.socialCentimes,
    taxCentimes: salary.taxCentimes,
    otherDeductionCentimes: salary.otherDeductionCentimes,
    deductionLabel: salary.deductionLabel,
    grossCentimes: grossSalary(salary),
    netCentimes: salary.netCentimes,
    status: salary.status,
    paidOn: salary.paidOn?.toISOString() ?? null,
    cashOperationId: salary.cashOperationId,
    notes: salary.notes,
  };
}

export type StaffDetail = StaffRow & {
  firstNameAr: string | null;
  lastNameAr: string | null;
  gender: string | null;
  /** `YYYY-MM-DD`, ready for the form — never a full ISO instant. */
  birthDate: string | null;
  birthPlace: string | null;
  nationalId: string | null;
  cnssNumber: string | null;
  /** A bank detail, so `HR_PAYROLL` only — null for everybody else. */
  bankRib: string | null;
  address: string | null;
  notes: string | null;
  /** Empty without `HR_PAYROLL`: a contract is a salary written down. */
  contracts: ContractRow[];
  /** Empty without `HR_PAYROLL`. */
  salaries: SalaryRow[];
  /** The last twenty requests, newest first. */
  leave: LeaveRow[];
  /** The last thirty marks, newest first — enough to see a pattern. */
  attendance: AttendanceRow[];
  /** Approved leave days taken in the current calendar year. */
  leaveDaysThisYear: number;
  /** Unjustified absences on record, all time — see `isChargeableAbsence`. */
  unjustifiedAbsences: number;
  /**
   * Their own weekly ceiling in minutes, null when they run on the week's —
   * see the note on `Staff.maxWeeklyMinutes`. Shown beside the load so a head
   * of studies can see at a glance who is at their limit.
   */
  maxWeeklyMinutes: number | null;
  /**
   * This year's teaching service. Empty for anybody with no account linked,
   * since an assignment names a User and not a Staff row.
   */
  teaching: TeacherDutyRow[];
  /** What the assignments add up to, in minutes a week. */
  teachingMinutes: number;
  /** The buses driven or accompanied, each with this year's lines. */
  vehicles: StaffVehicleRow[];
  /**
   * Advances still to recover, in centimes. Zero without `HR_PAYROLL` — an
   * outstanding balance is a salary fact like any other.
   */
  advanceOutstandingCentimes: number;
};

/**
 * The header search, RH's half.
 *
 * Matches a name in either script, the matricule, the phone or the CIN — a
 * secretary looking somebody up has one of those and rarely the spelling. Like
 * every read here it is scoped to the school in context, so the box can only
 * ever find this school's payroll, and the caller gates it on `HR_VIEW`.
 *
 * `mode: "insensitive"` is deliberately not passed, for the reason given in
 * `searchStudents`: the `utf8mb4_unicode_ci` collation has already made LIKE
 * case- and accent-insensitive, and Prisma does not offer the option on MySQL.
 */
export async function searchStaff(
  context: AuthContext,
  term: string,
  take = 5,
): Promise<
  {
    id: string;
    code: string;
    fullName: string;
    jobRole: string;
    jobTitle: string | null;
    status: string;
    phone: string | null;
  }[]
> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const staff = await db.staff.findMany({
    where: {
      ...schoolScope(context),
      OR: [
        { firstName: { contains: trimmed } },
        { lastName: { contains: trimmed } },
        { firstNameAr: { contains: trimmed } },
        { lastNameAr: { contains: trimmed } },
        { code: { contains: trimmed } },
        { phone: { contains: trimmed } },
        { nationalId: { contains: trimmed } },
      ],
    },
    // Employed first: looking somebody up almost always means somebody who
    // still works here, and a leaver with a similar name should not push them
    // off a five-row list.
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    take,
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      jobRole: true,
      jobTitle: true,
      status: true,
      phone: true,
    },
  });

  return staff.map((person) => ({
    id: person.id,
    code: person.code,
    fullName: staffName(person),
    jobRole: person.jobRole,
    jobTitle: person.jobTitle,
    status: person.status,
    phone: person.phone,
  }));
}

/**
 * One employee's whole file.
 *
 * Scoped by the school, so a staff id alone can never reach another school's
 * payroll — which is the whole reason this is one function rather than a page
 * assembling its own reads. The contracts and the payslips are withheld
 * outright from a reader without `HR_PAYROLL` rather than fetched and hidden by
 * the screen: see the note at the top of this file.
 */
export async function findStaff(
  context: AuthContext,
  staffId: string,
): Promise<StaffDetail | null> {
  const canSeePay = withPayroll(context);

  const person = await db.staff.findFirst({
    where: { id: staffId, ...schoolScope(context) },
    include: {
      user: { select: { id: true, email: true } },
      contracts: { orderBy: [{ startsOn: "desc" }] },
      salaries: canSeePay
        ? {
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            take: 24,
          }
        : { where: { id: "" } },
      leaveRequests: { orderBy: [{ startsOn: "desc" }], take: 20 },
      attendance: {
        orderBy: [{ date: "desc" }],
        take: 30,
        include: {
          recordedBy: {
            select: {
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!person) return null;

  const year = new Date().getFullYear();

  const [leaveDays, unjustified, teaching, vehicles, advances] =
    await Promise.all([
      db.leaveRequest.aggregate({
        where: {
          staffId: person.id,
          status: "APPROVED",
          // Bounded at both ends. Without the upper one, leave already approved
          // for next January counted against this year's entitlement.
          startsOn: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
        },
        _sum: { dayCount: true },
      }),
      db.staffAttendance.count({
        where: {
          staffId: person.id,
          isJustified: false,
          status: { in: [...CHARGEABLE_ABSENCE_STATUSES] },
        },
      }),
      /*
        The service, through each owning module rather than by reaching into
        their tables from here.

        Teaching is keyed on the *account*, not on this row — an assignment
        names a User, so an employee with no login teaches nothing as far as the
        timetable is concerned, and the file says so rather than inventing a
        join. The fleet is keyed on the employment record, because a bus names
        the person the school pays.
      */
      person.user ? listTeacherDuties(context, person.user.id) : [],
      listStaffVehicles(context, person.id),
      canSeePay ? outstandingAdvancesFor(db, { staffId: person.id }) : [],
    ]);

  const live = person.contracts.find(
    (contract) => contract.status === "ACTIVE",
  );
  const identity = {
    code: person.code,
    firstName: person.firstName,
    lastName: person.lastName,
  };

  return {
    id: person.id,
    code: person.code,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: staffName(person),
    firstNameAr: person.firstNameAr,
    lastNameAr: person.lastNameAr,
    gender: person.gender,
    birthDate: toDateInputValue(person.birthDate),
    birthPlace: person.birthPlace,
    nationalId: person.nationalId,
    cnssNumber: person.cnssNumber,
    bankRib: canSeePay ? person.bankRib : null,
    jobRole: person.jobRole,
    department: departmentOf(person.jobRole),
    jobTitle: person.jobTitle,
    status: person.status,
    phone: person.phone,
    email: person.email,
    address: person.address,
    hiredOn: person.hiredOn?.toISOString() ?? null,
    leftOn: person.leftOn?.toISOString() ?? null,
    userId: person.user?.id ?? null,
    userEmail: person.user?.email ?? null,
    contractKind: live?.kind ?? null,
    baseSalaryCentimes: canSeePay ? (live?.baseSalaryCentimes ?? null) : null,
    hasLiveContract: live !== undefined,
    notes: person.notes,
    contracts: canSeePay
      ? person.contracts.map((contract) => ({
          id: contract.id,
          kind: contract.kind,
          startsOn: contract.startsOn.toISOString(),
          endsOn: contract.endsOn?.toISOString() ?? null,
          trialEndsOn: contract.trialEndsOn?.toISOString() ?? null,
          baseSalaryCentimes: contract.baseSalaryCentimes,
          weeklyHours: contract.weeklyHours,
          status: contract.status,
          notes: contract.notes,
        }))
      : [],
    salaries: person.salaries.map((salary) => toSalaryRow(salary, identity)),
    leave: person.leaveRequests.map((request) => ({
      id: request.id,
      staffId: request.staffId,
      staffName: staffName(person),
      staffCode: person.code,
      kind: request.kind,
      startsOn: request.startsOn.toISOString(),
      endsOn: request.endsOn.toISOString(),
      dayCount: request.dayCount,
      reason: request.reason,
      status: request.status,
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decisionNote: request.decisionNote,
    })),
    attendance: person.attendance.map((mark) => ({
      id: mark.id,
      staffId: mark.staffId,
      staffName: staffName(person),
      staffCode: person.code,
      date: mark.date.toISOString(),
      status: mark.status,
      isJustified: mark.isJustified,
      minutesLate: mark.minutesLate,
      notes: mark.notes,
      recordedByName: displayName(mark.recordedBy),
    })),
    leaveDaysThisYear: leaveDays._sum.dayCount ?? 0,
    unjustifiedAbsences: unjustified,
    maxWeeklyMinutes: person.maxWeeklyMinutes,
    teaching,
    teachingMinutes: teaching.reduce(
      (total, duty) => total + (duty.weeklyMinutes ?? 0),
      0,
    ),
    vehicles,
    advanceOutstandingCentimes: advances.reduce(
      (total, advance) =>
        total +
        outstandingAdvance({
          status: advance.status,
          amountCentimes: advance.amountCentimes,
          recoveredCentimes: advance.recoveries.reduce(
            (sum, recovery) => sum + recovery.amountCentimes,
            0,
          ),
        }),
      0,
    ),
  };
}

// ── The register ─────────────────────────────────────────────────────────────

export type RegisterEntry = {
  staffId: string;
  staffName: string;
  staffCode: string;
  jobRole: string;
  /** Null when nobody has marked this person today — see the note on HOLIDAY. */
  attendanceId: string | null;
  status: string | null;
  isJustified: boolean;
  minutesLate: number;
  notes: string | null;
};

/**
 * One day's register: everybody still employed, with their mark if it exists.
 *
 * Built as a left join rather than a list of marks, because the question the
 * screen answers is "who has not been marked yet". A list of what was recorded
 * cannot answer that, and it is the only thing anybody looks at a register for
 * before ten in the morning.
 */
export async function listRegister(
  context: AuthContext,
  day: Date,
): Promise<RegisterEntry[]> {
  const date = startOfDay(day);

  const staff = await db.staff.findMany({
    where: { ...schoolScope(context), status: { in: [...EMPLOYED_STATUSES] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      jobRole: true,
      attendance: {
        where: { date },
        select: {
          id: true,
          status: true,
          isJustified: true,
          minutesLate: true,
          notes: true,
        },
        take: 1,
      },
    },
  });

  return staff.map((person) => {
    const mark = person.attendance[0] ?? null;
    return {
      staffId: person.id,
      staffName: staffName(person),
      staffCode: person.code,
      jobRole: person.jobRole,
      attendanceId: mark?.id ?? null,
      status: mark?.status ?? null,
      isJustified: mark?.isJustified ?? false,
      minutesLate: mark?.minutesLate ?? 0,
      notes: mark?.notes ?? null,
    };
  });
}

// ── The payroll ──────────────────────────────────────────────────────────────

export type PayrollLine = SalaryRow & {
  jobRole: string;
  /** The live contract's base, so the screen can flag a bulletin that lags it. */
  contractBaseCentimes: number | null;
  /** Unjustified absences in the month, beside the retenue box. */
  unjustifiedDays: number;
  /** What one day of the contract base is worth — a suggestion, never applied. */
  dailyRateCentimes: number;
  /** Everything still owed on avances the employee has actually received. */
  advanceOutstandingCentimes: number;
  /** What this month's instalments come to — what the deduction box starts at. */
  advanceSuggestedCentimes: number;
  /**
   * What the CNSS, AMO and IR boxes should probably say for this gross.
   *
   * Computed against the school's own rates and offered to the screen; nothing
   * applies it. See `suggestStatutory`, which explains at length why a payroll
   * engine is exactly what this is not.
   */
  statutory: StatutorySuggestion;
};

/**
 * One month's payroll: a line per employed person, whether or not a bulletin
 * exists yet.
 *
 * Same shape as the register above and for the same reason — the bursar's
 * question in the last week of the month is "who has not been done", and a list
 * of the payslips that exist cannot answer it.
 */
export async function listPayroll(
  context: AuthContext,
  periodYear: number,
  periodMonth: number,
): Promise<PayrollLine[]> {
  const monthStart = new Date(periodYear, periodMonth - 1, 1);
  const monthEnd = new Date(periodYear, periodMonth, 1);

  const staff = await db.staff.findMany({
    where: { ...schoolScope(context), status: { in: [...EMPLOYED_STATUSES] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      contracts: ACTIVE_CONTRACT,
      salaries: { where: { periodYear, periodMonth }, take: 1 },
      attendance: {
        where: {
          date: { gte: monthStart, lt: monthEnd },
          isJustified: false,
          status: { in: [...CHARGEABLE_ABSENCE_STATUSES] },
        },
        select: { id: true },
      },
    },
  });

  /*
    Each line's balance excludes that employee's own bulletin for this month,
    because that is the figure the save will be checked against — see
    `saveSalary`. Read without the exclusion, a month already deducted showed
    the advance as settled, and a bursar correcting September upwards was
    refused against a ceiling the screen had never shown them.

    One query for the school rather than one per line: this renders a row per
    employee, and a round trip apiece is the difference between a page and a
    timeout.
  */
  const salaryIdByStaff = new Map(
    staff.flatMap((person) => {
      const salary = person.salaries[0];
      return salary ? [[person.id, salary.id] as const] : [];
    }),
  );
  const advances = await outstandingAdvancesFor(db, {
    staff: schoolScope(context),
  });
  const balances = advanceTotalsByStaff(
    advances,
    (staffId) => salaryIdByStaff.get(staffId) ?? null,
  );

  return staff.map((person) => {
    const contract = person.contracts[0] ?? null;
    const salary = person.salaries[0] ?? null;
    const identity = {
      code: person.code,
      firstName: person.firstName,
      lastName: person.lastName,
    };

    // No bulletin yet: an empty one, pre-filled from the contract, so the screen
    // renders one uniform table instead of two.
    const row = salary
      ? toSalaryRow(salary, identity)
      : {
          id: "",
          staffId: person.id,
          staffName: staffName(person),
          staffCode: person.code,
          periodYear,
          periodMonth,
          baseCentimes: contract?.baseSalaryCentimes ?? 0,
          allowanceCentimes: 0,
          overtimeCentimes: 0,
          bonusCentimes: 0,
          absenceCentimes: 0,
          advanceCentimes: 0,
          socialCentimes: 0,
          taxCentimes: 0,
          otherDeductionCentimes: 0,
          deductionLabel: null,
          grossCentimes: contract?.baseSalaryCentimes ?? 0,
          netCentimes: contract?.baseSalaryCentimes ?? 0,
          status: "DRAFT",
          paidOn: null,
          cashOperationId: null,
          notes: null,
        };

    const balance = balances[person.id] ?? {
      outstandingCentimes: 0,
      suggestedCentimes: 0,
    };

    return {
      ...row,
      jobRole: person.jobRole,
      contractBaseCentimes: contract?.baseSalaryCentimes ?? null,
      unjustifiedDays: person.attendance.length,
      dailyRateCentimes: dailyRate(
        contract?.baseSalaryCentimes ?? 0,
        context.settings.payrollWorkingDays,
      ),
      advanceOutstandingCentimes: balance.outstandingCentimes,
      // A bulletin already written keeps whatever the bursar put in the box; a
      // fresh one starts at what this month's instalments come to. Overwriting
      // a saved figure with a suggestion would undo a deliberate decision.
      advanceSuggestedCentimes: salary
        ? row.advanceCentimes
        : Math.min(balance.suggestedCentimes, balance.outstandingCentimes),
      statutory: suggestStatutory(row.grossCentimes, context.settings),
    };
  });
}

// ── Leave ────────────────────────────────────────────────────────────────────

export async function listLeave(context: AuthContext): Promise<LeaveRow[]> {
  const requests = await db.leaveRequest.findMany({
    where: { staff: schoolScope(context) },
    orderBy: [{ status: "asc" }, { startsOn: "desc" }],
    take: 100,
    include: {
      staff: { select: { code: true, firstName: true, lastName: true } },
    },
  });

  return requests.map((request) => ({
    id: request.id,
    staffId: request.staffId,
    staffName: staffName(request.staff),
    staffCode: request.staff.code,
    kind: request.kind,
    startsOn: request.startsOn.toISOString(),
    endsOn: request.endsOn.toISOString(),
    dayCount: request.dayCount,
    reason: request.reason,
    status: request.status,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    decisionNote: request.decisionNote,
  }));
}

// ── What the other modules borrow ────────────────────────────────────────────

export type StaffOption = {
  id: string;
  label: string;
  jobRole: string;
  phone: string | null;
};

/**
 * Everybody still employed, for a picker.
 *
 * This is the whole of "put a select there instead of typing a name": the fleet
 * chooses a driver from it and the caisse chooses a beneficiary from it, so a
 * bus and a payslip refer to the same person rather than to two spellings of
 * their name. Cross-module callers come through here rather than reading
 * `db.staff` themselves, which is what keeps the school scoping in one place.
 *
 * `jobRole` rides along so a caller can put its own people first without a
 * second round trip — see `listDriverOptions`.
 */
export async function listStaffOptions(
  context: AuthContext,
): Promise<StaffOption[]> {
  const staff = await db.staff.findMany({
    where: { ...schoolScope(context), status: { in: [...EMPLOYED_STATUSES] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      jobRole: true,
      phone: true,
    },
  });

  return staff.map((person) => ({
    id: person.id,
    label: `${staffName(person)} · ${person.code}`,
    jobRole: person.jobRole,
    phone: person.phone,
  }));
}

/**
 * The same list with the drivers at the top.
 *
 * Not *filtered* to drivers: a school whose caretaker takes the minibus on
 * Wednesdays would otherwise find their own employee missing from the picker and
 * go back to typing the name in, which is the thing this replaced.
 */
export async function listDriverOptions(
  context: AuthContext,
): Promise<StaffOption[]> {
  const options = await listStaffOptions(context);
  return [
    ...options.filter((person) => person.jobRole === "DRIVER"),
    ...options.filter((person) => person.jobRole !== "DRIVER"),
  ];
}

/**
 * Accounts an employment record may be linked to: this school's members who are
 * not already somebody else's.
 *
 * Scoped through `Membership` rather than the organisation, so a director
 * cannot attach another school's account to their own payroll.
 */
export async function listLinkableUsers(
  context: AuthContext,
  currentUserId: string | null,
): Promise<{ id: string; label: string }[]> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return [];

  const users = await db.user.findMany({
    where: {
      organizationId: context.user.organizationId,
      memberships: { some: { schoolId } },
      OR: [
        { staffRecord: { is: null } },
        ...(currentUserId ? [{ id: currentUserId }] : []),
      ],
    },
    orderBy: [{ email: "asc" }],
    select: {
      id: true,
      email: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });

  return users.map((user) => ({
    id: user.id,
    label: user.profile
      ? `${user.profile.firstName} ${user.profile.lastName} · ${user.email}`
      : user.email,
  }));
}

// ── The overview ─────────────────────────────────────────────────────────────

export type HrSummary = {
  headcount: number;
  activeCount: number;
  onLeaveCount: number;
  /** Employed people with no live contract — the gap a school gets fined for. */
  withoutContract: number;
  /**
   * Monthly wage bill from the live contracts, in centimes. Null without
   * `HR_PAYROLL` — the figure is withheld rather than zeroed, so the tile is
   * absent instead of claiming the school pays nothing.
   */
  monthlyPayrollCentimes: number | null;
  /** Bulletins raised for the month in question and not yet paid. */
  unpaidThisMonth: number;
  /** Null without `HR_PAYROLL`, for the same reason. */
  unpaidCentimes: number | null;
  /** Marks missing from today's register. */
  unmarkedToday: number;
  pendingLeave: number;
};

export async function hrSummary(
  context: AuthContext,
  periodYear: number,
  periodMonth: number,
): Promise<HrSummary> {
  const scope = schoolScope(context);
  const canSeePay = withPayroll(context);
  const today = startOfDay(new Date());
  const employedScope = { ...scope, status: { in: [...EMPLOYED_STATUSES] } };

  const [staff, salaries, markedToday, pendingLeave] = await Promise.all([
    db.staff.findMany({
      where: scope,
      select: {
        status: true,
        contracts: ACTIVE_CONTRACT,
      },
    }),
    db.salaryPayment.findMany({
      where: { staff: scope, periodYear, periodMonth },
      select: { status: true, netCentimes: true },
    }),
    // Scoped to the people the register actually lists, which is who
    // `listRegister` offers: a leftover mark against somebody terminated used
    // to cancel out a colleague nobody had marked, and the register read as
    // complete while a line on it was still blank.
    db.staffAttendance.count({ where: { staff: employedScope, date: today } }),
    db.leaveRequest.count({ where: { staff: scope, status: "PENDING" } }),
  ]);

  const employed = staff.filter((person) =>
    (EMPLOYED_STATUSES as readonly string[]).includes(person.status),
  );

  const unpaid = salaries.filter((salary) =>
    (PAYABLE_SALARY_STATUSES as readonly string[]).includes(salary.status),
  );

  return {
    headcount: employed.length,
    activeCount: staff.filter((person) => person.status === "ACTIVE").length,
    onLeaveCount: staff.filter((person) => person.status === "ON_LEAVE").length,
    withoutContract: employed.filter((person) => person.contracts.length === 0)
      .length,
    monthlyPayrollCentimes: canSeePay
      ? employed.reduce(
          (total, person) =>
            total + (person.contracts[0]?.baseSalaryCentimes ?? 0),
          0,
        )
      : null,
    unpaidThisMonth: unpaid.length,
    unpaidCentimes: canSeePay
      ? unpaid.reduce((total, salary) => total + salary.netCentimes, 0)
      : null,
    unmarkedToday: Math.max(0, employed.length - markedToday),
    pendingLeave,
  };
}

// ── Avances sur salaire ──────────────────────────────────────────────────────

/**
 * `YYYY-MM-DD` in local time, or null.
 *
 * Never `toISOString().slice(0, 10)`: that reads the *UTC* day, and every
 * date-only value in a timezone ahead of UTC — which Morocco is — comes back a
 * day early. See the note on `toDateInputValue`.
 */
function dayOrNull(value: Date | null): string | null {
  return value ? toDateInputValue(value) : null;
}

export type AdvanceRow = {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  jobRole: string;
  amountCentimes: number;
  instalmentCount: number;
  status: string;
  requestedOn: string;
  reason: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  decisionNote: string | null;
  paidOn: string | null;
  cashOperationId: string | null;
  /** Taken back so far, summed from the recoveries — never a stored total. */
  recoveredCentimes: number;
  /** What is still owed. Derived; see `outstandingAdvance`. */
  outstandingCentimes: number;
  notes: string | null;
};

/**
 * Every avance, newest first.
 *
 * The recoveries are summed here rather than on the client because the
 * outstanding figure is what a school will act on — refusing a fourth advance,
 * or chasing a leaver — and it must be computed in one place so the list, the
 * payroll screen and the employee's file cannot disagree about it.
 */
export async function listAdvances(
  context: AuthContext,
): Promise<AdvanceRow[]> {
  const advances = await db.salaryAdvance.findMany({
    where: { staff: schoolScope(context) },
    orderBy: [{ requestedOn: "desc" }],
    select: {
      id: true,
      amountCentimes: true,
      instalmentCount: true,
      status: true,
      requestedOn: true,
      reason: true,
      approvedAt: true,
      decisionNote: true,
      paidOn: true,
      cashOperationId: true,
      notes: true,
      staff: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          jobRole: true,
        },
      },
      approvedBy: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      recoveries: { select: { amountCentimes: true } },
    },
  });

  return advances.map((advance) => {
    const recoveredCentimes = advance.recoveries.reduce(
      (total, row) => total + row.amountCentimes,
      0,
    );

    return {
      id: advance.id,
      staffId: advance.staff.id,
      staffName: staffName(advance.staff),
      staffCode: advance.staff.code,
      jobRole: advance.staff.jobRole,
      amountCentimes: advance.amountCentimes,
      instalmentCount: advance.instalmentCount,
      status: advance.status,
      requestedOn: toDateInputValue(advance.requestedOn),
      reason: advance.reason,
      approvedByName: advance.approvedBy
        ? displayName(advance.approvedBy)
        : null,
      approvedAt: dayOrNull(advance.approvedAt),
      decisionNote: advance.decisionNote,
      paidOn: dayOrNull(advance.paidOn),
      cashOperationId: advance.cashOperationId,
      recoveredCentimes,
      outstandingCentimes: outstandingAdvance({
        status: advance.status,
        amountCentimes: advance.amountCentimes,
        recoveredCentimes,
      }),
      notes: advance.notes,
    };
  });
}
