/**
 * School years translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  schoolYear: {
    createdFromCopy:
      "أُنشئت السنة انطلاقًا من السابقة — {classes} أقسام، {rates} تعريفات، {weeks} أسبوعًا.",
    copyFrom: "الانطلاق من سنة سابقة",
    copyFromHint:
      "تُنسخ الإعدادات فقط. لا يُنقل أي تلميذ ولا تسجيل ولا اشتراك نقل.",
    copyNothing: "البدء من الصفر",
    copyParts: "العناصر المراد نسخها",
    copyCalendar: "الرزنامة — الأسدس، الحصص، العطل",
    copyCalendarHint:
      "تُزاح التواريخ بأسابيع كاملة: يبقى الاثنين اثنينًا. يتبع العيد والمولد التقويم الهجري وسيلزم تصحيحهما.",
    copyProgramme: "البرنامج — المواد والمعاملات والأغلفة الزمنية",
    copyProgrammeHint:
      "ما يُدرَّس في كل مستوى هذه السنة. بدونه لا برنامج للسنة يُجدوَل أو تُحسب عليه المعدلات.",
    copyStructure: "البنية — المستويات، الأقسام، المجموعات",
    copyStructureHint: "شكل المؤسسة. لا يُنقل الأستاذ الرئيسي.",
    copyFees: "الرسوم — لائحة الأسعار والتخفيضات",
    copyFeesHint: "بمبالغ السنة الماضية. لا شيء يُراجَع.",
    copyTransport: "النقل — الرحلات، المسارات، المحطات",
    copyTransportHint: "الخطوط وما تخدمه. لا يُنسخ أي اشتراك.",
    title: "السنوات الدراسية",
    subtitle: "السنوات الدراسية لـ {school}.",
    subtitleNoSchool: "اختر مدرسة لإدارة سنواتها الدراسية.",
    newYear: "سنة دراسية جديدة",
    editYear: "تعديل السنة الدراسية",
    createYear: "إنشاء السنة الدراسية",
    name: "التسمية",
    nameHint: "مثال: 2025-2026",
    startDate: "تاريخ البداية",
    endDate: "تاريخ النهاية",
    status: "الحالة",
    isDefault: "السنة الافتراضية",
    makeDefault: "تعيين كافتراضية",
    configure: "تهيئة",
    defaultBadge: "افتراضية",
    created: "تم إنشاء السنة الدراسية.",
    updated: "تم تحديث السنة الدراسية.",
    deleted: "تم حذف السنة الدراسية.",
    deleteTitle: "حذف هذه السنة الدراسية؟",
    deleteBody: "سيتم حذف «{name}» نهائيًا.",
    hasEnrolments:
      "{count} تلميذا مسجلون في هذه السنة. أغلقها بدل حذفها: الحذف سيمحو تسجيلاتهم وجداول أدائهم.",
    hasPayments:
      "{count} وصلا صدرت على هذه السنة. أغلقها بدل حذفها: سنة قُبض فيها مال هي تاريخ مُقفل.",
    nameTaken: "هذه التسمية موجودة بالفعل لهذه المدرسة.",
    endBeforeStart: "يجب أن يكون تاريخ النهاية بعد تاريخ البداية.",
    noYears: "لا توجد سنوات دراسية لهذه المدرسة.",
    statuses: {
      PLANNED: "مخططة",
      ACTIVE: "جارية",
      CLOSED: "مغلقة",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  schoolYears: "السنوات الدراسية",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    schoolYear: "السنوات الدراسية",
  },
  codes: {
    "schoolYear.view": "عرض السنوات الدراسية",
    "schoolYear.create": "إنشاء السنوات الدراسية",
    "schoolYear.update": "تعديل السنوات الدراسية",
    "schoolYear.delete": "حذف السنوات الدراسية",
  },
};

export default ar;
