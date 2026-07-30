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
    codeTaken: "هذا الرمز مستخدم بالفعل من قبل مدرسة أخرى.",
    noSchools: "لا توجد مدارس بعد. أنشئ أول واحدة.",
    searchPlaceholder: "ابحث بالاسم أو الرمز أو المدينة…",
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
