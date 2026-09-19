/**
 * Timetable translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  timetable: {
    endedAtWeek: "انتهت بعد الأسبوع {week}. الأسابيع السابقة لم تُمس.",
    savedFromWeek:
      "عُدِّل ابتداءً من الأسبوع {week}. تحتفظ الأسابيع السابقة بما دُرِّس فيها.",
    applyToFollowing: "تطبيق على الأسابيع الموالية",
    applyToFollowingHint:
      "مفعَّل: تسري الحصة من هذا الأسبوع حتى إشعار آخر. غير مفعَّل: هذا الأسبوع فقط — تبديل ظرفي لا يمس النمط.",
    teacherUnavailable: "هذا الأستاذ لا يعمل في هذه الحصة. {class}",
    weeksGenerated: "تم ضبط {count} أسبوعًا للسنة.",
    generateWeeks: "ضبط أسابيع السنة",
    generateWeeksHint:
      "يرقّم كل أسبوع تُدرَّس فيه المؤسسة، ويتخطى العطل، ويناوب بين A وB. يمكن إعادة تشغيله بأمان — فهو يعيد الترقيم ولا يكرّر.",
    generateTimeSlots: "ضبط مجموعة حصص",
    generateTimeSlotsHint:
      "وقت بداية واحد، ومدة حصة واحدة، واستراحة واحدة — تُكتب بنفس الشكل في كل يوم تحدّده. أعد الكرّة لضبط المساء، أو لتصحيح يوم واحد. يمكن إعادة تشغيله بأمان: فهو يصحّح الحصص في مكانها بدل تكرارها.",
    timeSlotsGenerated: "تم ضبط {count} حصة.",
    session: "الحصة",
    startTime: "تبدأ عند",
    periodMinutes: "مدة الحصة (دقائق)",
    periodCount: "عدد الحصص",
    breakAfterPeriod: "استراحة بعد الحصة",
    breakAfterPeriodHint: "0 لعدم وضع استراحة في هذه المجموعة.",
    breakMinutes: "مدة الاستراحة (دقائق)",
    daysToApply: "الأيام",
    chooseAtLeastOneDay: "حدّد يومًا واحدًا على الأقل.",
    weekParity: "الأسابيع",
    weekParityHint:
      "أسابيع المناوبة التي تُنجز فيها هذه الحصة. اتركها على «كل الأسابيع» ما لم تكن كل أسبوعين.",
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
    day: "اليوم",
    teacherWeekTitle: "استعمال زمن الأستاذ",
    teacherWeekSummary: "{lessons} حصة موزعة على {classes} أقسام.",
    teacherWeekEmpty: "لا توجد بعد أي حصة لـ{name} في هذا التوقيت.",
    weekNumber: "الأسبوع {number}",
    exceptionSaved: "تم تحديث استعمال زمن هذا الأسبوع.",
    exceptionCleared: "العودة إلى الاستعمال المعتاد.",
    weekOutsideYear: "هذا الأسبوع ليس ضمن السنة الدراسية.",
    thisWeekOnly: "هذا الأسبوع فقط",
    thisWeekOnlyHint: "يغيّر الأسبوع {number} وحده. الاستعمال المعتاد لا يتغيّر.",
    cancelLesson: "إلغاء هذه الحصة",
    reason: "السبب",
    reasonPlaceholder: "خرجة مدرسية، حصة تعويضية…",
    replaceLesson: "تعويض هذه الحصة",
    backToUsual: "العودة إلى الحصة المعتادة",
    cancelledThisWeek: "ملغاة",
    teacherAway: "{name} غائب(ة)",
    coveredBy: "نيابة عن {name}",
    notCovered: "بدون تعويض",
    previousWeek: "الأسبوع السابق",
    nextWeek: "الأسبوع الموالي",
    holidayWeek: "لا دروس هذا الأسبوع — {name}.",
    holidayDay: "{name}",
    availabilityTitle: "أوقات عمل الأساتذة",
    availabilitySubtitle:
      "الحصص التي يشتغلها كل أستاذ. لا يمكن وضع درس خارجها.",
    availabilityHint:
      "انقر على حصة لتغييرها، أو على يوم أو ساعة لتغيير الصف أو العمود كله.",
    availabilitySaved: "تم حفظ الأوقات — {count} حصة محجوبة.",
    availableAllWeek: "متاح طوال الأسبوع",
    working: "يشتغل",
    notWorking: "غير متاح",
    periodsWorked: "يشتغل {worked} حصة من أصل {total}",
    periodsOff: "{count} محجوبة",
    printWithDetails: "طباعة مع التفاصيل",
    detailEditTip: "تحديد ما يُدرَّس في هذه الحصة ووقته",
    detailTitle: "تفاصيل {subject} · {time}",
    detailHint:
      "يبقى الدرس كما هو. أضف ما يُدرَّس داخله ووقته، مثلًا القواعد 08:00–08:30. يظهر تحت المادة في استعمال الزمن.",
    detailSubject: "المادة أو المكوّن",
    detailFrom: "من",
    detailTo: "إلى",
    detailAdd: "إضافة تفصيل",
    detailRemove: "حذف",
    detailsSaved: "تم حفظ التفاصيل.",
    detailsInvalid:
      "يجب أن يبدأ كل تفصيل قبل نهايته، داخل الحصة، ولا يمكن تكرار المادة نفسها في الوقت نفسه.",
    pickTeacher: "الأستاذ",
    noTeachers: "لا يوجد أساتذة في هذه المؤسسة.",
    teacherHours: "أوقات العمل",
    generateGrid: "توليد استعمال الزمن",
    generateGridHint:
      "يبني الأسبوع انطلاقًا من الغلاف الزمني الأسبوعي، مع مراعاة ارتباطات الأساتذة والقاعات. لا يُحفظ شيء قبل المصادقة.",
    generateDraw: "اقتراح استعمال زمن",
    reroll: "اقتراح آخر",
    applyGrid: "اعتماد هذا الاستعمال",
    gridApplied:
      "تم تسجيل {written} حصة عبر {classes} قسم، وعُوّضت {cleared}.",
    gridAppliedAssigned:
      "تم تسجيل {written} حصة عبر {classes} قسم، وعُوّضت {cleared}، وأُسنِد {assigned} أستاذ.",
    teachersAssigned: "سُيسنَد {count} أستاذ",
    generateScope: "النطاق",
    scopeThisClass: "هذا القسم فقط",
    scopeAllClasses: "جميع الأقسام ({count})",
    lessonLength: "\u0645\u062f\u0629 \u0627\u0644\u062d\u0635\u0629",
    maxPerDay: "المادة نفسها في اليوم",
    periodsPerDay: "{count} حصة على الأكثر",
    replaceExisting: "الانطلاق من أسبوع فارغ",
    replaceExistingHint:
      "تُمسح حصص القسم الحالية ويُعاد رسم الأسبوع كاملاً.",
    fillGapsHint:
      "تُحفظ الحصص الحالية، وتُوضع فقط الساعات الناقصة من البرنامج.",
    allowDoubles: "السماح بالحصص المزدوجة",
    allowDoublesHint:
      "يضع ساعتين متتاليتين من المادة عند الإمكان، ولا يتجاوز الاستراحة أبدًا.",
    periodsPlaced: "تم وضع {placed} حصة من أصل {requested}",
    classesCovered: "{count} أقسام",
    understaffed: "الموارد البشرية لا تكفي هذا البرنامج",
    understaffedHint:
      "يتطلب البرنامج {demand} ساعة أسبوعيًا، والأساتذة المتاحون يقدرون على {available} ساعة. {missing} ساعة لا يمكن تغطيتها مهما كان ترتيب الأسبوع.",
    shortfalls: "تعذّر وضعها",
    periodsMissing: "نقص {count} حصة",
    noWeeklyHours: "لا غلاف زمني مصرّح به، فأُقصيت",
    noTeacherAssigned: "وُضعت دون أستاذ مُسنَد",

    // ── سجلّ الإصدارات ─────────────────────────────────────────────────────
    versionHistory: "سجلّ الإصدارات",
    versionHistoryHint:
      "كل جدول عرفه هذا التوقيت. الرجوع إلى إصدار أقدم لا يُفقد أي حصة — يمكن دائمًا العودة إليه لاحقًا.",
    versionActive: "نشط",
    versionArchived: "مؤرشف",
    versionActivate: "استخدام هذا الإصدار",
    versionActivateConfirmTitle: "التحويل إلى هذا الإصدار؟",
    versionActivateConfirmBody:
      "سيصبح هذا الجدول هو المعروض في كل الشاشات. أي تعديل يدوي أُجري بعد هذا الإصدار سيُفقد — لكن يمكن استرجاعه بالعودة إلى الإصدار الحالي.",
    versionActivated: "تم التحويل إلى الإصدار المختار.",
    versionAlreadyActive: "هذا الإصدار نشط بالفعل.",
    versionNoLabel: "إصدار بلا عنوان",
    versionCreatedBy: "بواسطة {name}",
    versionEntryCount: "{count} حصة",

    // ── ما تبقّى للبرنامج على هذا الأسبوع ───────────────────────────────────
    programmeGaps: "يبقى وضعها يدويًا",
    programmeGapsHint:
      "البرنامج يطلب منها أكثر ممّا يحمله الأسبوع — ما لم يستطع التوليد وضعه، وما حُذف بعده. انقر على حصة شاغرة لوضعها بنفسك.",
    gapUnstaffed: "دون أستاذ",
    undeclaredHours:
      "لا غلاف زمني مصرّح به لـ {subjects}، فلا يمكن وضع أي حصة لها ما لم يحدّد البرنامج مدّتها.",
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
    weekParities: {
      ALL: "كل الأسابيع",
      A: "الأسبوع A",
      B: "الأسبوع B",
    },
    daySessions: {
      MORNING: "صباحًا",
      AFTERNOON: "بعد الزوال",
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
