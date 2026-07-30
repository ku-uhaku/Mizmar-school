/**
 * Core translations (ar) — the strings that belong to no single module:
 * shared UI wording, validation messages and error messages.
 *
 * Module-specific strings live in `modules/<module>/i18n/ar.ts`.
 * `lib/i18n/dictionaries/ar.ts` merges this file with all of them.
 */
const core = {
  common: {
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    create: "إنشاء",
    edit: "تعديل",
    delete: "حذف",
    deleting: "جارٍ الحذف…",
    search: "بحث",
    actions: "إجراءات",
    confirm: "تأكيد",
    back: "رجوع",
    previous: "السابق",
    next: "التالي",
    loading: "جارٍ التحميل…",
    none: "لا شيء",
    yes: "نعم",
    no: "لا",
    active: "نشط",
    inactive: "غير نشط",
    all: "الكل",
    required: "مطلوب",
    optional: "اختياري",
    close: "إغلاق",
    noResults: "لا توجد نتائج.",
    unknown: "غير معروف",
    of: "من",
    selected: "محدد",
    openMenu: "فتح القائمة",
    notSet: "غير محدد",
    current: "الحالية",
    dangerZone: "منطقة الخطر",
    irreversible: "لا يمكن التراجع عن هذا الإجراء.",
  },
  validation: {
    required: "هذا الحقل مطلوب.",
    email: "أدخل بريدًا إلكترونيًا صالحًا.",
    url: "أدخل رابطًا صالحًا.",
    tooShort: "يجب أن يحتوي على {min} أحرف على الأقل.",
    tooLong: "يجب ألا يتجاوز {max} حرفًا.",
    passwordTooShort: "يجب أن تحتوي كلمة المرور على {min} أحرف على الأقل.",
    invalidNumber: "أدخل رقمًا صالحًا.",
    invalidDate: "أدخل تاريخًا صالحًا.",
    invalidChoice: "اختر أحد الخيارات المتاحة.",
    codeFormat: "استخدم الحروف والأرقام والشرطات فقط.",
  },
  errors: {
    unexpected: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    forbidden: "ليست لديك صلاحية القيام بذلك.",
    notFound: "غير موجود.",
    noSchoolYearContext: "اختر أولا سنة دراسية.",
    noSchoolContext: "اختر مدرسة أولاً.",
    invalid: "يرجى مراجعة الحقول المميزة.",
    pageNotFoundTitle: "الصفحة غير موجودة",
    pageNotFoundBody: "الصفحة التي تبحث عنها غير موجودة.",
    forbiddenTitle: "تم رفض الوصول",
    forbiddenBody: "ليست لديك صلاحية عرض هذه الصفحة.",
    backToDashboard: "العودة إلى لوحة التحكم",
  },
};

/** Sidebar section titles. Modules contribute the entries inside them. */
export const nav = {
  main: "الرئيسية",
  administration: "الإدارة",
  account: "الحساب",
};

export default core;
