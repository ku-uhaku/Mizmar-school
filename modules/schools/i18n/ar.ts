/**
 * Schools translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  school: {
    title: "المدارس",
    subtitle: "جميع المدارس التي تديرها المؤسسة.",
    newSchool: "مدرسة جديدة",
    editSchool: "تعديل المدرسة",
    createSchool: "إنشاء المدرسة",
    code: "الرمز",
    codeHint: "معرّف قصير وفريد، مثل AL-AMAL-CASA",
    name: "الاسم",
    level: "المستوى",
    director: "المدير",
    capacity: "الطاقة الاستيعابية",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    website: "الموقع الإلكتروني",
    logoUrl: "الشعار",
    logoHint: "يظهر في الشريط الجانبي عند اختيار هذه المدرسة.",
    addressLine: "العنوان",
    city: "المدينة",
    region: "الجهة",
    postalCode: "الرمز البريدي",
    country: "البلد",
    status: "الحالة",
    statusDescription: "تبقى المدرسة غير النشطة في القائمة لكن يتم تمييزها في كل مكان.",
    years: "السنوات",
    members: "الأعضاء",
    created: "تم إنشاء المدرسة.",
    updated: "تم تحديث المدرسة.",
    deleted: "تم حذف المدرسة.",
    deleteTitle: "حذف هذه المدرسة؟",
    deleteBody: "سيتم حذف «{name}» وجميع سنواتها الدراسية وتعييناتها نهائيًا.",
    hasStudents:
      "{count} تلميذا مسجلون في هذه المدرسة. عطّلها بدل حذفها: الحذف سيمحوهم ويمحو كل ما سُجّل عنهم.",
    codeTaken: "هذا الرمز مستخدم بالفعل من قبل مدرسة أخرى.",
    massarTaken: "\u0645\u0624\u0633\u0633\u0629 \u0623\u062e\u0631\u0649 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0647\u0630\u0627 \u0631\u0645\u0632 \u0645\u0633\u0627\u0631.",
    noSchools: "لا توجد مدارس بعد. أنشئ أول واحدة.",
    searchPlaceholder: "ابحث بالاسم أو الرمز أو المدينة…",
    configure: "تهيئة",
    setupTitle: "تهيئة هذه المدرسة",
    setupBody:
      "التقويم، الحصص الزمنية، البنية التربوية، المدن — كل ما تحتاجه مدرسة جديدة قبل تسجيل التلاميذ.",
    setupGeneralAction: "الإعدادات العامة",
    setupYearsAction: "السنوات الدراسية",
    levels: {
      PRESCHOOL: "التعليم الأولي",
      PRIMARY: "الابتدائي",
      MIDDLE: "الإعدادي",
      HIGH: "الثانوي",
      GROUP: "مجموعة مدرسية",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  schools: "المدارس",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    school: "المدارس",
  },
  codes: {
    "school.view": "عرض المدارس",
    "school.create": "إنشاء المدارس",
    "school.update": "تعديل المدارس",
    "school.delete": "حذف المدارس",
  },
};

export default ar;
