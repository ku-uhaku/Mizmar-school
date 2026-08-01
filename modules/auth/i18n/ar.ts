/**
 * Authentication translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  auth: {
    signInTitle: "تسجيل الدخول",
    signInSubtitle: "ادخل إلى لوحة إدارة المدارس.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    signOut: "تسجيل الخروج",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    accountDisabled: "تم تعطيل هذا الحساب.",
    tooManyAttempts:
      "عدد كبير من محاولات تسجيل الدخول الفاشلة. أعد المحاولة بعد {minutes} دقيقة.",
    brandTagline: "إدارة عدة مدارس ضمن مؤسسة واحدة.",
  },
};

export default ar;
