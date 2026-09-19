/**
 * Messaging translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  messaging: {
    title: "تذكيرات الأداء",
    subtitle: "أرسل تذكيراً عبر واتساب لأولياء الأسر المتأخرة في الأداء.",
    backToCaisse: "الصندوق",

    gateway: {
      READY: "متصل",
      DISCONNECTED: "غير متصل — أعد ربط الهاتف ثم استأنف",
      UNCONFIGURED: "غير مُعدّ على هذا الخادم",
    },

    credits: {
      label: "رصيد الرسائل",
      left: "المتبقي {count}",
      contactOwner:
        "الرصيد غير كافٍ. تواصل مع مالك المنصة لشراء المزيد — رصيد واحد لرسالة واحدة.",
      manage: "إدارة الرصيد",
    },

    filters: {
      title: "لمن",
      minAmount: "متأخر بما لا يقل عن",
      level: "المستوى",
      class: "القسم",
      allLevels: "كل المستويات",
      allClasses: "كل الأقسام",
      search: "بحث عن أسرة أو ولي",
    },

    columns: {
      family: "الأسرة",
      contact: "الولي",
      phone: "الهاتف",
      overdue: "المتأخر",
      status: "الحالة",
    },

    skip: {
      NO_PHONE: "لا يوجد رقم هاتف صالح",
      COOL_DOWN: "تمت مراسلتها مؤخراً",
    },
    willSend: "ستُراسل",
    noneLate: "لا توجد أسرة متأخرة في الأداء.",

    selection: {
      leftOut: "مستثناة",
      skipped: "{count} مستثناة",
      summary: "{count} ستُراسل · {skipped} مستثناة",
      exclude: "استثناء",
      include: "إدراج",
    },

    compose: {
      title: "الرسالة",
      template: "الرسالة",
      variablesHint:
        "المتغيرات: {parent} {famille} {montant} {enfants} {ecole} {remarque}",
      remark: "ملاحظة",
      remarkHint: "نص حر يُدرج مكان كتابة {remarque}.",
      preview: "معاينة",
      previewFor: "لأسرة {family}",
      unknownVariables: "متغير غير معروف: {names}",
      defaultTemplate:
        "السلام عليكم {parent}، نفيدكم بوجود أداء مدرسي متأخر بقيمة {montant} عن {enfants}. {remarque} شكراً، {ecole}.",
    },

    print: "طباعة",
    send: "إرسال",
    sendConfirm:
      "إرسال {count} رسالة؟ سيُستهلك {count} رصيد، ويُعاد رصيد الرسائل التي تفشل.",
    sending: "جارٍ الإدراج…",
    queued: "تم إدراج {count} رسالة. يتم الإرسال في الخلفية.",
    cancelled: "أُلغيت الحملة. أُعيد {count} رصيد.",
    cancel: "إلغاء",
    resume: "استئناف",
    activeCampaign: "توجد حملة جارية",
    viewCampaign: "عرض التقدم",

    campaigns: {
      title: "المرسَل",
      empty: "لم يُرسل شيء بعد.",
      recipients: "المستلمون",
      sent: "أُرسلت",
      failed: "فشلت",
      pending: "في الانتظار",
      cancelled: "ملغاة",
      back: "التذكيرات",
    },

    creditsPage: {
      title: "رصيد الرسائل",
      subtitle: "للمالك فقط. رصيد واحد لرسالة واحدة.",
      balance: "الرصيد",
      amount: "الرصيد المراد إضافته",
      note: "ملاحظة (ما تم شراؤه)",
      submit: "إضافة الرصيد",
      ledger: "السجل",
      emptyLedger: "لا توجد حركات.",
    },
    toppedUp: "أُضيف الرصيد. الرصيد الحالي: {balance}.",

    gatewayLabel: "واتساب",
    campaignStatus: {
      QUEUED: "في الانتظار",
      RUNNING: "جارٍ الإرسال",
      PAUSED: "متوقفة — واتساب غير متصل",
      DONE: "مكتملة",
      CANCELLED: "ملغاة",
    },
    deliveryStatus: {
      PENDING: "في الانتظار",
      SENDING: "جارٍ الإرسال",
      SENT: "أُرسلت",
      FAILED: "فشلت، أُعيد الرصيد",
      CANCELLED: "ملغاة",
    },
    creditReasons: {
      TOPUP: "شحن",
      RESERVE: "محجوز لحملة",
      REFUND: "مُسترجع",
      ADJUST: "تعديل",
    },

    errors: {
      templateInvalid: "اكتب رسالة لا تتجاوز 1000 حرف.",
      notConfigured: "واتساب غير مُعدّ على هذا الخادم.",
      noRecipients: "لا يوجد من تُراسله بهذه المرشحات.",
      insufficientCredits:
        "الرصيد غير كافٍ: المتاح {available} والمطلوب {needed}. تواصل مع مالك المنصة لشراء المزيد.",
      campaignInProgress:
        "توجد حملة جارية لهذه المدرسة. انتظر انتهاءها أو ألغها.",
      amountInvalid: "أدخل عدداً صحيحاً من الرصيد أكبر من الصفر.",
    },
  },
};

export const nav = {
  reminders: "التذكيرات",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    messaging: "تذكيرات واتساب",
  },
  codes: {
    "messaging.send": "إرسال تذكيرات واتساب",
  },
};

export default ar;
