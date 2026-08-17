/**
 * Families translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  family: {
    title: "الأسر",
    subtitle: "ملفات الأسر لدى المدرسة — الأولياء والأبناء.",
    newFamily: "أسرة جديدة",
    editFamily: "تعديل الأسرة",
    createFamily: "إنشاء الأسرة",
    code: "رقم الملف",
    codeHint: "اتركه فارغًا لتخصيص الرقم التالي، مثل F-2025-0142.",
    name: "اسم الأسرة",
    nameHint: "الاسم العائلي فقط — يُفتح الملف باسم « Famille Bennis ».",
    nameAr: "اسم الأسرة (بالعربية)",
    situation: "الحالة",
    address: "العنوان",
    addressLine: "العنوان",
    city: "المدينة",
    postalCode: "الرمز البريدي",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    notes: "ملاحظات",
    contact: "الاتصال",
    household: "الأسرة",
    primaryContact: "جهة الاتصال الأولى",
    primaryContactHint: "الشخص الذي تتصل به المدرسة أولًا.",
    noContact: "لا توجد جهة اتصال",
    guardians: "الأولياء",
    guardiansHint: "الأب والأم وكل شخص آخر مسؤول عن الأطفال.",
    children: "الأبناء",
    childrenHint: "التلاميذ المرتبطون بهذا الملف.",
    noChildren: "لا يوجد أبناء في هذا الملف.",
    noGuardians: "لا يوجد أولياء في هذا الملف.",
    addGuardian: "إضافة ولي",
    editGuardian: "تعديل الولي",
    relationship: "صلة القرابة",
    firstName: "الاسم الشخصي",
    lastName: "الاسم العائلي",
    guardianNameAr: "الاسم الكامل (بالعربية)",
    nationalId: "البطاقة الوطنية",
    phoneAlt: "هاتف ثانٍ",
    profession: "المهنة",
    noParentJobs: "لم تُضبط أي مهنة لهذه المؤسسة — أضف واحدة من الإعدادات.",
    employer: "جهة العمل",
    ownAddress: "عنوان خاص",
    ownAddressHint: "فقط إذا كان مختلفًا عن عنوان الأسرة.",
    isPrimaryContact: "جهة الاتصال الأولى",
    isEmergencyContact: "جهة اتصال الطوارئ",
    canPickUp: "مرخّص له باصطحاب الأبناء",
    makePrimary: "تعيين كجهة اتصال أولى",
    portalAccount: "حساب التطبيق",
    portalAccountHint:
      "حساب واحد لكل أسرة. يفتح تطبيق أولياء الأمور على جميع أبناء الملف.",
    portalBadge: "دخول التطبيق",
    portalRevoked: "تم سحب الدخول",
    openPortalAccount: "فتح حساب",
    resetPortalPassword: "إعادة تعيين كلمة المرور",
    revokePortalAccount: "سحب الدخول",
    portalUsername: "اسم المستخدم",
    portalPassword: "كلمة المرور",
    portalOpened: "تم فتح الحساب.",
    portalPasswordReset: "تم إصدار كلمة مرور جديدة.",
    portalAccountRevoked: "تم سحب الدخول.",
    portalAlreadyOpen:
      "لهذه الأسرة حساب بالفعل، باسم {name}. اسحبه قبل فتح حساب آخر.",
    portalNoAccount: "لا يملك هذا الولي حساباً في التطبيق.",
    portalNoUsername:
      "تعذّر تكوين اسم مستخدم من هذا الاسم. أدخل الاسم بحروف لاتينية، أو استعمل رقم الملف.",
    portalCredentialsTitle: "سلّمها إلى ولي الأمر",
    portalCredentialsBody:
      "تظهر كلمة المرور مرة واحدة ولا يمكن استرجاعها. دوّنها أو انسخها قبل إغلاق هذه النافذة.",
    portalCopy: "نسخ",
    portalCopied: "تم النسخ",

    portalAccess: "ولوج الأسرة",
    portalDormant: "معطّل",
    portalDormantHint:
      "لا يوجد طفل مسجَّل في هذا الملف برسم السنة الحالية، لذا فضاء الآباء مغلق أمامهم. ويُفتح تلقائيا عند التسجيل المقبل.",
    portalAccessHint:
      "ينبغي أن يكون لكل أسرة ولوج واحد. عبره تصل النقط والغيابات والإعلانات والفواتير إلى الآباء.",
    portalNoAccess: "لا تتوفر هذه الأسرة على ولوج بعد",
    portalHeldBy: "باسم",
    portalOpenAccess: "فتح الولوج",
    portalChangePassword: "تغيير كلمة المرور",
    portalGeneratePassword: "توليد كلمة مرور",
    portalWhichGuardian: "من هو الوليّ الذي سيلج؟",

    portalChooseTitle: "اختيار كلمة مرور الأسرة",
    portalChooseBody:
      "اكتبوا كلمة المرور التي ستسلمونها، أو اتركوا الحقل فارغًا لتوليد واحدة. 8 أحرف على الأقل.",
    portalChooseReset:
      "تعوّض كلمة المرور الحالية وتُخرج الأسرة من التطبيق في جميع أجهزتها.",
    portalPasswordPlaceholder: "اتركوه فارغًا للتوليد",
    portalShowPassword: "إظهار كلمة المرور",
    portalHidePassword: "إخفاء كلمة المرور",

    portalPrint: "طباعة",
    portalSlipTitle: "تطبيق الآباء — ولوجكم",
    portalSlipIntro: "ثبّتوا تطبيق {app} في هاتفكم وادخلوا بهذه المعطيات.",
    portalSlipChange:
      "غيّروا كلمة المرور داخل التطبيق: الملف الشخصي ← تغيير كلمة المرور. وإن نسيتموها فالإدارة تسلّمكم واحدة جديدة.",
    portalSlipWarning: "احتفظوا بهذه الورقة ولا تسلموها لأحد.",
    revokePortalTitle: "سحب الدخول إلى التطبيق؟",
    revokePortalBody:
      "سيتم تسجيل خروج «{name}» من تطبيق أولياء الأمور فوراً ولن يتمكن من الدخول مرة أخرى.",
    created: "تم إنشاء الأسرة.",
    updated: "تم تحديث الأسرة.",
    deleted: "تم حذف الأسرة.",
    guardianAdded: "تمت إضافة الولي.",
    guardianUpdated: "تم تحديث الولي.",
    guardianDeleted: "تم حذف الولي.",
    codeTaken: "رقم الملف مستعمل بالفعل.",
    relationshipTaken: "هذه الأسرة لديها واحد بالفعل.",
    hasChildren: "افصل الأبناء عن هذا الملف قبل حذفه.",
    deleteTitle: "حذف ملف هذه الأسرة؟",
    deleteBody: "سيتم حذف «{name}» وأولياؤها.",
    deleteGuardianTitle: "حذف هذا الولي؟",
    deleteGuardianBody: "سيتم حذف «{name}» من الملف.",
    noFamilies: "لا توجد ملفات أسر.",
    searchPlaceholder: "البحث بالاسم أو رقم الملف أو الهاتف…",
    familyColumn: "الأسرة",
    countLabel: "{count} أبناء",
    attachTitle: "الربط بأسرة",

    transfer: "النقل إلى مؤسسة أخرى",
    transferHint:
      "لملف فُتح في المؤسسة الخطأ. الأولياء والأبناء ينتقلون معه، أما ما سُجّل أو أُدّي عنه فلا ينتقل.",
    transferSchool: "المؤسسة الجديدة",
    transferConfirm: "نقل هذا الملف",
    transferred:
      "تم نقل الملف برقم {code} مع {children} من الأبناء. وقد أُفرغت {cleared} من الإحالات إلى قوائم المؤسسة القديمة.",
    transferBlocked: "لا يمكن نقل هذا الملف: {reasons}.",
    transferSameSchool: "هو في تلك المؤسسة أصلًا.",
    transferOtherOrganisation: "تلك المؤسسة تابعة لمنظمة أخرى.",
  },
  familyOptions: {
    transferBlockers: {
      enrolments: "أحد الأبناء مسجَّل هنا",
      payments: "صدرت وصولات باسمه هنا",
      requests: "طُلبت وثائق من هذه المؤسسة",
      documents: "يحتوي وثائق من نوع لا تعتمده المؤسسة الأخرى",
    },
    situations: {
      MARRIED: "متزوج(ة)",
      DIVORCED: "مطلق(ة)",
      SEPARATED: "منفصل(ة)",
      WIDOWED: "أرمل(ة)",
      OTHER: "أخرى",
    },
    relationships: {
      FATHER: "الأب",
      MOTHER: "الأم",
      STEPFATHER: "زوج الأم",
      STEPMOTHER: "زوجة الأب",
      GRANDFATHER: "الجد",
      GRANDMOTHER: "الجدة",
      BROTHER: "الأخ",
      SISTER: "الأخت",
      UNCLE: "العم / الخال",
      AUNT: "العمة / الخالة",
      GUARDIAN: "الولي الشرعي",
    },
  },
};

export const nav = {
  families: "الأسر",
};

export const permissions = {
  groups: {
    family: "الأسر",
  },
  codes: {
    "family.view": "الاطلاع على ملفات الأسر",
    "family.create": "إنشاء ملفات الأسر",
    "family.update": "تعديل الملفات والأولياء",
    "family.delete": "حذف ملفات الأسر",
    "family.portal": "فتح وسحب حسابات أولياء الأمور",
  },
};

export default ar;
