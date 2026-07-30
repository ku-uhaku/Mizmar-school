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
    subtitle: "نظرة عامة على مؤسستك.",
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
    quickActions: "إجراءات سريعة",
    recentSchools: "المدارس",
    noSchools: "لا توجد مدارس بعد.",
    welcome: "مرحبًا بعودتك، {name}.",
    overview: "نظرة عامة",
    preview: "تجريبي",
    previewNote: "بيانات تجريبية. ستُربط هذه المؤشرات بالجداول البيداغوجية بمجرد إنشائها.",
    students: "التلاميذ",
    teachers: "الأساتذة",
    attendance: "المواظبة",
    feesCollected: "الرسوم المحصّلة",
    vsLastMonth: "مقارنة بالشهر الماضي",
    enrolmentTrend: "تطور الأعداد",
    enrolmentTrendHint: "العدد في نهاية كل شهر.",
    studentsByLevel: "التلاميذ حسب المستوى",
    studentsByLevelHint: "التوزيع على السلك بأكمله.",
    studentsBySchool: "التوزيع حسب المدرسة",
    studentsBySchoolHint: "الحصة من العدد الإجمالي.",
    capacity: "نسبة الامتلاء",
    capacityCaption: "{enrolled} مسجّل من أصل {capacity} مقعد.",
    viewData: "عرض البيانات",
    month: "الشهر",
    level: "المستوى",
    recentActivity: "النشاط الأخير",
    upcoming: "المواعيد القادمة",
    inDays: "بعد {count} أيام",
    minutesAgo: "قبل {count} د",
    hoursAgo: "قبل {count} س",
    daysAgo: "قبل {count} ي",
    activity: {
      enrolment: "سجّل تلميذًا جديدًا",
      payment: "سجّل عملية أداء",
      grades: "أدخل النقط",
      absence: "برّر غيابًا",
      staff: "حدّث بطاقة موظف",
    },
    deadlines: {
      councils: "مجالس الأقسام",
      reportCards: "إرسال بيانات النقط",
      feesDue: "أجل رسوم الدورة",
      termEnd: "نهاية الدورة",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  dashboard: "لوحة التحكم",
};

export default ar;
