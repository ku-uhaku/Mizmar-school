/**
 * RH translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  hr: {
    title: "Human resources",
    subtitle:
      "Everybody the school pays, and what follows from employing them.",

    // ── People ──────────────────────────────────────────────────────────────
    staff: "Staff",
    employee: "Employee",
    newStaff: "New employee",
    editStaff: "Edit employee",
    code: "Staff number",
    codeHint: "Leave blank and one is generated, e.g. P-2025-0007.",
    firstName: "First name",
    lastName: "Surname",
    firstNameAr: "First name (Arabic)",
    lastNameAr: "Surname (Arabic)",
    gender: "Gender",
    birthDate: "Date of birth",
    birthPlace: "Place of birth",
    nationalId: "CIN",
    cnssNumber: "CNSS number",
    cnssHint: "Null until the affiliation comes back, which takes weeks.",
    bankRib: "RIB",
    phone: "Phone",
    email: "Email",
    address: "Address",
    jobRole: "Job",
    jobTitle: "Title on the contract",
    jobTitleHint:
      "What the attestation prints, e.g. “Professeur de mathématiques”.",
    department: "Service",
    staffStatus: "Status",
    hiredOn: "Started",
    leftOn: "Left",
    account: "Login account",
    accountHint:
      "Only for employees who sign in. Most of the payroll does not.",
    noAccount: "No account",
    accountTaken: "That account already belongs to another employee.",
    createAccount: "Create a login for this employee",
    createAccountHint:
      "They will sign in with the username below. Leave it off for staff who never sign in — a driver, a caretaker.",
    accountRole: "Role in this school",
    accountRoleHint:
      "What they may do once signed in. Leave blank for a login with no permissions.",
    accountPassword: "Initial password",
    accountPasswordHint:
      "Give it to them in person; they can change it from their profile.",
    accountNeedsEmail: "An email address is required to create a login.",
    accountNeedsPassword: "Set an initial password for the new login.",
    accountNeedsUsername:
      "Type a username — one cannot be built from this name.",
    accountCreated: "Employee saved, and their login created.",
    codeTaken: "That staff number is already used.",
    notes: "Notes",
    staffCreated: "Employee added.",
    staffUpdated: "Employee updated.",
    staffDeleted: "Employee removed.",
    staffHasPayslips:
      "This employee has payslips — mark them as having left instead of deleting them.",
    deleteStaffTitle: "Remove this employee?",
    deleteStaffBody: "“{name}” will be removed from the payroll.",
    noStaff: "Nobody on the payroll yet.",
    headcount: "Headcount",

    // ── Hiring ──────────────────────────────────────────────────────────────
    /** The whole act — see modules/hr/components/hire-form.tsx. */
    hire: "Hire",
    hireSubtitle:
      "The employment record, the login, the contract and what they take on — in one go.",
    hireHint: "Only the name is required. Everything else can wait.",
    sections: "Sections",
    identity: "Identity",
    identityHint:
      "As it appears on the CIN — the contract and the CNSS declaration are issued from it.",
    posting: "Post",
    postingHint: "What they were taken on to do, and where it sits.",
    contact: "Contact",
    contactHint: "How the school reaches them.",
    contract: "Contract",
    contractSectionHint:
      "What they are engaged on. A renewal later is a new contract, not an edit to this one.",
    withContract: "Sign a contract now",
    withContractHint:
      "Leave it off and they are employed with nothing signed — the gap an inspection finds.",
    access: "Login",
    accessHint: "Whether they sign in, and what they may do once they have.",
    accountNotPermitted: "You may not create login accounts.",
    noPermissions: "A login with no permissions",
    emailIsLogin: "Also the address their account is opened on.",
    jobFunctionNeedsAccount:
      "La fonction sits on the login — turn one on to set it.",
    maxWeeklyMinutes: "Weekly teaching cap",
    maxWeeklyMinutesHint:
      "In minutes. The generator will not give them a twenty-fifth hour. Blank uses the week's own ceiling.",
    teaching: "Subjects",
    teachingHint:
      "What this teacher may be given — the input the timetable generator makes its assignments from.",
    subjects: "Subjects they may take",
    subjectsHint:
      "What they could teach, not what they have been given. Preference and individual niveaux are set later, under Configuration.",
    subjectsNeedAccount:
      "A qualification hangs off the login — turn one on to declare subjects.",
    subjectsNotPermitted: "You may not declare who teaches what.",
    noSubjects: "The school has no subjects in its cursus yet.",
    qualificationCycle: "Cycle",
    qualificationCycleHint:
      "Where the qualification applies. Leave it on every cycle for somebody who takes the subject wherever it is taught.",
    everyCycle: "Every cycle",
    busSection: "Bus",
    busHint: "The vehicles this driver takes out.",
    buses: "Buses driven",
    busesHint: "Assigning one here replaces whoever was named on it.",
    busesNotPermitted: "You may not reassign the fleet.",
    noVehicles: "The school has no vehicle on its fleet.",

    // ── Section dashboard ───────────────────────────────────────────────────
    staffHint: "Everybody the school pays, and the contract each one is on.",
    attendanceHint: "Who came in today, and who nobody has marked yet.",
    payrollHint: "The month's payslips, and paying them out of the caisse.",
    leaveHint: "Requests waiting on a decision, and the leave already granted.",
    unmarkedCount: "{count} unmarked",
    registerComplete: "All marked",
    unpaidCount: "{count} awaiting payment",
    onLeaveCount: "{count} on leave",
    unmarkedTodayHint: "Marks missing from today's register",
    pendingLeaveHint: "Requests nobody has decided on yet.",
    byRole: "Who works here",
    byRoleHint: "Active employees by the job they hold.",
    noPendingLeave: "No request is waiting on a decision.",
    withoutContract: "No live contract",
    withoutContractHint:
      "Employed with nothing signed — the gap an inspection finds.",
    monthlyPayroll: "Monthly wage bill",

    // ── Contracts ───────────────────────────────────────────────────────────
    contracts: "Contracts",
    newContract: "New contract",
    editContract: "Edit contract",
    contractKind: "Type",
    startsOn: "From",
    endsOn: "Until",
    endsOnHint:
      "Leave blank for a CDI — an open-ended contract has no end date.",
    trialEndsOn: "Trial ends",
    baseSalary: "Monthly base salary",
    baseSalaryHint:
      "Gross, in dirhams. What was actually paid in a month is its payslip.",
    weeklyHours: "Hours a week",
    contractStatus: "Status",
    contractSaved: "Contract saved.",
    contractEnded: "Contract ended.",
    /** The button. `contractEnded` is the toast that follows it. */
    endContract: "End contract",
    endContractTitle: "End this contract?",
    endContractBody: "“{name}” will be left without a live contract.",
    noContracts: "No contract signed.",
    supersededNote:
      "Making a contract live ends the one it replaces, so nobody is ever left with two or none.",
    endBeforeStart: "The end date cannot be before the start date.",

    // ── The register ────────────────────────────────────────────────────────
    attendance: "Attendance",
    day: "Day",
    unmarked: "Not marked",
    unmarkedToday: "Not marked today",
    attendanceStatus: "Status",
    justified: "Justified",
    justifiedHint:
      "A certificate was produced. Only unjustified days are totalled.",
    minutesLate: "Minutes late",
    recordedBy: "Marked by",
    attendanceSaved: "Register updated.",
    markEveryoneElse: "Mark everyone else present",
    bulkMarked: "{count} marked present.",
    nothingToMark: "Everybody has already been marked.",
    bulkHint:
      "Only fills the gaps — an absence already recorded is never overwritten.",
    unjustifiedAbsences: "Unjustified absences",

    // ── Payroll ─────────────────────────────────────────────────────────────
    payroll: "Payroll",
    period: "Month",
    editPayslip: "Edit payslip",
    gains: "Earnings",
    base: "Base salary",
    allowance: "Allowances",
    allowanceHint: "Transport, panier, seniority, responsibility.",
    overtime: "Overtime",
    overtimeHint: "Also where an hourly employee's whole pay goes.",
    bonus: "Bonus",
    deductions: "Deductions",
    absenceDeduction: "Absence",
    absenceDeductionHint:
      "{days} unjustified days this month. One day is worth about {rate}.",
    advance: "Advance recovered",
    social: "CNSS / AMO",
    tax: "Income tax",
    otherDeduction: "Other",
    deductionLabel: "What for",
    gross: "Gross",
    net: "Net payable",
    netHint: "Always computed from the lines above, never typed in.",
    payslipStatus: "Status",
    salarySaved: "Payslip saved.",
    alreadyPaid: "This payslip has been paid — cancel the payment first.",
    salaryCancelled: "This payslip was cancelled.",
    nothingToPay: "Nothing to pay on this payslip.",
    noPayslip: "Not prepared",
    behindContract: "Differs from the contract's base salary.",
    payrollTotal: "Payroll for the month",
    unpaidThisMonth: "Awaiting payment",

    // ── Paying ──────────────────────────────────────────────────────────────
    pay: "Pay",
    paySalary: "Pay this payslip",
    paySalaryBody:
      "“{name}” will be paid {amount}. A décaissement is written in the cash desk — this screen never moves money on its own.",
    method: "Method",
    paidOn: "Paid on",
    reference: "Reference",
    chequeNumber: "Cheque number",
    bankName: "Bank",
    expenseCategory: "Expense category",
    noOpenSession: "No till is open — open one before paying in cash.",
    salaryPaid: "Payslip paid.",
    ledgerNote:
      "What is owed lives here; what actually left lives in the cash desk. Neither is summed from the other.",

    // ── Leave ───────────────────────────────────────────────────────────────
    leave: "Leave",
    newLeave: "Request leave",
    editLeave: "Edit request",
    leaveKind: "Type",
    dayCount: "Working days",
    dayCountHint:
      "Not the span between the dates — Saturdays, holidays and school breaks all differ.",
    reason: "Reason",
    leaveStatus: "Status",
    decisionNote: "Note on the decision",
    decidedOn: "Decided",
    approve: "Approve",
    reject: "Reject",
    leaveSaved: "Request saved.",
    leaveApproved: "Leave approved.",
    leaveDecided: "Decision recorded.",
    leaveDeleted: "Request removed.",
    deleteLeaveTitle: "Remove this request?",
    deleteLeaveBody: "“{name}”'s request will be removed.",
    noLeave: "No leave requested.",
    pendingLeave: "Awaiting a decision",
    leaveThisYear: "Leave days this year",
    leaveStatusNote:
      "Approving leave that covers today puts the employee on leave, so the register does not mark them absent.",
    // ── Avances sur salaire ────────────────────────────────────────────────
    advances: "Salary advances",
    advancesHint:
      "Money handed over before payday, and what is still owed on it.",
    newAdvance: "New advance",
    editAdvance: "Edit request",
    advanceAmount: "Amount",
    advanceInstalments: "Recovered over",
    advanceInstalmentsHint:
      "How many months to take it back over. The last one is whatever is left.",
    advanceReason: "Reason",
    advanceRecovered: "Recovered",
    advanceOutstanding: "Still owed",
    advanceRequested: "Advance requested.",
    advanceSaved: "Request updated.",
    advanceApproved: "Advance approved.",
    advanceRefused: "Advance refused.",
    advancePaid: "Advance handed over.",
    advanceLocked:
      "This request has already been decided \u2014 it can no longer be edited.",
    advanceAlreadyDecided: "This request has already been decided.",
    advanceAlreadyPaid: "This advance has already been handed over.",
    advanceNotApproved: "Approve the advance before handing the money over.",
    advanceOverRecovered:
      "That is more than is owed on this employee\u2019s advances ({amount} outstanding).",
    noAdvances: "No advance has been asked for.",
    noAdvancesHint: "Raise one when somebody needs money before payday.",
    payAdvance: "Hand over",
    payAdvanceAmount: "Hand over {amount}",
    refuse: "Refuse",
    statutorySuggested: "Suggested from the school\u2019s rates",

    // ── The employee file ────────────────────────────────────────────────
    tabDossier: "File",
    tabService: "Duties",
    tabPay: "Pay",
    weeklyLoad: "Weekly load",
    weeklyLoadCeiling: "of {hours}h contracted",
    weeklyLoadNoCeiling: "On the school's own ceiling",
    hoursShort: "h",
    hoursPerWeek: "Hours a week",
    pupilsTaught: "Pupils taught",
    pupils: "Pupils",
    classCount: "across {count} classes",
    classLabel: "Class",
    subject: "Subject",
    group: "Group",
    wholeClass: "Whole class",
    coTeacher: "Co-teacher",
    teachingService: "Classes taught",
    transportService: "Fleet",
    busesDriven: "Buses",
    seatCount: "{count} seats",
    lineCount: "{count} lines this year",
    lineLoad: "{riders} riders · {stops} stops",
    noLine: "This bus runs no line this year.",
    dutyDriver: "Driver",
    dutyAttendant: "Attendant",
    insuranceExpires: "Insurance",
    inspectionExpires: "Inspection",
    noService: "Nothing assigned",
    noServiceHint: "No class is taught and no bus is driven by this employee.",
    noServiceNoAccount:
      "Teaching assignments follow the login account, and this employee has none — create one to see their classes here.",
    lastNet: "Last net pay",
    noPayslipYet: "No payslip issued yet.",
    leaveDaysTaken: "{count} leave days this year",
  },
  hrOptions: {
    jobRoles: {
      TEACHER: "Teacher",
      DIRECTOR: "Head",
      SUPERVISOR: "Supervisor",
      SECRETARY: "Secretary",
      ACCOUNTANT: "Bursar",
      NURSE: "Nurse",
      DRIVER: "Driver",
      MAINTENANCE: "Maintenance",
      SECURITY: "Security",
      OTHER: "Other",
    },
    departments: {
      TEACHING: "Teaching",
      ADMINISTRATION: "Administration",
      TRANSPORT: "Transport",
      FACILITIES: "Facilities",
      HEALTH: "Health",
    },
    staffStatuses: {
      ACTIVE: "In post",
      ON_LEAVE: "On leave",
      SUSPENDED: "Suspended",
      TERMINATED: "Left",
    },
    contractKinds: {
      CDI: "CDI",
      CDD: "CDD",
      ANAPEC: "ANAPEC",
      INTERIM: "Cover",
      VACATAIRE: "Hourly",
      STAGE: "Placement",
    },
    contractStatuses: {
      DRAFT: "Draft",
      ACTIVE: "Live",
      ENDED: "Ended",
    },
    attendanceStatuses: {
      PRESENT: "Present",
      ABSENT: "Absent",
      LATE: "Late",
      LEAVE: "On leave",
      SICK: "Sick",
      MISSION: "On mission",
      HOLIDAY: "School closed",
    },
    salaryStatuses: {
      DRAFT: "Draft",
      APPROVED: "Approved",
      PAID: "Paid",
      CANCELLED: "Cancelled",
    },
    leaveKinds: {
      ANNUAL: "Annual",
      SICK: "Sick",
      UNPAID: "Unpaid",
      MATERNITY: "Maternity",
      PATERNITY: "Paternity",
      EXCEPTIONAL: "Exceptional",
    },
    advanceStatuses: {
      REQUESTED: "Requested",
      APPROVED: "Approved",
      PAID: "Handed over",
      RECOVERED: "Recovered",
      CANCELLED: "Refused",
    },
    leaveStatuses: {
      PENDING: "Awaiting a decision",
      APPROVED: "Approved",
      REJECTED: "Refused",
      CANCELLED: "Cancelled",
    },
    payoutMethods: {
      CASH: "Cash",
      CHEQUE: "Cheque",
      BANK_TRANSFER: "Bank transfer",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  hrStaff: "Staff",
  hrAttendance: "Attendance",
  hrPayroll: "Payroll",
  hrAdvances: "Advances",
  hrLeave: "Leave",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    hr: "Human resources",
  },
  codes: {
    "hr.view": "View staff",
    "hr.manage": "Manage staff files and leave",
    "hr.attendance": "Mark the register",
    "hr.payroll": "See and prepare the payroll",
    "hr.delete": "Delete staff records",
  },
} as const;

export default en;
