/**
 * Dashboard translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your organisation.",
    schools: "Schools",
    activeSchools: "active",
    users: "Users",
    activeUsers: "active",
    roles: "Roles",
    rolesDetail: "Access levels",
    schoolYears: "School years",
    currentContext: "Your working context",
    yourPermissions: "Your permissions here",
    permissionCount: "{count} permissions in this school",
    superAdminNote: "You are a super administrator — every permission is granted.",
    quickActions: "Quick actions",
    recentSchools: "Schools",
    noSchools: "No schools yet.",
    welcome: "Welcome back, {name}.",
    overview: "Overview",
    preview: "Demo",
    previewNote: "Demo data. These figures will read from the academic tables once those exist.",
    students: "Students",
    teachers: "Teachers",
    attendance: "Attendance",
    feesCollected: "Fees collected",
    vsLastMonth: "vs last month",
    enrolmentTrend: "Enrolment trend",
    enrolmentTrendHint: "Headcount at each month end.",
    studentsByLevel: "Students by level",
    studentsByLevelHint: "Spread across the whole cycle.",
    studentsBySchool: "Split by school",
    studentsBySchoolHint: "Share of total headcount.",
    capacity: "Capacity used",
    capacityCaption: "{enrolled} enrolled of {capacity} places.",
    viewData: "View the data",
    month: "Month",
    level: "Level",
    recentActivity: "Recent activity",
    upcoming: "Upcoming",
    inDays: "in {count} days",
    minutesAgo: "{count} min ago",
    hoursAgo: "{count} h ago",
    daysAgo: "{count} d ago",
    activity: {
      enrolment: "enrolled a new student",
      payment: "recorded a payment",
      grades: "entered grades",
      absence: "cleared an absence",
      staff: "updated a staff record",
    },
    deadlines: {
      councils: "Class councils",
      reportCards: "Report cards go out",
      feesDue: "Term fees due",
      termEnd: "End of term",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  dashboard: "Dashboard",
} as const;

export default en;
