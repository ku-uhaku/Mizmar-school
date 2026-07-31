/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/hr/*.prisma` — plus the payroll arithmetic.
 *
 * Pure data and pure functions: this crosses to the client, where the bulletin
 * form previews a net figure with the very same function the service posts it
 * with. A form that added up a payslip differently from the action that saves it
 * would hand somebody a document for the wrong amount.
 *
 * Every amount here is an integer number of **centimes of dirham**, exactly as
 * in `modules/treasury/enums.ts`. Nothing is a float: these numbers are what
 * somebody is owed.
 */

import { nullableKey } from "@/lib/db-keys";

/**
 * What somebody is employed to do.
 *
 * One list rather than a role plus a department — see the note on
 * `Staff.jobRole`. It is deliberately short: a school wants to filter its
 * payroll by "the teachers" and "the bus", not to reproduce a national
 * nomenclature. Anything finer goes in `jobTitle`, which is free text and is
 * what the attestation prints.
 */
export const JOB_ROLES = [
  "TEACHER",
  "DIRECTOR",
  "SUPERVISOR",
  "SECRETARY",
  "ACCOUNTANT",
  "NURSE",
  "DRIVER",
  "MAINTENANCE",
  "SECURITY",
  "OTHER",
] as const;
export type JobRole = (typeof JOB_ROLES)[number];

/**
 * The service a job belongs to. Grouping only — the payroll screen totals by it
 * and the fleet asks for it, so it is derived here rather than stored beside the
 * role where the two could disagree.
 */
export const DEPARTMENTS = [
  "TEACHING",
  "ADMINISTRATION",
  "TRANSPORT",
  "FACILITIES",
  "HEALTH",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

const DEPARTMENT_OF: Record<JobRole, Department> = {
  TEACHER: "TEACHING",
  SUPERVISOR: "TEACHING",
  DIRECTOR: "ADMINISTRATION",
  SECRETARY: "ADMINISTRATION",
  ACCOUNTANT: "ADMINISTRATION",
  OTHER: "ADMINISTRATION",
  DRIVER: "TRANSPORT",
  MAINTENANCE: "FACILITIES",
  SECURITY: "FACILITIES",
  NURSE: "HEALTH",
};

export function departmentOf(jobRole: string): Department {
  return DEPARTMENT_OF[jobRole as JobRole] ?? "ADMINISTRATION";
}

/**
 * Where an employee stands.
 *
 *   ACTIVE      on the payroll and expected in
 *   ON_LEAVE    away on approved leave — still paid, still counted as staff
 *   SUSPENDED   suspended pending a decision
 *   TERMINATED  gone
 *
 * Typed in rather than derived from the contracts — see the note on the column.
 */
export const STAFF_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

/** Statuses that mean somebody is still on the books, and still gets a bulletin. */
export const EMPLOYED_STATUSES: readonly StaffStatus[] = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
];

/**
 * The kinds of engagement a Moroccan school actually signs.
 *
 *   CDI        contrat à durée indéterminée
 *   CDD        contrat à durée déterminée
 *   ANAPEC     contrat d'insertion
 *   INTERIM    intérim / remplacement
 *   VACATAIRE  paid by the hour, no monthly base — see EmploymentContract
 *   STAGE      stage, conventionné or not
 */
export const CONTRACT_KINDS = [
  "CDI",
  "CDD",
  "ANAPEC",
  "INTERIM",
  "VACATAIRE",
  "STAGE",
] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** Whether a contract is the one currently in force. */
export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "ENDED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * Builds `EmploymentContract.activeKey`, which is what stops one employee
 * holding two live contracts.
 *
 * The staff id while the contract is ACTIVE, null otherwise — so SQLite's
 * "NULLs are distinct" behaviour exempts every draft and ended contract from the
 * unique index while admitting only one live one. See lib/db-keys.ts for the
 * general pattern, and `openSessionKey` for the same trick on a till.
 */
export function activeContractKey(
  staffId: string,
  status: ContractStatus,
): string | null {
  return status === "ACTIVE" ? nullableKey(staffId) : null;
}

/**
 * Where a bulletin has got to.
 *
 *   DRAFT      being prepared; figures still move
 *   APPROVED   agreed, awaiting payment
 *   PAID       the money has left — a décaissement points back at it
 *   CANCELLED  raised in error; kept, never deleted, and excluded from totals
 */
export const SALARY_STATUSES = [
  "DRAFT",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;
export type SalaryStatus = (typeof SALARY_STATUSES)[number];

/** Bulletins that still represent money the school owes. */
export const PAYABLE_SALARY_STATUSES: readonly SalaryStatus[] = [
  "DRAFT",
  "APPROVED",
];

/**
 * How a day was spent.
 *
 *   PRESENT  came in
 *   ABSENT   did not
 *   LATE     came in late — `minutesLate` says how late
 *   LEAVE    approved congé
 *   SICK     maladie
 *   MISSION  away on the school's business — a sortie, a formation
 *   HOLIDAY  the school was closed
 *
 * HOLIDAY is a status rather than an absence of a row so that a register with no
 * mark against somebody means "nobody marked it", which is a different problem
 * from "there was nothing to mark".
 */
export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "LEAVE",
  "SICK",
  "MISSION",
  "HOLIDAY",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Statuses that count as being at work. */
export const AT_WORK_STATUSES: readonly AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "MISSION",
];

/**
 * Statuses that count against somebody when unjustified — what the payroll
 * screen totals beside the retenue box.
 *
 * LEAVE and HOLIDAY are never in this list at any justification: approved time
 * off is not a lapse, and neither is a closed school.
 */
export const CHARGEABLE_ABSENCE_STATUSES: readonly AttendanceStatus[] = [
  "ABSENT",
  "SICK",
];

/** Whether one register mark is an absence the bursar should be shown. */
export function isChargeableAbsence(
  status: string,
  isJustified: boolean,
): boolean {
  if (isJustified) return false;
  return CHARGEABLE_ABSENCE_STATUSES.includes(status as AttendanceStatus);
}

/** Why somebody is away. */
export const LEAVE_KINDS = [
  "ANNUAL",
  "SICK",
  "UNPAID",
  "MATERNITY",
  "PATERNITY",
  "EXCEPTIONAL",
] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// ── Payroll ──────────────────────────────────────────────────────────────────

/** The four things that make up what somebody earned this month. */
export type SalaryGains = {
  baseCentimes: number;
  allowanceCentimes: number;
  overtimeCentimes: number;
  bonusCentimes: number;
};

/** The five things that come off it. */
export type SalaryDeductions = {
  absenceCentimes: number;
  advanceCentimes: number;
  socialCentimes: number;
  taxCentimes: number;
  otherDeductionCentimes: number;
};

/** Salaire brut — everything earned, before anything is withheld. */
export function grossSalary(gains: SalaryGains): number {
  return (
    gains.baseCentimes +
    gains.allowanceCentimes +
    gains.overtimeCentimes +
    gains.bonusCentimes
  );
}

/** Total des retenues. */
export function totalDeductions(deductions: SalaryDeductions): number {
  return (
    deductions.absenceCentimes +
    deductions.advanceCentimes +
    deductions.socialCentimes +
    deductions.taxCentimes +
    deductions.otherDeductionCentimes
  );
}

/**
 * Net à payer.
 *
 * Floored at zero: retenues exceeding the month's pay is a data-entry slip, and
 * a negative bulletin would turn into a décaissement the school collects *from*
 * an employee. What is genuinely owed back is recovered as an `advanceCentimes`
 * on the following month, which is how a bursar does it on paper.
 */
export function netSalary(
  gains: SalaryGains,
  deductions: SalaryDeductions,
): number {
  return Math.max(0, grossSalary(gains) - totalDeductions(deductions));
}

/**
 * The rate a day of absence costs, from a monthly salary.
 *
 * Twenty-six days is the Moroccan convention for converting a monthly wage into
 * a daily one — the working days in a month under a six-day week — and it is
 * what a labour inspector expects to see. Offered to the payroll screen as a
 * suggestion beside the retenue box; nothing applies it on its own, for the
 * reason given on `SalaryPayment.absenceCentimes`.
 */
export const WORKING_DAYS_PER_MONTH = 26;

export function dailyRate(monthlySalaryCentimes: number): number {
  return Math.round(monthlySalaryCentimes / WORKING_DAYS_PER_MONTH);
}

// ── Dates ────────────────────────────────────────────────────────────────────

/**
 * Midnight of the day a moment falls in, in local time.
 *
 * Every attendance row is normalised through this, which is what makes the
 * unique index on `(staffId, date)` bite — see the note on the column. Local
 * rather than UTC on purpose: a register is marked in the morning at the school,
 * and a UTC day would put a mark made at 00:30 in Casablanca on the day before.
 */
export function startOfDay(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Calendar days a range spans, both ends included — the leave form's default. */
export function spanInDays(startsOn: Date, endsOn: Date): number {
  const start = startOfDay(startsOn).getTime();
  const end = startOfDay(endsOn).getTime();
  if (end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Matricules look like `P-2025-0007`. Same shape as a pupil's, different letter. */
export const STAFF_CODE_PREFIX = "P";

export function nextStaffCode(year: number, sequence: number): string {
  return `${STAFF_CODE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

/** "septembre 2025" as a sortable key — what the payroll screen groups on. */
export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Somebody's full name, in one place.
 *
 * Everything that shows an employee — the fleet's driver column, the ledger's
 * beneficiary, the payroll list — goes through this, so a school that enters
 * names in two cases does not get them rendered three ways.
 */
export function staffName(staff: {
  firstName: string;
  lastName: string;
}): string {
  return `${staff.firstName} ${staff.lastName}`.trim();
}
