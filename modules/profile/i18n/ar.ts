/**
 * Own profile translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  profile: {
    title: "الملف الشخصي",
    subtitle: "معلوماتك الشخصية وكلمة المرور.",
    personal: "المعلومات الشخصية",
    firstName: "الاسم الشخصي",
    lastName: "الاسم العائلي",
    phone: "الهاتف",
    jobTitle: "الوظيفة",
    bio: "نبذة",
    avatarUrl: "رابط الصورة الرمزية",
    email: "البريد الإلكتروني",
    emailReadonly: "اتصل بالمسؤول لتغيير بريدك الإلكتروني.",
    updated: "تم تحديث الملف الشخصي.",
    security: "الأمان",
    changePassword: "تغيير كلمة المرور",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    passwordChanged:
      "تم تغيير كلمة المرور. ستحتاج إلى تسجيل الدخول من جديد هنا، وتم تسجيل الخروج من كل أجهزتك الأخرى.",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    wrongCurrentPassword: "كلمة المرور الحالية غير صحيحة.",
    access: "صلاحياتك",
    orgRole: "دور المؤسسة",
    schoolRoles: "الأدوار حسب المدرسة",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  profile: "الملف الشخصي",
};

export default ar;
