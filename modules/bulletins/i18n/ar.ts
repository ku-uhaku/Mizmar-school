/**
 * Bulletins translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  bulletin: {
    title: "بيانات النقط",
    subtitle: "ما تُفضي إليه نقط الأسدس، يُبتّ فيه في المجلس ويُسلَّم للأسر.",

    class: "القسم",
    term: "الأسدس",
    pickClass: "اختر قسمًا…",
    pickTerm: "اختر أسدسًا…",
    pickBoth: "اختر قسمًا وأسدسًا للبدء.",
    pickBothHint:
      "تُحتسب بيانات النقط للقسم كاملًا — فالرتبة لا معنى لها بمعزل عن الآخرين.",

    compute: "احتساب النتائج",
    recompute: "إعادة الاحتساب",
    computeHint:
      "يقرأ كل نقط الأسدس المصادق عليها ويملأ المعدلات والرتب والمواظبة. ولا يمسّ ما سبق تدوينه من تقديرات وقرارات.",
    computed: "تم احتساب {count} من بيانات النقط.",
    computedWithSkipped:
      "احتُسب {count}. و{skipped} منشورة سلفًا فتُركت على حالها.",
    computedOn: "احتُسب في {date}",
    noRoster: "لا تلميذ مسجّل في هذا القسم خلال هذا الأسدس.",
    noProgramme:
      "لم تُحدَّد أي مادة مُنقَّطة لهذا المستوى. املأ البرنامج أولًا في الإعدادات ← الدراسة.",
    termMismatch: "هذا الأسدس يعود إلى سنة دراسية أخرى.",

    publish: "النشر للأسر",
    publishHint:
      "ينشر القسم كاملًا دفعة واحدة ويُجمِّد كل الأرقام. ولا يمكن إعادة احتساب بيان منشور حتى يُسحب.",
    published: "نُشر {count} من بيانات النقط.",
    withdraw: "سحب",
    withdrawHint: "يسحبها من الأسر لإتاحة تصحيحها.",
    withdrawn: "سُحب {count} من بيانات النقط.",
    nothingToPublish: "لا شيء لنشره — احتسب النتائج أولًا.",
    publishedLocked: "هذا البيان منشور. اسحبه قبل تغيير أي شيء فيه.",
    publishedOn: "نُشر في {date}",

    council: "مجلس القسم",
    councilHint:
      "سطر لكل تلميذ. تُقترح الملاحظة انطلاقًا من المعدل ويمنحها المجلس.",
    pupil: "التلميذ",
    generalAverage: "المعدل العام",
    yearAverage: "المعدل السنوي",
    rank: "الرتبة",
    rankOf: "{rank} من {size}",
    classSize: "التلاميذ",
    classAverage: "معدل القسم",
    classLowest: "أدنى معدل",
    classHighest: "أعلى معدل",
    mention: "الملاحظة",
    suggested: "المقترحة: {mention}",
    noMention: "بدون ملاحظة",
    decision: "قرار نهاية السنة",
    decisionHint:
      "يُطلب في الأسدس الأخير فقط — وهو ما تُفضي إليه سنة التلميذ.",
    noDecision: "لم يُبتّ فيه",
    councilComment: "ملاحظة المجلس",
    mainTeacherComment: "ملاحظة الأستاذ الرئيسي",

    subject: "المادة",
    coefficient: "المعامل",
    average: "المعدل",
    marks: "النقط",
    appreciation: "التقدير",
    appreciationHint: "سطر أو سطران عن هذا التلميذ في مادتك.",
    noMark: "—",
    absences: "الغيابات",
    unjustifiedAbsences: "غير مبرَّرة",
    lates: "التأخرات",
    attendance: "المواظبة",
    outOf: "من {max}",

    noBulletins: "لا بيان نقط لهذا القسم وهذا الأسدس.",
    noBulletinsHint: "احتسب النتائج وستظهر هنا.",
    noneForPupil: "لم يُنشر بعدُ أي بيان نقط لهذا التلميذ.",
    saved: "تم الحفظ.",
    print: "طباعة",
    printClass: "طباعة القسم كاملًا",
    reportCard: "بيان النقط",
    termResults: "النتائج حسب الأسدس",
  },
  bulletinOptions: {
    statuses: {
      DRAFT: "مسودة",
      PUBLISHED: "منشور",
    },
    mentions: {
      FELICITATIONS: "تهنئة",
      ENCOURAGEMENTS: "تشجيع",
      TABLEAU_HONNEUR: "لوحة الشرف",
      AVERTISSEMENT: "إنذار",
    },
    decisions: {
      ADMITTED: "ينتقل إلى المستوى الموالي",
      ADMITTED_CONDITIONAL: "ينتقل بشروط",
      REPEATING: "يكرّر السنة",
      REORIENTED: "يُعاد توجيهه",
    },
  },
} as const;

export const nav = {
  bulletins: "بيانات النقط",
} as const;

export const permissions = {
  groups: {
    bulletin: "بيانات النقط",
  },
  codes: {
    "bulletin.view": "الاطلاع على بيانات النقط",
    "bulletin.compute": "احتساب نتائج قسم",
    "bulletin.appreciate": "تدوين التقديرات حسب المادة",
    "bulletin.council": "منح الملاحظات والبتّ في السنة",
    "bulletin.publish": "نشر بيانات النقط للأسر",
  },
} as const;

export default ar;
