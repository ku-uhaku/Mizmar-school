/**
 * Audit translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 *
 * `auditEntities` names every table the trail can mention. It is long because
 * the schema is long: an entry reading "SupplyItem" is a row from a database a
 * director never sees, and one reading "Supply line" is something they can act
 * on. Field names inside a diff are deliberately *not* translated — they are
 * shown as the schema spells them, because a trail is evidence and renaming
 * `feeAmount` to "Amount" in one language and not another makes two entries of
 * one event.
 */
const en = {
  audit: {
    title: "Activity log",
    subtitle: "Everything that was created, changed or deleted — and by whom.",
    empty: "Nothing recorded yet.",
    emptyHint: "Entries appear here as soon as anybody changes anything.",
    noMatches: "No activity matches these filters.",
    // ── The row ─────────────────────────────────────────────────────────────
    when: "When",
    who: "Who",
    what: "What",
    record: "Record",
    changesCount: "{count} fields",
    oneChange: "1 field",
    noDetail: "No detail recorded.",
    from: "From",
    to: "To",
    added: "added",
    removed: "removed",
    redacted: "hidden",
    openRecord: "Open the record",
    deletedRecord: "This record no longer exists.",
    affectedRows: "{count} rows",
    truncatedIds: "the first {count} of them",
    // ── The filters ─────────────────────────────────────────────────────────
    filters: "Filters",
    actor: "Person",
    allActors: "Anyone",
    action: "Action",
    allActions: "Any action",
    domain: "Area",
    allDomains: "Everywhere",
    entity: "Record type",
    allEntities: "Any type",
    dateFrom: "From",
    dateTo: "To",
    searchPlaceholder: "Search a name or a reference…",
    clear: "Clear filters",
    resultCount: "{count} entries",
    page: "Page {page} of {pages}",
    // ── The per-record panel ────────────────────────────────────────────────
    history: "History",
    historyHint: "What was done to this record, newest first.",
    noHistory: "Nothing has been recorded against this record yet.",
    seeAll: "See the full log",
    systemActor: "System",
    // ── Security ────────────────────────────────────────────────────────────
    security: "Sign-ins and refusals",
    deniedPermission: "Refused: {permission}",
    loginFrom: "Signed in",
    unknownAccount: "No such account",
  },
  auditOptions: {
    actions: {
      CREATE: "Created",
      UPDATE: "Changed",
      DELETE: "Deleted",
      CREATE_MANY: "Created in bulk",
      UPDATE_MANY: "Changed in bulk",
      DELETE_MANY: "Deleted in bulk",
      LOGIN: "Signed in",
      LOGIN_FAILED: "Sign-in refused",
      LOGIN_BLOCKED: "Sign-in blocked",
      LOGOUT: "Signed out",
      DENIED: "Permission refused",
    },
    domains: {
      access: "Users and roles",
      organization: "Organisation and years",
      vieScolaire: "School life",
      timetable: "Timetable",
      finance: "Cash desk",
      rh: "Staff",
      transport: "Transport",
      configuration: "Configuration",
      security: "Security",
    },
    entities: {
      // Pseudo-entities: events that changed no row.
      Session: "Session",
      Access: "Access",
      // Access.
      User: "User",
      Profile: "Profile",
      Role: "Role",
      Permission: "Permission",
      RolePermission: "Role permission",
      Membership: "Membership",
      LoginAttempt: "Sign-in attempt",
      ActivityLog: "Log entry",
      // Organisation.
      Organization: "Organisation",
      School: "School",
      SchoolSettings: "School settings",
      SchoolYear: "School year",
      Term: "Term",
      SchoolWeek: "School week",
      SchoolHoliday: "Holiday",
      // School life.
      Family: "Family",
      Guardian: "Guardian",
      Student: "Pupil",
      Enrollment: "Enrolment",
      EnrollmentFee: "Fee line",
      LevelOffering: "Level offering",
      SchoolClass: "Class",
      ClassGroup: "Group",
      TeachingAssignment: "Teaching assignment",
      StudentAttendance: "Attendance record",
      StudentRemark: "Remark",
      Assessment: "Assessment",
      AssessmentGrade: "Mark",
      SupplyList: "Supply list",
      SupplyItem: "Supply line",
      StudentDocument: "Document",
      ReportFavourite: "Saved report",
      // Timetable.
      TimeSlot: "Time slot",
      TimetableEntry: "Timetable slot",
      TimetableException: "Timetable change",
      TeacherAbsence: "Teacher absence",
      TeacherUnavailability: "Teacher unavailability",
      // Cash desk.
      Payment: "Receipt",
      PaymentAllocation: "Receipt allocation",
      PaymentTender: "Tender",
      CashRegister: "Till",
      CashSession: "Cash session",
      CashOperation: "Cash movement",
      Cheque: "Cheque",
      Bank: "Bank",
      Supplier: "Supplier",
      OperationCategory: "Movement category",
      OperationSubcategory: "Movement subcategory",
      OperationMotif: "Movement reason",
      // Staff.
      Staff: "Staff member",
      EmploymentContract: "Contract",
      StaffAttendance: "Staff attendance",
      LeaveRequest: "Leave request",
      SalaryPayment: "Salary payment",
      SalaryAdvance: "Salary advance",
      SalaryAdvanceRecovery: "Advance repayment",
      TeacherSubject: "Teacher qualification",
      // Transport.
      Vehicle: "Vehicle",
      FuelRequest: "Fuel request",
      TransportRoute: "Route",
      TransportSchedule: "Route timetable",
      TransportSubscription: "Transport subscription",
      TransportAttendance: "Transport attendance",
      RouteStop: "Stop",
      RouteSchedule: "Route run",
      RouteNeighbourhood: "Route district",
      TripRun: "Trip",
      // Configuration.
      EducationLevel: "Cycle",
      Level: "Level",
      Track: "Track",
      Subject: "Subject",
      LevelSubject: "Level subject",
      AssessmentType: "Assessment type",
      DocumentType: "Document type",
      FeeType: "Fee type",
      FeeRate: "Fee rate",
      Discount: "Discount",
      Room: "Room",
      City: "Town",
      Neighbourhood: "District",
      SupplyArticle: "Catalogue article",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  audit: "Activity log",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    audit: "Activity log",
  },
  codes: {
    "audit.view": "Read the activity log",
    "audit.security": "Read sign-ins and refusals",
  },
} as const;

export default en;
