/**
 * School years translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  schoolYear: {
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
    defaultBadge: "افتراضية",
    created: "تم إنشاء السنة الدراسية.",
    updated: "تم تحديث السنة الدراسية.",
    deleted: "تم حذف السنة الدراسية.",
    deleteTitle: "حذف هذه السنة الدراسية؟",
    deleteBody: "سيتم حذف «{name}» نهائيًا.",
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
