/**
 * School-life translations (ar). Same shape as `en.ts`, which is canonical — a
 * key added there is a compile error here until it is supplied.
 */
const ar = {
  schoolLife: {
    assessmentsHint: "فروض السنة والنقط المرتبطة بها.",
    attendanceHint: "الغيابات والتأخرات، في ملف كل تلميذ.",
    title: "الحياة المدرسية",
    subtitle: "{school} — {year}، إلى حدود اليوم.",
    noYear: "اختر سنة دراسية لعرض أرقام هذه السنة.",

    // ── ما سجّله الأساتذة ───────────────────────────────────────────────────
    absencesToday: "غيابات اليوم",
    absencesTodayHint: "من أصل {registers} تسجيلًا اليوم، مع السبب الذي ذكره الأستاذ.",
    latestRemarks: "آخر الملاحظات",
    latestRemarksHint: "ما كتبه الأساتذة عن التلاميذ.",
    awaitingValidation: "نقط مُسلَّمة",
    awaitingValidationHint: "أوراق أنهى الأستاذ تصحيحها. صادِق عليها لتصبح النقط نهائية.",
    students: "التلاميذ",
    studentsDetail: "{count} مسجّلين",
    families: "الملفات الأسرية",
    familiesDetail: "الأسر المسجّلة",
    pending: "تسجيلات في الانتظار",
    pendingDetail: "مطلوبة وغير مؤكّدة",
    unplaced: "في انتظار قسم",
    unplacedDetail: "مسجّلون وغير مسندين",
    billed: "المفوتر هذه السنة",
    billedDetail: "صافي التخفيضات",
    discounted: "التخفيضات الممنوحة",
    standing: "عدد التلاميذ",
    standingHint: "أين وصل كل ملف مفتوح في السجلات.",
    standingEnrolled: "مسجّلون",
    standingPreRegistered: "ملف مفتوح",
    standingLeft: "غادروا",
    pupilsTotal: "تلميذ",
    standingColumn: "الوضعية",
    occupancy: "المقاعد المشغولة",
    occupancyCaption: "{taken} من {total} مقعد",
    byLevel: "التلاميذ حسب المستوى",
    byLevelHint: "في المستويات التي فتحتها هذه المدرسة هذه السنة.",
    classFill: "امتلاء الأقسام",
    classFillHint: "العدد مقارنةً بالطاقة الاستيعابية.",
    noClasses: "لم يُفتح أي قسم.",
    noLevels: "لم يُفتح أي مستوى لهذه السنة.",
    pipeline: "ما يجب إنجازه",
    pipelineHint: "الملفات التي لم يكتمل مسارها.",
    allDone: "لا شيء معلّق.",
    familiesHint: "الملفات، ومن يُتصل به، وأطفال كل أسرة.",
    studentsHint: "جميع الأطفال المسجلين، مستواهم وقسمهم.",
    classesHint: "أقسام السنة، ونسبة امتلاء كل واحد.",
    timetableHint: "الأسبوع الذي يتبعه كل قسم، حصة بحصة.",
    unplacedCount: "{count} في انتظار الإسناد",
    openStudents: "فتح لائحة التلاميذ",
    openClasses: "فتح لائحة الأقسام",

    search: "بحث",
    searchPlaceholder: "ابحث عن تلاميذ أو أسر أو أقسام…",
    searchHint: "اكتب حرفين على الأقل.",
    searchEmpty: "لا توجد نتائج.",
    searchStudents: "التلاميذ",
    searchFamilies: "الأسر",
    searchClasses: "الأقسام",
  },
};

export const nav = {
};

export const permissions = {
  groups: {
    schoolLife: "الحياة المدرسية",
  },
  codes: {
    "schoolLife.view": "الاطلاع على النظرة العامة للحياة المدرسية",
  },
};

export default ar;
