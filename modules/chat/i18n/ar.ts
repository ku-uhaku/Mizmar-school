/** Chat translations (ar). Same shape as `en.ts`, which is canonical. */
const ar = {
  chat: {
    title: "فضاء الآباء",
    subtitle: "التواصل بين أسر المدرسة.",
    channels: "المحادثات",
    generalChannel: "جميع الآباء",
    classChannel: "آباء {name}",
    messages: "الرسائل",
    noChannels: "لا توجد محادثة مفتوحة.",
    noChannelsHint: "فعّل فضاء الآباء في الإعدادات لفتح واحدة.",
    noMessages: "لم يُكتب شيء بعد.",
    messageCount: "{count} رسالة",
    lastMessage: "آخر رسالة {date}",
    disabled: "معطّل",
    disabledHint: "فضاء الآباء معطّل في هذه المدرسة. لا أحد يستطيع القراءة أو الكتابة.",
    archived: "مغلق",
    archivedHint: "يمكن الاطلاع عليه، لكن لا أحد يستطيع الكتابة.",
    archive: "إغلاق المحادثة",
    reopen: "إعادة الفتح",
    archived_: "تم إغلاق المحادثة.",
    reopened: "تمت إعادة فتح المحادثة.",

    // ── الإشراف ────────────────────────────────────────────────────────────
    deleteMessage: "إزالة",
    deleteTitle: "إزالة هذه الرسالة؟",
    deleteBody:
      "تتوقف عن الظهور للآباء. وتُحفَظ باسمك على الإزالة، حتى تستطيع المدرسة أن تبيّن لاحقًا ما أزالته ولماذا.",
    deleted: "تمت إزالة الرسالة.",
    deletedLabel: "مُزالة",
    deletedBy: "أزالها {name}",
    showDeleted: "إظهار المُزالة",
    author: "الكاتب",
    postedAt: "نُشرت",
  },
  chatOptions: {
    kinds: {
      GENERAL: "جميع الآباء",
      CLASS: "قسم واحد",
    },
  },
};

export const nav = { chat: "فضاء الآباء" };

export const permissions = {
  groups: { chat: "فضاء الآباء" },
  codes: {
    "chat.view": "الاطلاع على تواصل الآباء",
    "chat.moderate": "إزالة الرسائل وإغلاق المحادثات",
  },
};

export default ar;
