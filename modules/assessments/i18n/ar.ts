/**
 * Assessments translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const ar = {
  assessment: {
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
    scheduledOn: "أُنجز في",
    notScheduled: "بدون تاريخ",
    maxScore: "من أصل",
    coefficient: "الوزن",
    coefficientHint:
      "الوزن داخل نقطة المادة في الدورة — وليس معامل المادة نفسها.",
    teacher: "الأستاذ",
    noTeacher: "لم يُسند إلى أي أستاذ",
    notes: "ملاحظات",
    progress: "التصحيح",
    average: "المعدل",

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
    allSubjects: "الكل",
    noneSubjects: "لا شيء",
    nothingToGenerate: "كل المواد لها هذا الفرض بالفعل.",
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
      GRADED: "مصحَّح",
      CANCELLED: "ملغى",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  assessments: "الفروض",
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
  },
};

export default ar;
