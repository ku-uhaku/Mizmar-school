/**
 * Dashboard translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  dashboard: {
    title: "لوحة التحكم",
    welcome: "مرحبًا بعودتك، {name}.",

    // ── أقسام العمل الأربعة ─────────────────────────────────────────────────
    sections: "أقسامك",

    charts: "السنة في لمحة",
    pupilsPerLevel: "التلاميذ حسب المستوى",
    pupilsPerLevelHint: "كيف يتوزّع عدد هذه السنة على المستويات المفتوحة.",
    pupilsUnit: "تلميذ",
    levelLabel: "المستوى",
    collectionTrend: "المحصّل كل شهر",
    collectionTrendHint: "الوصولات المحرّرة، شهرًا بشهر. الملغاة غير محتسبة.",
    collectionSplit: "رسوم السنة",
    collectionSplitHint: "ما تم أداؤه مقابل ما تبقّى.",
    paidLabel: "مؤدّى",
    outstandingLabel: "المتبقّي",
    collectionRate: "نسبة التحصيل",
    overdueNote: "{amount} منها تجاوزت أجلها.",
    monthLabel: "الشهر",
    noChartData: "لا شيء لعرضه بعد.",
    vieScolaireHint: "الأسر والأطفال والسنة التي يتابعونها.",
    financeHint: "ما يدخل وما يخرج وما تحتويه الصناديق.",
    logistiqueHint: "الأسطول والخطوط التي يسيّرها ومن يستعملها.",
    rhHint: "كل من تؤدي المدرسة أجره، وما يترتب على تشغيلهم.",
    students: "التلاميذ",
    enrolledCount: "{count} مسجلين",
    toPlaceCount: "{count} في انتظار الإسناد",
    linesCount: "{count} خطوط",
    leaveRequestCount: "{count} طلبات إجازة",

    // ── الإدارة ─────────────────────────────────────────────────────────────
    schools: "المدارس",
    activeSchools: "نشطة",
    users: "المستخدمون",
    activeUsers: "نشطون",
    roles: "الأدوار",
    rolesDetail: "مستويات الوصول",
    schoolYears: "السنوات الدراسية",
    currentContext: "سياق عملك",
    yourPermissions: "صلاحياتك هنا",
    permissionCount: "{count} صلاحية في هذه المدرسة",
    superAdminNote: "أنت مسؤول عام — جميع الصلاحيات ممنوحة لك.",
    recentSchools: "المدارس",
    noSchools: "لا توجد مدارس بعد.",

    viewData: "عرض البيانات",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  dashboard: "لوحة التحكم",
};

export default ar;
