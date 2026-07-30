/**
 * Appearance translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  appearance: {
    title: "المظهر",
    subtitle: "اضبط الواجهة حسب ذوقك. يُحفَظ في ملفك الشخصي.",
    language: "اللغة",
    languageHint: "العربية تحوّل الواجهة بالكامل من اليمين إلى اليسار.",
    themeMode: "السمة",
    accent: "لون التمييز",
    fontFamily: "الخط",
    fontSize: "حجم النص",
    radius: "استدارة الزوايا",
    preview: "معاينة",
    previewHeading: "نص تجريبي للمعاينة",
    previewBody: "استخدم عناصر التحكم لمعرفة شكل لوحة التحكم. تُطبَّق التغييرات فورًا وتُحفَظ في ملفك الشخصي.",
    previewButton: "إجراء رئيسي",
    previewSecondary: "ثانوي",
    reset: "استعادة الإعدادات الافتراضية",
    updated: "تم حفظ المظهر.",
    modes: {
      light: "فاتح",
      dark: "داكن",
      system: "النظام",
    },
    accents: {
      blue: "أزرق",
      emerald: "زمردي",
      violet: "بنفسجي",
      amber: "كهرماني",
      rose: "وردي",
      teal: "فيروزي",
      neutral: "محايد",
    },
    fonts: {
      geist: "Geist",
      inter: "Inter",
      system: "النظام",
      mono: "أحادي المسافة",
    },
    sizes: {
      sm: "صغير",
      md: "متوسط",
      lg: "كبير",
      xl: "كبير جدًا",
    },
    radii: {
      none: "قائمة",
      sm: "صغيرة",
      md: "متوسطة",
      lg: "كبيرة",
      xl: "كبيرة جدًا",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  appearance: "المظهر",
};

export default ar;
