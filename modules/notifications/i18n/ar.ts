/** Notifications translations (ar). */
const ar = {
  notification: {
    title: "الإشعارات",
    subtitle: "ما جدّ ولم تطّلع عليه بعد.",
    empty: "لا جديد.",
    emptyHint: "سنُعلمك هنا بكل ما يخصّك.",
    emptyUnread: "لا إشعارات غير مقروءة.",
    unread: "{count} غير مقروءة",
    markAllRead: "تعليم الكل كمقروء",
    markedAllRead: "تمّ تعليم الكل كمقروء.",
    markRead: "تعليم كمقروء",
    open: "فتح",
    viewAll: "عرض كل الإشعارات",
    filterAll: "الكل",
    filterUnread: "غير المقروءة",
    bell: "الإشعارات",
    bellUnread: "الإشعارات، {count} غير مقروءة",
    loadError: "تعذّر تحميل الإشعارات.",

    kinds: {
      EVENT_PUBLISHED: "حدث جديد: {title}",
      REQUEST_HANDLED: "{document}: {status}",
      MARKS_PUBLISHED: "نقط جديدة لـ {child} في {subject}",
      BULLETIN_PUBLISHED: "نقطة {child} للفترة {term} متوفّرة",
      REMARK_SHARED: "ملاحظة بخصوص {child}",
      PAYMENT_RECORDED: "تمّ تسجيل أداء {amount} — وصل {code}",
      ASSESSMENT_SCHEDULED: "{subject}: «{title}» لفائدة {child} بتاريخ {date}",
      ATTENDANCE_MISSED: "{child} سُجّل {status} بتاريخ {date}",
      REQUEST_FILED: "{document} مطلوب من طرف عائلة {child}",
      ASSESSMENT_SUBMITTED: "«{assessment}» صُحّح من طرف {teacher} — في انتظار الاعتماد",
      ASSESSMENT_VALIDATED: "تمّ اعتماد «{assessment}»",
    },
  },
} as const;

export const nav = {
  notifications: "الإشعارات",
};

export default ar;
