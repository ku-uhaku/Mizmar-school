/**
 * Users translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  user: {
    title: "المستخدمون",
    subtitle: "الأشخاص الذين يمكنهم تسجيل الدخول إلى لوحة التحكم.",
    newUser: "مستخدم جديد",
    editUser: "تعديل المستخدم",
    createUser: "إنشاء المستخدم",
    firstName: "الاسم الشخصي",
    lastName: "الاسم العائلي",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    passwordHint: "8 أحرف على الأقل.",
    passwordEditHint: "اتركه فارغًا للاحتفاظ بكلمة المرور الحالية.",
    phone: "الهاتف",
    jobFunction: "الوظيفة",
    noJobFunctions: "لم تُضبط أي وظيفة لهذه المؤسسة — أضف واحدة من الإعدادات.",
    birthDate: "تاريخ الميلاد",
    birthDateHint: "يُستعمل لحساب السن.",
    age: "السن",
    ageYears: "{count} سنة",
    orgRole: "دور المؤسسة",
    orgRoleHint: "يُطبَّق على جميع المدارس. اتركه فارغًا للوصول عبر المدارس فقط.",
    schoolAccess: "الوصول إلى المدارس",
    schoolAccessHint: "امنح المستخدم دورًا في كل مدرسة يعمل بها.",
    noAccess: "لا يوجد وصول",
    active: "الحساب نشط",
    superAdmin: "مسؤول عام",
    superAdminHint: "يتجاوز جميع عمليات التحقق من الصلاحيات.",
    lastLogin: "آخر تسجيل دخول",
    never: "أبدًا",
    created: "تم إنشاء المستخدم.",
    updated: "تم تحديث المستخدم.",
    deleted: "تم حذف المستخدم.",
    deleteTitle: "حذف هذا المستخدم؟",
    deleteBody: "سيفقد «{name}» الوصول فورًا وسيتم حذفه.",
    emailTaken: "هذا البريد الإلكتروني مسجل بالفعل.",
    username: "اسم المستخدم",
    usernameHint: "ما يُدخله للولوج. يُقترح انطلاقًا من الاسم، ويمكن تغييره.",
    usernameTaken: "اسم المستخدم هذا مستعمل من قبل.",
    cannotDeleteSelf: "لا يمكنك حذف حسابك الخاص.",
    cannotDemoteSelf: "لا يمكنك إزالة صفة المسؤول العام عن نفسك.",
    noUsers: "لا يوجد مستخدمون بعد.",
    searchPlaceholder: "ابحث بالاسم أو البريد الإلكتروني…",
    nameColumn: "المستخدم",
    you: "أنت",
    schoolsCount: "{count} مدارس",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  users: "المستخدمون",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    user: "المستخدمون",
  },
  codes: {
    "user.view": "عرض المستخدمين",
    "user.create": "إنشاء المستخدمين",
    "user.update": "تعديل المستخدمين",
    "user.delete": "حذف المستخدمين",
    "user.assignRole": "إسناد الأدوار للمستخدمين",
  },
};

export default ar;
