/**
 * Events translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  event: {
    title: "الأنشطة",
    subtitle: "ما تعلنه المدرسة لأسر التلاميذ.",
    newEvent: "نشاط جديد",
    editEvent: "تعديل النشاط",
    eventTitle: "العنوان",
    titleAr: "العنوان (بالعربية)",
    description: "التفاصيل",
    descriptionHint: "ما يقرأه الوليّ تحت العنوان.",
    kind: "النوع",
    status: "الحالة",
    startsAt: "البداية",
    endsAt: "النهاية",
    endsAtHint: "اتركه فارغًا لنشاط في يوم واحد.",
    allDay: "طوال اليوم",
    allDayHint: "بدون توقيت — يرى الوليّ التاريخ وحده، وهو ما يناسب أغلب الإعلانات.",
    location: "المكان",
    locationHint: "نص حر: قاعة، الساحة، متحف.",
    audience: "الموجَّه إليهم",
    schoolWide: "كل المدرسة",
    schoolWideHint: "تراه جميع الأسر.",
    chosenAudience: "المستويات والأقسام المختارة",
    levels: "المستويات",
    classes: "الأقسام",
    audienceEmpty:
      "اختر مستوى أو قسمًا على الأقل، أو وجّهه إلى كل المدرسة — لا يمكن نشر نشاط لا يراه أحد.",
    audienceCount: "{count} جهة",

    // ── النشر ──────────────────────────────────────────────────────────────
    publish: "نشر",
    publishTitle: "نشر هذا النشاط؟",
    publishBody: "«{title}» يصبح مرئيًا لكل الأسر المعنية، وتراه فورًا على هواتفها.",
    published: "تم نشر النشاط.",
    publishedOn: "نُشر في {date}",
    publishedBy: "نشره {name}",
    unpublish: "إرجاع إلى مسودة",
    unpublishTitle: "إرجاع هذا النشاط إلى مسودة؟",
    unpublishBody:
      "«{title}» يتوقف عن الظهور للأسر. ومن رآه من قبل لن يجده مرة أخرى ليس إلا.",
    unpublished: "أُرجع إلى مسودة.",
    cancelEvent: "إلغاء النشاط",
    cancelTitle: "إلغاء هذا النشاط؟",
    cancelBody:
      "«{title}» يبقى ظاهرًا للأسر مع الإشارة إلى إلغائه — وهذا هو المقصود. أما حذفه فيرسل وليًّا إلى باب مغلق.",
    cannotPublishCancelled:
      "تم إلغاء هذا الحدث وأُخبرت به الأسر. أنشئ إعلانا جديدا بدل إعادة نشر هذا.",
    cancelled: "تم إلغاء النشاط.",
    saved: "تم حفظ النشاط.",
    deleted: "تم حذف النشاط.",
    deleteTitle: "حذف هذا النشاط؟",
    deleteBody: "سيتم حذف «{title}».",
    deletePublished: "أُعلن هذا النشاط — ألغِه بدل ذلك حتى تُخبَر الأسر.",

    // ── اللائحة ────────────────────────────────────────────────────────────
    upcoming: "القادمة",
    past: "المنقضية",
    drafts: "المسودات",
    noEvents: "لا شيء معلن بعد.",
    noEventsHint: "أنشئ نشاطًا ثم انشره لتراه الأسر.",
    noUpcoming: "لا شيء قادم.",
    allDayBadge: "طوال اليوم",
    searchPlaceholder: "البحث بالعنوان أو المكان…",
    startAfterEnd: "لا يمكن أن تسبق النهاية البداية.",
    outsideYear: "هذا التاريخ خارج السنة الدراسية.",
  },
  eventOptions: {
    kinds: {
      MEETING: "اجتماع",
      OUTING: "خرجة",
      CEREMONY: "حفل",
      EXAM: "امتحانات",
      HOLIDAY_INFO: "عطل",
      OTHER: "أخرى",
    },
    statuses: {
      DRAFT: "مسودة",
      PUBLISHED: "منشور",
      CANCELLED: "ملغى",
    },
  },
};

export const nav = {
  events: "الأنشطة",
};

export const permissions = {
  groups: {
    event: "الأنشطة",
  },
  codes: {
    "event.view": "الاطلاع على الأنشطة",
    "event.manage": "إنشاء الأنشطة وتعديلها",
    "event.publish": "نشر الأنشطة وإلغاؤها",
    "event.delete": "حذف الأنشطة",
  },
};

export default ar;
