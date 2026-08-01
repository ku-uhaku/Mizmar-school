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
    welcome: "Welcome back, {name}.",

    // ── The four working sections ───────────────────────────────────────────
    sections: "Your sections",

    // ── The charts ──────────────────────────────────────────────────────────
    charts: "This year at a glance",
    pupilsPerLevel: "Pupils per level",
    pupilsPerLevelHint: "How this year's intake is spread across the levels offered.",
    pupilsUnit: "pupils",
    levelLabel: "Level",
    collectionTrend: "Collected each month",
    collectionTrendHint: "Receipts written, month by month. Cancelled ones are excluded.",
    collectionSplit: "The year's fees",
    collectionSplitHint: "What has been settled against what is still owed.",
    paidLabel: "Paid",
    outstandingLabel: "Outstanding",
    collectionRate: "Collection rate",
    overdueNote: "{amount} of it is already past its due date.",
    monthLabel: "Month",
    noChartData: "Nothing to chart yet.",
    vieScolaireHint: "The families, the children, and the year they are sitting.",
    financeHint: "What comes in, what goes out, and what the tills hold.",
    logistiqueHint: "The fleet, the lines it runs, and who rides on them.",
    rhHint: "Everybody the school pays, and what follows from employing them.",
    students: "Students",
    enrolledCount: "{count} enrolled",
    toPlaceCount: "{count} to place",
    linesCount: "{count} lines",
    leaveRequestCount: "{count} leave requests",

    // ── Administration ──────────────────────────────────────────────────────
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
    recentSchools: "Schools",
    noSchools: "No schools yet.",

    /** The caption on every chart's accessible data table. */
    viewData: "View the data",
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  dashboard: "Dashboard",
} as const;

export default en;
