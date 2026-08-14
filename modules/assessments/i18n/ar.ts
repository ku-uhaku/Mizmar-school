/**
 * Assessments translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const ar = {
  assessment: {
    validationQueue: "في انتظار اعتمادكم",
    generatedAcross: "تم إنشاء {count} فرضًا عبر {classes} أقسام.",
    willCover: "{classes} أقسام · {subjects} مواد لكل قسم",
    scope: "النطاق",
    scopeHint: "تُحضَّر سلسلة الفروض عادةً لمستوى كامل دفعة واحدة.",
    scopeClass: "قسم واحد",
    scopeLevel: "مستوى",
    scopeYear: "السنة كاملة",
    pickLevel: "المستوى",
    assessment: "الفرض",
    noMarksYet: "لا توجد نقط بعد.",
    noMarksHint: "تظهر النقط هنا كلما أدخلها الأساتذة.",
    overallAverage: "المعدل العام",
    marksCounted: "{count} نقطة مُدخَلة",
    coefficientShort: "معامل {value}",
    notCounted: "خارج المعدل",
    title: "الفروض",
    subtitle: "الأعمال المنقّطة خلال الدورة، والنقط المسجّلة عليها.",

    // ── اللائحة ─────────────────────────────────────────────────────────────
    paper: "فرض",
    papers: "الفروض",
    noAssessments: "لا يوجد أي فرض مقرر لهذا القسم وهذه الدورة.",
    noAssessmentsHint:
      "ولّد سلسلة كاملة دفعة واحدة، أو أضف فرضًا واحدًا يدويًا.",
    searchPlaceholder: "ابحث بالعنوان أو المادة أو القسم…",
    subject: "المادة",
    class: "القسم",
    term: "الدورة",
    kind: "النوع",
    sequence: "الرقم",
    sequenceHint: "ترتيبه بين فروض نوعه في الدورة — 1 للأول.",
    sequenceLabel: "رقم {sequence}",
    scheduledOn: "أُنجز في",
    notScheduled: "بدون تاريخ",
    maxScore: "من أصل",
    coefficient: "الوزن",
    coefficientHint:
      "الوزن داخل نقطة المادة في الدورة — وليس معامل المادة نفسها.",
    teacher: "الأستاذ",
    noTeacher: "لم يُسند إلى أي أستاذ",
    notes: "ملاحظات",
    covers: "ما يشمله",
    coversHint: "الدرس أو الصفحات، كما تُعلَن للقسم — «الدرس 3، ص. 42».",
    coversPlaceholder: "الدرس، الوحدة، الصفحات…",
    progress: "التصحيح",
    average: "المعدل",
    stage: "المرحلة",

    // ── متابعة الواجبات ─────────────────────────────────────────────────────
    devoirsReview: "متابعة الواجبات",
    devoirsReviewHint:
      "الواجبات التي أعطاها الأساتذة في المدرسة كلها، وما ينتظر المصادقة.",
    noDevoirs: "لم يعطِ أي أستاذ واجباً هذه السنة بعد.",
    noDevoirsHint: "تُنشأ الواجبات من فضاء الأستاذ وتظهر هنا تباعاً.",
    showingFirst: "أحدث {count}. ضيّق عوامل التصفية لرؤية الباقي.",
    allTeachers: "كل الأساتذة",
    allClasses: "كل الأقسام",

    // ── المولّد ─────────────────────────────────────────────────────────────
    generate: "توليد سلسلة",
    generateTitle: "توليد سلسلة من الفروض",
    generateHint:
      "يُنشئ فرضًا لكل مادة منقّطة في برنامج القسم. إعادة التشغيل لا تغيّر شيئًا — المواد التي لها هذا الفرض تُترك كما هي.",
    generated: "تم إنشاء {count} فروض، و{skipped} كانت موجودة سلفًا.",
    noSubjectsChosen: "اختر مادة واحدة على الأقل.",
    subjectsToGenerate: "المواد",
    subjectsToGenerateHint:
      "أزل ما لا يُمتحن فيه، وأعطِ كل فرض تاريخه الخاص — السلسلة تمتد على أسبوع لا على صبيحة واحدة.",
    wholeSubjectHint:
      "هذا النوع يُجرى على المادة كاملة — فرض واحد للغة العربية لا فرض لكل مكوّن. اختر مكوّنًا بدل ذلك إن أردت الاقتصار عليه.",
    orOneComponent: "أو أحد مكوّناتها فقط",
    allSubjects: "الكل",
    noneSubjects: "لا شيء",
    nothingToGenerate: "كل المواد لها هذا الفرض بالفعل.",
    noTeacherAssigned:
      "لم يُنشأ شيء لـ {subjects} — لا أستاذ مسند إليها في هذا القسم.",
    unstaffedSubjects:
      "{count} مادة/مواد لا يمكن توليدها ما لم يُسند إليها أستاذ.",
    noProgramme:
      "لا توجد مادة منقّطة في برنامج هذا القسم — اضبط البرنامج أولًا.",
    termClosed: "هذه الدورة مغلقة؛ لا يمكن إضافة أي فرض إليها.",

    // ── فرض واحد ────────────────────────────────────────────────────────────
    editAssessment: "تعديل الفرض",
    saved: "تم حفظ الفرض.",
    deleted: "تم حذف الفرض.",
    deleteTitle: "حذف هذا الفرض؟",
    deleteBody: "سيتم حذف «{name}».",
    cannotDeleteMarked: "هذا الفرض عليه نقط — ألغِه بدل حذفه.",
    maxScoreBelowMarks: "بعض النقط تتجاوز هذا المجموع. صحّحها قبل خفضه.",
    statusChanged: "تم تحديث الحالة.",
    cannotUnpublish: "تم إدخال نقط بالفعل — لا يمكن إرجاع هذا الفرض إلى مسودة.",
    publish: "نشر",
    unpublish: "إرجاع إلى مسودة",

    // ── تسليم النقط ─────────────────────────────────────────────────────────
    submitMarks: "تسليم النقط",
    takeBack: "استرجاع",
    acceptMarks: "المصادقة على النقط",
    reopen: "إعادة الفتح",
    awaitingValidation: "تم التسليم. في انتظار مصادقة الإدارة على هذه النقط.",
    awaitingYourValidation:
      "سلّم الأستاذ تصحيحه — صادِق عليه لتصبح النقط نهائية.",
    cannotValidateIncomplete:
      "بعض التلاميذ بلا نقطة ولا غياب. أكمل الورقة قبل المصادقة عليها.",

    // ── ورقة النقط ──────────────────────────────────────────────────────────
    markSheet: "ورقة النقط",
    pupil: "التلميذ",
    score: "النقطة",
    absent: "غائب",
    excused: "بعذر",
    comment: "ملاحظة",
    saveMarks: "حفظ النقط",
    marksSaved: "تم تسجيل {count} نقطة.",
    notPublished: "هذا الفرض لم يُنشر بعد — انشره قبل إدخال النقط.",
    scoreOutOfRange: "يجب أن تتراوح النقط بين 0 و{max}.",
    emptyRoster: "لا يوجد أي تلميذ مسند إلى هذا القسم.",
    markedOf: "{marked} نقطة من أصل {total}",
    pending: "بقي للتصحيح",
    passMarkIs: "النجاح ابتداءً من {mark}/{max}.",
    passRate: "نسبة النجاح",
    lowest: "أدنى نقطة",
    highest: "أعلى نقطة",
    absencesExcluded: "الغيابات غير محتسبة في المعدل.",
    markAllAbsent: "تسجيل الباقي كغائبين",
    clearMarks: "مسح",

    // ── سلم التقديرات ───────────────────────────────────────────────────────
    scaleTitle: "التقديرات",
    scaleSubtitle: "العبارة المرافقة للنقطة، والعتبة التي تبتدئ عندها.",
    scaleHelp:
      "يمتد كل مستوى من عتبته إلى عتبة المستوى الذي يليه. تُحدَّد العتبات كنسبة من سلم الفرض، فالسلم نفسه يصلح لامتحان شفوي على 10 وفرض على 20.",
    scaleEmpty: "لا يوجد سلم. تُدخَل النقط دون تقدير مقترح.",
    scaleFrom: "ابتداءً من",
    scaleCovers: "على 20",
    scaleLabel: "التقدير",
    scaleLabelAr: "التقدير (بالعربية)",
    scaleColour: "اللون",
    scaleActive: "مُستعمل",
    scaleAdd: "إضافة مستوى",
    scaleReset: "استعادة السلم المعتاد",
    scaleRemove: "حذف هذا المستوى",
    scaleSave: "حفظ السلم",
    scaleSaved: "تم حفظ السلم.",
    scaleDuplicateFloor: "مستويان ينطلقان من العتبة نفسها.",
    scaleTooMany: "لا يتجاوز السلم {max} مستويات.",
    scaleNoBottom:
      "لا ينطلق أي مستوى من 0٪، لذا لن يكون للنقط المنخفضة تقدير مقترح.",
    scaleExample: "نقطة {mark}/{max} تعطي: {label}",

    // ── الخلاصة ─────────────────────────────────────────────────────────────
    awaitingMarks: "في انتظار النقط",
    awaitingMarksHint: "فروض منشورة لم يكتمل تصحيحها.",
    drafts: "مسودات",
    draftsHint: "مقررة ولم يُعلن عنها بعد.",
    gradesEntered: "النقط المدخلة",
  },
  assessmentOptions: {
    statuses: {
      DRAFT: "مسودة",
      PUBLISHED: "منشور",
      SUBMITTED: "مُسلَّم",
      GRADED: "مصحَّح",
      CANCELLED: "ملغى",
    },
    /** لمن الدور — انظر `ASSESSMENT_STAGES`. */
    stages: {
      ALL: "الكل",
      TO_PUBLISH: "للفتح",
      MARKING: "قيد التسجيل",
      TO_VALIDATE: "للمصادقة",
      DONE: "مصادق عليها",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  assessments: "الفروض",
  devoirs: "الواجبات",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    assessment: "الفروض",
  },
  codes: {
    "assessment.view": "الاطلاع على الفروض والنقط",
    "assessment.manage": "برمجة وتوليد الفروض",
    "assessment.grade": "إدخال النقط",
    "assessment.publish": "نشر الفروض وسحبها",
    "assessment.delete": "حذف الفروض",
    "assessment.scale": "تعديل سلم التقديرات",
  },
};

export default ar;
