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
 * The jobs that may be put in front of a class.
 *
 * ── Why this is not `departmentOf(role) === "TEACHING"` ──────────────────────
 * SUPERVISOR is in the teaching *department* — a surveillant général's work is
 * academic and the payroll groups them with the teachers — but they do not take
 * lessons. Reusing the department here is what put the school's manager in every
 * teacher picker: on a class, on a timetable slot, on the availability grid, and
 * on any `@teachers` reference in the configuration.
 *
 * The two questions are genuinely different, so they get two lists. "Which
 * service does this job belong to" is `departmentOf`; "may this person be given a
 * lesson" is this. A school that wants its surveillant to teach adds them here,
 * which is a code change on purpose: it changes who may be handed a class.
 *
 * Written as a list rather than `=== "TEACHER"` because a school with vacataires
 * or a teaching director is the obvious next request, and a one-item list is the
 * honest place to put the second entry.
 */
export const TEACHING_JOB_ROLES = ["TEACHER"] as const satisfies readonly JobRole[];

/** Whether somebody in this job may be given a lesson. */
export function isTeachingRole(jobRole: string): boolean {
  return (TEACHING_JOB_ROLES as readonly string[]).includes(jobRole);
}

/**
 * The jobs that are given a part of the school to run.
 *
 * A directeur and a surveillant général are not assigned lessons or a bus —
 * they are answerable for a cycle, which is what `StaffOversight` records. The
 * two are listed rather than derived from `departmentOf`, for the same reason
 * `TEACHING_JOB_ROLES` is: a surveillant is in the teaching department and does
 * not take lessons, and the questions are genuinely different.
 */
export const OVERSIGHT_JOB_ROLES = [
  "DIRECTOR",
  "SUPERVISOR",
] as const satisfies readonly JobRole[];

/** Whether somebody in this job is answerable for a cycle. */
export function isOversightRole(jobRole: string): boolean {
  return (OVERSIGHT_JOB_ROLES as readonly string[]).includes(jobRole);
}

/**
 * The access a job comes with, when nobody says otherwise.
 *
 * Hiring a teacher and then leaving their login with no permissions is the
 * commonest way somebody ends up unable to enter a mark on their first day, so
 * the job answers the question by default. Only a default: the form still
 * offers the whole list, and a director who picks something else is obeyed.
 *
 * Matched by **name** against `SYSTEM_ROLES` — those are the roles every
 * organisation is seeded with and the only ones that cannot be renamed, so the
 * match is stable. A job with no obvious answer maps to null and the account is
 * opened with no role at all, which `createLoginAccount` treats as a real
 * answer rather than a half-finished account.
 */
const DEFAULT_ROLE_NAME_OF: Record<JobRole, string | null> = {
  TEACHER: "Enseignant",
  DIRECTOR: "Directeur d'école",
  SECRETARY: "Secrétaire",
  DRIVER: "Chauffeur",
  // No system role fits these, and guessing one would grant more than the job
  // asks for. They are opened without permissions until a director picks.
  SUPERVISOR: null,
  ACCOUNTANT: null,
  NURSE: null,
  MAINTENANCE: null,
  SECURITY: null,
  OTHER: null,
};

/** The system role a job is given by default, or null when none fits. */
export function defaultRoleNameFor(jobRole: string): string | null {
  return DEFAULT_ROLE_NAME_OF[jobRole as JobRole] ?? null;
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
 * The staff id while the contract is ACTIVE, null otherwise — so MySQL's
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

export function dailyRate(
  monthlySalaryCentimes: number,
  workingDays: number = WORKING_DAYS_PER_MONTH,
): number {
  return Math.round(monthlySalaryCentimes / Math.max(1, workingDays));
}

// ── Avances sur salaire ──────────────────────────────────────────────────────

/**
 * Where an avance sur salaire has got to.
 *
 *   REQUESTED  asked for; nothing has left and nothing is owed
 *   APPROVED   agreed to, but the money is still in the till
 *   PAID       handed over — this is the first status that owes anything back
 *   RECOVERED  taken back in full out of the payslips that followed
 *   CANCELLED  refused, or withdrawn before the money left
 *
 * RECOVERED is *derived and then stamped*: it is set the moment the recoveries
 * add up to the amount, so a list can be filtered on it without every reader
 * re-summing the join. `outstandingAdvance` below is the authority, and the
 * status only ever follows it.
 */
export const ADVANCE_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "PAID",
  "RECOVERED",
  "CANCELLED",
] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

/**
 * Statuses whose money has actually left the school.
 *
 * The only ones that may be recovered out of a wage: deducting against an
 * advance that was merely approved would take money off somebody who never
 * received any.
 */
export const OWED_ADVANCE_STATUSES: readonly AdvanceStatus[] = [
  "PAID",
  "RECOVERED",
];

/** Statuses a decision may still be made about. */
export function isAdvanceDecidable(status: string): boolean {
  return status === "REQUESTED";
}

/** Whether the money may now be handed over. */
export function isAdvancePayable(status: string): boolean {
  return status === "APPROVED";
}

/**
 * What is still owed on one advance.
 *
 * Derived from the recoveries rather than kept as a running total, for the same
 * reason a dossier's completeness is derived: a stored balance that can
 * disagree with the payslips underneath it is worse than no balance at all.
 * Floored at zero so an over-recovery — which the service refuses, but which a
 * hand-edited row could still produce — reads as settled rather than negative.
 */
export function outstandingAdvance(advance: {
  status: string;
  amountCentimes: number;
  recoveredCentimes: number;
}): number {
  if (!OWED_ADVANCE_STATUSES.includes(advance.status as AdvanceStatus)) return 0;
  return Math.max(0, advance.amountCentimes - advance.recoveredCentimes);
}

/**
 * What one month should take back, when an advance is spread over instalments.
 *
 * The plan, not the rule: the last instalment is whatever is left, so rounding
 * never leaves a stray centime owed for ever. A bursar may still type something
 * else — an employee having a hard month is exactly why the box stays editable.
 */
export function advanceInstalment(advance: {
  status: string;
  amountCentimes: number;
  recoveredCentimes: number;
  instalmentCount: number;
}): number {
  const outstanding = outstandingAdvance(advance);
  if (outstanding === 0) return 0;

  const perMonth = Math.round(
    advance.amountCentimes / Math.max(1, advance.instalmentCount),
  );
  return Math.min(outstanding, Math.max(1, perMonth));
}

// ── Cotisations et retenues légales ──────────────────────────────────────────

export type StatutoryRates = {
  cnssRateBps: number;
  cnssCeilingCentimes: number;
  amoRateBps: number;
  irRateBps: number;
};

export type StatutorySuggestion = {
  /** CNSS + AMO, which is what the `socialCentimes` box holds. */
  socialCentimes: number;
  /** Shown apart so the screen can explain where the figure came from. */
  cnssCentimes: number;
  amoCentimes: number;
  taxCentimes: number;
};

/**
 * What the CNSS, AMO and IR boxes should probably say for a given gross.
 *
 * ── A suggestion, and deliberately not a payroll engine ─────────────────────
 * Every figure lands in a box the bursar can overwrite, and nothing applies
 * itself. The rates move by decree, a school may be on a different convention
 * collective, and the Moroccan IR is a progressive barème with a deduction per
 * dependant — a single rate cannot express it and pretending otherwise would
 * put wrong numbers on a legal document with nobody's name against them.
 *
 * The CNSS ceiling is the one piece of real structure here, because getting it
 * wrong is not a rounding error: above 6 000 MAD a month the employee's share
 * stops growing, and computing it on the whole gross overstates the deduction
 * for every senior member of staff.
 */
export function suggestStatutory(
  grossCentimes: number,
  rates: StatutoryRates,
): StatutorySuggestion {
  const applyBps = (base: number, bps: number) =>
    Math.max(0, Math.round((base * bps) / 10_000));

  const cnssBase =
    rates.cnssCeilingCentimes > 0
      ? Math.min(grossCentimes, rates.cnssCeilingCentimes)
      : grossCentimes;

  const cnssCentimes = applyBps(cnssBase, rates.cnssRateBps);
  const amoCentimes = applyBps(grossCentimes, rates.amoRateBps);

  return {
    cnssCentimes,
    amoCentimes,
    socialCentimes: cnssCentimes + amoCentimes,
    // On the gross rather than on the net taxable: the real base is net of the
    // cotisations and of the frais professionnels, which is another thing a
    // flat rate cannot express. Left simple, and left editable.
    taxCentimes: applyBps(grossCentimes, rates.irRateBps),
  };
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
