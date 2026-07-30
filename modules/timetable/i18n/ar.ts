/**
 * Timetable translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  timetable: {
    title: "استعمال الزمن",
    subtitle: "أسبوع قسم واحد. انقر على خانة لوضع حصة.",
    pickClass: "اختر قسمًا",
    pickClassHint: "لكل قسم شبكته الخاصة.",
    noClasses: "لا توجد أقسام لهذه السنة.",
    noClassesHint: "افتح مستوى وأنشئ أقسامه أولًا.",
    noSlots: "لا توجد شبكة زمنية لهذه السنة.",
    noSlotsHint: "حدّد الحصص في الإعدادات قبل رسم الشبكة.",
    scheduleKind: "التوقيت",
    lessons: "{count} حصص",
    free: "فارغ",
    breakLabel: "استراحة",
    closed: "مغلق",
    addLesson: "وضع حصة",
    editLesson: "تعديل هذه الحصة",
    subject: "المادة",
    subjectHint: "برنامج القسم الخاص.",
    teacher: "الأستاذ",
    teacherHint: "يُملأ من الإسناد التربوي عند وجوده.",
    room: "القاعة",
    roomHint: "وإلا فالقاعة المعتادة للقسم.",
    group: "الفوج",
    groupHint: "يُحدَّد عندما يحضر نصف القسم فقط.",
    term: "الدورة",
    termHint: "اتركه فارغًا لحصة تدوم السنة كاملة.",
    allYear: "السنة كاملة",
    wholeClass: "القسم كاملًا",
    saved: "تم وضع الحصة.",
    duration: "المدة",
    durationHint: "الحصة المزدوجة تشغل حصتين متتاليتين.",
    periods: "{count} حصص",
    repeatOn: "التكرار في أيام أخرى",
    repeatOnHint:
      "يضع نفس الحصة في هذا التوقيت في الأيام المحددة. اليوم المنقور مُدرج دائمًا.",
    savedMany: "تم وضع الحصة في {count} حصص.",
    classClash: "هذا القسم لديه حصة بالفعل على الساعة {slot}.",
    cleared: "تم إفراغ الخانة.",
    clearSlot: "إفراغ هذه الخانة",
    teacherClash: "هذا الأستاذ يدرّس {class} على الساعة {slot} بالفعل.",
    roomClash: "هذه القاعة مشغولة بالقسم {class} على الساعة {slot}.",
    slotUnavailable: "هذه الحصة لا تنتمي إلى هذه السنة.",
    slotIsBreak: "هذه الحصة استراحة — لا يمكن وضع درس فيها.",
    openClass: "فتح القسم",
    weekCoverage: "{filled} حصة مملوءة من {total}",
    days: {
      "1": "الاثنين",
      "2": "الثلاثاء",
      "3": "الأربعاء",
      "4": "الخميس",
      "5": "الجمعة",
      "6": "السبت",
    },
    daysShort: {
      "1": "الاثنين",
      "2": "الثلاثاء",
      "3": "الأربعاء",
      "4": "الخميس",
      "5": "الجمعة",
      "6": "السبت",
    },
    scheduleKinds: {
      STANDARD: "عادي",
      RAMADAN: "رمضان",
    },
  },
};

export const nav = {
  timetable: "استعمال الزمن",
};

export const permissions = {
  groups: {
    timetable: "استعمال الزمن",
  },
  codes: {
    "timetable.view": "الاطلاع على استعمالات الزمن",
    "timetable.manage": "وضع الحصص وحذفها",
  },
};

export default ar;
