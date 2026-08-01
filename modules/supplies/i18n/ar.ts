/**
 * Supplies translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  supply: {
    title: "اللوازم المدرسية",
    subtitle: "ما يُطلب من كل قسم إحضاره، ومن صادق عليه.",
    newList: "لائحة جديدة",
    editList: "تعديل اللائحة",
    list: "اللائحة",
    lists: "اللوائح",
    noLists: "لا توجد لائحة لوازم بعد.",
    noListsHint: "حرّر واحدة لقسم ما، ثم أرسلها إلى الإدارة للمصادقة.",
    listTitle: "العنوان",
    listTitlePlaceholder: "الدخول المدرسي 2025 — الثالث ابتدائي",
    class: "القسم",
    subject: "المادة",
    subjectHint: "اتركه فارغًا للائحة العامة للقسم.",
    notes: "ملاحظات للأسر",
    notesHint: "أين تُشترى ومتى تُحضر — كل ما لا تقوله الأدوات نفسها.",
    items: "الأدوات",
    itemsHint: "سطر لكل أداة، ليتمكّن الولي من التأشير عليها.",
    addItem: "إضافة أداة",
    itemLabel: "الأداة",
    itemLabelPlaceholder: "دفتر 96 صفحة، مربعات كبيرة",
    itemLabelAr: "الأداة (بالعربية)",
    quantity: "الكمية",
    itemNotes: "توضيح",
    required: "إجباري",
    optional: "اختياري",
    itemCount: "{count} أدوات",
    author: "حرّرها",
    reviewedBy: "بتّ فيها",
    submit: "إرسال للمصادقة",
    submitted: "أُرسلت إلى الإدارة.",
    approve: "المصادقة",
    approved: "تمت المصادقة على اللائحة — صارت الأسر تراها.",
    reject: "رفض",
    rejected: "تم رفض اللائحة.",
    withdraw: "سحب",
    withdrawn: "تم سحب اللائحة من الأسر.",
    reviewNote: "السبب",
    reviewNoteHint: "يراه الأستاذ، ولا تراه الأسرة أبدًا.",
    awaitingReview: "في انتظار المصادقة",
    awaitingReviewHint: "اللوائح التي لم تبتّ فيها الإدارة بعد.",
    onlyApprovedVisible: "الأسر لا ترى إلا اللوائح المصادق عليها.",
    notYourList: "هذه اللائحة ليست لك.",
    alreadyDecided: "سبق البتّ في هذه اللائحة.",
    cannotEditApproved: "لا يمكن تعديل لائحة مصادق عليها — اسحبها أولًا.",
    created: "تم إنشاء اللائحة.",
    saved: "تم حفظ اللائحة.",
    deleted: "تم حذف اللائحة.",
    deleteTitle: "حذف هذه اللائحة؟",
    deleteBody: "سيتم حذف «{name}».",
    print: "طباعة اللائحة",
  },
  supplyOptions: {
    statuses: {
      DRAFT: "مسودة",
      SUBMITTED: "في انتظار المصادقة",
      APPROVED: "مصادق عليها",
      REJECTED: "مرفوضة",
    },
  },
};

export const nav = {
  supplies: "اللوازم",
};

export const permissions = {
  groups: {
    supply: "اللوازم المدرسية",
  },
  codes: {
    "supply.view": "الاطلاع على لوائح اللوازم",
    "supply.write": "تحرير وإرسال لوائح اللوازم",
    "supply.review": "المصادقة على لوائح اللوازم أو رفضها",
    "supply.delete": "حذف لوائح اللوازم",
  },
};

export default ar;
