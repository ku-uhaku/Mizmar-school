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
    identifier: "اسم المستخدم",
    identifierHint: "اسم المستخدم الذي منحته لك مدرستك. وليس بريدًا إلكترونيًا.",
    password: "كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    signOut: "تسجيل الخروج",
    invalidCredentials: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    accountDisabled: "تم تعطيل هذا الحساب.",
    mobileOnlyAccount:
      "حسابات الأساتذة تُستعمل في تطبيق مزمار، لا في لوحة الإدارة. ادخل إلى التطبيق بنفس اسم المستخدم وكلمة المرور.",
    noAccessTitle: "فضاؤك في التطبيق",
    noAccessBody:
      "هذا الحساب حساب أستاذ، ولوحة الإدارة خاصة بالإدارة. كل ما يخصه — الحضور والنقط والملاحظات واستعمال الزمن — يوجد في تطبيق مزمار.",
    noAccessHint:
      "ادخل إلى التطبيق بنفس اسم المستخدم وكلمة المرور. وإن كنت ترى أنه ينبغي لك ولوج لوحة الإدارة، فاتصل بإدارة مدرستك.",
    tooManyAttempts:
      "عدد كبير من محاولات تسجيل الدخول الفاشلة. أعد المحاولة بعد {minutes} دقيقة.",
    brandTagline: "إدارة عدة مدارس ضمن مؤسسة واحدة.",
    panelHeadline: "كل ما تحتاجه مدارسكم في مكان واحد.",
    highlightSchools: "كل مدرسة ومستوى وقسم في المجموعة.",
    highlightPeople: "التلاميذ والأسر والموظفون في ملف واحد.",
    highlightSecure: "صلاحيات تُمنح حسب الدور وحسب المدرسة.",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    poweredBy: "نشر بواسطة",
  },
};

export default ar;
