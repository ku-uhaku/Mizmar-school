/**
 * Classroom translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const ar = {
  classroom: {
    attendanceStatus: "الحالة",
    date: "التاريخ",
    attendanceRate: "المواظبة",
    ofMarkedDays: "من أصل {count} مسجّلة",
    unjustified: "غير مبرَّر",
    unjustifiedCount: "{count} غير مبرَّر",
    excusedHint: "غيابات قبلتها المؤسسة.",
    minutesLateShort: "{count} د",
    recordedBy: "سجّلها",
    noAttendanceYet: "لم يُجرَ أي تفقّد بعد.",
    noAttendanceHint: "يُجرى التفقّد في فضاء الأستاذ.",
    noRemarksYet: "لا شيء مكتوب بعد.",
    title: "فضاء الأستاذ",
    subtitle: "أقسامك، وأوراق الغياب، والتصحيح.",

    // ── واجهة الفضاء ────────────────────────────────────────────────────────
    myClasses: "أقسامي",
    myTimetable: "استعمال زمني",
    myTimetableHint: "أين يُنتظر حضورك، أسبوعًا بأسبوع.",
    lessonsPerWeek: "ساعات في الأسبوع",
    freePeriods: "ساعات فارغة",
    freePeriodsHint: "متى يمكن إيجادك.",
    noLessonsThisWeek: "لا شيء في استعمال زمنك لهذا التوقيت.",
    noLessonsThisWeekHint: "تظهر الحصص هنا بمجرد وضع استعمال الزمن لأقسامك.",
    myClassesHint: "كل قسم ومادة أُسندت إليك هذه السنة.",
    noClasses: "لم يُسند إليك أي قسم هذه السنة.",
    noClassesHint: "يظهر القسم هنا بمجرد أن يُسنده إليك المسؤول البيداغوجي.",
    classesCount: "{count} أقسام",
    pupilsTaught: "التلاميذ المتابَعون",
    lessonsToday: "حصص اليوم",
    registersLeft: "أوراق غياب متبقية",
    papersToMark: "أوراق للتصحيح",
    remarksThisMonth: "ملاحظات هذا الشهر",
    today: "اليوم",
    noLessonsToday: "لا توجد حصة في استعمال زمنك اليوم.",
    takeRegister: "تسجيل الحضور",
    registerTaken: "تم تسجيل الحضور",
    openMarkSheet: "فتح ورقة النقط",

    // ── ورقة الغياب ─────────────────────────────────────────────────────────
    attendance: "الحضور",
    attendanceHint: "من كان في القسم، ومن تأخر.",
    register: "ورقة الحضور",
    lesson: "الحصة",
    wholeDay: "اليوم بأكمله",
    pupil: "التلميذ",
    status: "الحالة",
    minutesLate: "دقائق التأخر",
    reason: "السبب",
    saveRegister: "حفظ ورقة الحضور",
    registerSaved: "تم تسجيل {count} تلميذًا.",
    markAllPresent: "الجميع حاضرون",
    notYourClass: "أنت لا تدرّس في هذا القسم.",
    minutesOutOfRange: "يجب أن يتراوح التأخر بين 0 و120 دقيقة.",
    thisYear: "هذه السنة",
    absencesShort: "{count} غياب",
    latesShort: "{count} تأخر",
    pickLesson: "اختر قسمًا ومادة",
    pickLessonHint: "اختر أحد أقسامك، ثم اليوم والحصة المعنية.",
    justified: "مبرَّر",
    justificationSaved: "تم تحديث التبرير.",

    // ── الواجبات ────────────────────────────────────────────────────────────
    devoirs: "الواجبات",
    devoirsHint: "العمل الذي أعطيته، والنقط المسجّلة عليه.",
    newDevoir: "إعطاء واجب",
    newDevoirTitle: "إعطاء واجب",
    newDevoirHint:
      "لأحد أقسامك. يُنشر مباشرة، فيمكنك إدخال النقط بمجرد التسليم.",
    devoirCreated: "تم إنشاء الواجب.",
    devoirTitle: "العنوان",
    dueOn: "يُسلَّم في",
    noDevoirs: "لم تعطِ أي واجب بعد.",
    noDevoirsHint: "أعطِ واجبًا وسيظهر هنا مع ورقة نقطه.",
    kindNotAllowed: "مدرستك لا تسمح للأساتذة بإعطاء هذا النوع من العمل.",
    noTeacherKinds:
      "لا يوجد نوع عمل مفتوح للأساتذة. اطلب فتح واحد في الإعدادات.",

    // ── الملاحظات ───────────────────────────────────────────────────────────
    remarks: "الملاحظات",
    remarksHint: "ما سجّلته عن تلاميذك.",
    newRemark: "كتابة ملاحظة",
    newRemarkTitle: "كتابة ملاحظة",
    remarkAbout: "تخص",
    remarkKind: "النوع",
    remarkTone: "النبرة",
    remarkBody: "الملاحظة",
    remarkBodyHint: "جملة يفهمها زميل — أو ولي أمر.",
    occurredOn: "لوحظت في",
    visibleToFamily: "إبلاغ الأسرة",
    visibleToFamilyHint:
      "معطّل افتراضيًا. الملاحظة الداخلية تبقى بينك وبين زملائك.",
    internalOnly: "داخلية",
    shared: "أُبلغت للأسرة",
    remarkSaved: "تم حفظ الملاحظة.",
    remarkDeleted: "تم حذف الملاحظة.",
    deleteRemarkTitle: "حذف هذه الملاحظة؟",
    deleteRemarkBody: "سيتم حذف ملاحظتك بخصوص {name}.",
    notYourRemark: "لا يمكنك حذف سوى ملاحظاتك أنت.",
    notYourPupil: "أنت لا تدرّس هذا التلميذ.",
    sharedWithFamily: "{count} \u0623\u064f\u0628\u0644\u0650\u063a\u062a \u0644\u0644\u0623\u0633\u0631\u0629",
    noRemarks: "لا توجد ملاحظة بعد.",
    noRemarksHint: "الملاحظة هي الجملة التي كنت ستحتفظ بها في دفترك الخاص.",
    mineOnly: "ملاحظاتي فقط",
    searchRemarks: "ابحث في الملاحظات…",
  },
  classroomOptions: {
    attendanceStatuses: {
      PRESENT: "حاضر",
      LATE: "متأخر",
      ABSENT: "غائب",
      EXCUSED: "غياب مبرَّر",
    },
    remarkKinds: {
      BEHAVIOUR: "السلوك",
      WORK: "العمل",
      PROGRESS: "التقدم",
      ATTENDANCE: "المواظبة",
      OTHER: "أخرى",
    },
    remarkTones: {
      POSITIVE: "إيجابية",
      NEUTRAL: "محايدة",
      CONCERN: "مقلقة",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  classroomTimetable: "استعمال الزمن",
  classroomAttendance: "الحضور",
  classroomDevoirs: "الواجبات",
  classroomRemarks: "الملاحظات",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    classroom: "فضاء الأستاذ",
  },
  codes: {
    "classroom.workspace": "فتح فضاء الأستاذ",
    "classroom.attendanceView": "الاطلاع على الحضور",
    "classroom.attendanceMark": "تسجيل الحضور",
    "classroom.attendanceJustify": "تبرير الغياب",
    "classroom.remarkView": "قراءة الملاحظات",
    "classroom.remarkWrite": "كتابة الملاحظات",
    "classroom.remarkPublish": "إبلاغ الأسرة بملاحظة",
  },
};

export default ar;
