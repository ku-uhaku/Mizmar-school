/**
 * Requests translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  request: {
    title: "طلبات الوثائق",
    subtitle: "ما طلبته الأسر من المدرسة، وما آل إليه كل طلب.",

    // ── لائحة الطلبات ───────────────────────────────────────────────────────
    queue: "قيد المعالجة",
    archive: "منتهية",
    empty: "لا شيء للمعالجة. كل الطلبات تلقّت جوابا.",
    emptyArchive: "لا يوجد طلب منته.",
    pupil: "التلميذ",
    document: "الوثيقة",
    askedBy: "طلبها",
    askedOn: "تاريخ الطلب",
    copies: "النسخ",
    copiesCount: "{count} نسخ",
    reason: "الغرض",
    noReason: "دون توضيح.",
    status: "الحالة",
    readyOn: "جاهزة في",
    officeNote: "الجواب إلى الأسرة",
    handledBy: "عالجها {name}",
    collectedOn: "سُحبت في {date}",
    overdue: "تجاوزت التاريخ الموعود",
    overdueCount: "متأخرة",
    pendingCount: "في انتظار الجواب",
    readyCount: "في انتظار السحب",

    // ── معالجة الطلب ────────────────────────────────────────────────────────
    handle: "معالجة",
    accept: "القبول وتحديد تاريخ",
    acceptTitle: "قبول هذا الطلب",
    acceptHelp: "حدّد للأسرة موعد السحب. يظهر التاريخ على هاتفها.",
    markReady: "الوثيقة جاهزة",
    markReadyTitle: "تعليمها كجاهزة",
    markReadyHelp:
      "الوثيقة محرَّرة ومتوفرة بالشباك. تُخبَر الأسرة بأن بإمكانها القدوم.",
    markCollected: "سُلّمت",
    markCollectedTitle: "تسجيل التسليم",
    markCollectedHelp: "جاءت الأسرة وسحبت الوثيقة. هذا ينهي الطلب.",
    reject: "رفض",
    rejectTitle: "رفض هذا الطلب",
    rejectHelp: "اذكر السبب. الأسرة تقرأه، فاكتبه لها.",
    noteToFamily: "رسالة إلى الأسرة",
    noteOptional: "اختياري — ما يجب إحضاره، أي شباك، أوقات العمل.",
    confirm: "تأكيد",
    handled: "تم تحديث الطلب.",

    // ── ما يرفضه الخادم ─────────────────────────────────────────────────────
    dateRequired: "حدّد التاريخ الذي ينبغي أن تأتي فيه الأسرة للسحب.",
    noteRequired: "اذكر سبب الرفض — الأسرة تقرأه.",
    staleMove: "عالج شخص آخر هذا الطلب قبلك. أعد تحميل الشاشة.",

    // ── الكتالوغ ────────────────────────────────────────────────────────────
    usualDelay: "عادة {count} أيام",
    usualDelayOne: "عادة في اليوم الموالي",
    noDelayPromised: "الأجل غير مضمون",
  },

  requestOptions: {
    statuses: {
      PENDING: "في انتظار الجواب",
      ACCEPTED: "مقبولة",
      READY: "جاهزة",
      COLLECTED: "مسحوبة",
      REJECTED: "مرفوضة",
      CANCELLED: "ملغاة",
    },
  },
};

export const nav = {
  requests: "الطلبات",
} as const;

export const permissions = {
  groups: {
    request: "طلبات الوثائق",
  },
  codes: {
    "request.view": "الاطلاع على طلبات الوثائق",
    "request.handle": "معالجة الطلبات وقبولها ورفضها",
  },
} as const;

export default ar;
