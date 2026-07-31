/**
 * Organisation translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  organization: {
    title: "المؤسسة",
    subtitle: "تفاصيل المؤسسة التي تدير جميع المدارس.",
    general: "عام",
    name: "الاسم",
    legalName: "الاسم القانوني",
    ice: "المعرّف الموحد للمقاولة",
    iceHint: "المعرّف الموحد للمقاولة بالمغرب",
    taxId: "المعرّف الضريبي",
    defaultLocale: "اللغة الافتراضية",
    contact: "الاتصال",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    website: "الموقع الإلكتروني",
    address: "العنوان",
    addressLine: "العنوان",
    city: "المدينة",
    region: "الجهة",
    postalCode: "الرمز البريدي",
    country: "البلد",
    logoUrl: "رابط الشعار",
    logoHint: "يظهر في الشريط الجانبي وعلى وثائقكم.",
    updated: "تم تحديث المؤسسة.",
    stats: "لمحة سريعة",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  organization: "المؤسسة",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    organization: "المؤسسة",
  },
  codes: {
    "organization.view": "عرض المؤسسة",
    "organization.update": "تعديل المؤسسة",
  },
};

export default ar;
