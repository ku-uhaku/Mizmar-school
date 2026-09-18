/**
 * MASSAR translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 *
 * The mark sheet itself is an Arabic document — the class, the subject and every
 * pupil's name come out of MASSAR in Arabic — so this is the language the screen
 * is most often read in. Terms are the ones printed on the file: مسار, المراقبة
 * المستمرة, الفرض, الدورة.
 */
const ar = {
  massar: {
    title: "نقط مسار",
    subtitle:
      "التحقق من ورقة نقط المراقبة المستمرة مقابل هذه المؤسسة، ثم استيراد نقطها أو ملؤها من نقطنا.",

    stepType: "1. حدد نوع الفرض",
    stepTypeHint:
      "يُصنَّف الفرض ضمن أحد أنواع التقويم لديك. النوع يحدد المعامل، والملف يحدد السلّم.",
    assessmentType: "نوع الفرض",

    stepUpload: "2. اختر ملف مسار",
    stepUploadHint:
      "ملف ‎.xlsx‎ كما خرج من مسار. لا تُعِد حفظه ببرنامج آخر — فالمفاتيح المخفية التي يحملها هي ما يُعرِّف القسم.",
    chooseFile: "اختيار ملف",
    reading: "جارٍ قراءة المصنّف…",
    noFile: "لم يتم اختيار أي ملف.",

    stepReview: "3. تحقق، ثم اختر الاتجاه",
    stepReviewHint: "لا يُكتب أي شيء حتى تختار أحدها.",

    fileSays: "الملف يقول",
    youHold: "لديك",
    schoolCode: "المؤسسة",
    className: "القسم",
    level: "المستوى",
    subject: "المادة",
    term: "الدورة",
    controle: "الفرض",
    schoolYear: "السنة الدراسية",
    teacher: "الأستاذ",
    scale: "النقطة على",
    pupilCount: "التلاميذ",
    massarId: "معرّف ورقة مسار",
    unmappedKeys: "مفاتيح محفوظة دون مطابقة: {keys}",
    unmappedHint:
      "يضعها مسار في الورقة دون بيان معناها. تُحفظ مع الملف ولا تُقارَن أبدًا.",
    notMapped: "غير مرتبط",
    notOnFile: "لا شيء في السجل",

    checksTitle: "الفحوصات",
    check: "الفحص",
    expected: "لديك",
    found: "الملف يقول",
    severity: "النتيجة",
    allChecksPassed: "نجحت جميع الفحوصات.",
    blockedBy: "موقوف بسبب {count} فحص/فحوص فاشلة. لا يمكن كتابة أي شيء قبل تصحيحها.",

    severities: {
      OK: "مطابق",
      ADOPTABLE: "غير مرتبط بعد",
      WARNING: "للعلم",
      ERROR: "غير مطابق",
    },

    checks: {
      FILE_SHAPE: "بنية الملف",
      SCHOOL_CODE: "رمز المؤسسة",
      SCHOOL_YEAR: "السنة الدراسية",
      LEVEL: "المستوى",
      CLASS: "القسم",
      SUBJECT: "المادة",
      TERM: "الدورة",
      SEQUENCE: "رقم الفرض",
      MAX_SCORE: "سلّم التنقيط",
      TEACHER: "الأستاذ",
      ASSESSMENT_EXISTS: "الفرض في السجل",
      ASSESSMENT_IDENTITY: "معرّف ورقة مسار",
      ROSTER_SIZE: "عدد تلاميذ القسم",
      PUPIL_DUPLICATE: "التلميذ مُدرج مرتين",
      PUPIL_UNKNOWN: "تلميذ غير مسجّل لديك",
      PUPIL_NOT_IN_CLASS: "التلميذ في قسم آخر",
      PUPIL_NUMBER: "رقم التلميذ في مسار",
      PUPIL_NAME: "اسم التلميذ",
      PUPIL_BIRTH_DATE: "تاريخ الازدياد",
      PUPIL_MISSING_FROM_FILE: "غير موجود في الملف",
      SCORE_RANGE: "نقطة خارج السلّم",
      SCORE_MISSING: "لا توجد نقطة بعد",
    },

    rowsTitle: "التلاميذ",
    line: "السطر",
    cell: "الخلية",
    pupil: "التلميذ",
    massarCode: "رمز مسار",
    score: "النقطة",
    absent: "غائب",
    comment: "الملاحظة",
    problem: "المشكل",
    matchedCount: "{count} مطابَق",
    rejectedCount: "{count} مرفوض",
    missingCount: "{count} في اللائحة وغير موجود في الملف",
    willAdoptNumber: "سيُسجَّل رقمه في مسار",
    showingFirst: "عرض أول {count} من أصل {total}.",

    directionsTitle: "ماذا تريد أن تفعل؟",

    generateTitle: "إنشاء الفرض",
    generateHint: "يفتح الفرض المعني ويضع عليه معرّف مسار. لا تُكتب أي نقطة.",
    generate: "إنشاء الفرض",

    importTitle: "استيراد النقط",
    importHint:
      "يكتب نقط وملاحظات الملف على الفرض، وينشئه إن لم يكن موجودًا بعد.",
    import: "استيراد {count} نقطة",

    exportTitle: "ملء الورقة من هنا",
    exportHint:
      "يكتب نقطك في نفس المصنّف ويعيده إليك جاهزًا للرفع إلى مسار. يحتفظ الملف بحمايته وبمفاتيحه المخفية.",
    export: "تحميل الورقة الممتلئة",
    exported: "تمت كتابة {count} نقطة في الورقة.",

    adoptTitle: "اعتماد رموز مسار",
    adoptHint:
      "يسجّل الرموز التي يحملها هذا الملف على قسمك ومادتك ودورتك وتلاميذك، لتتم مطابقة الورقة القادمة مباشرة. يملأ الفارغ فقط.",
    adopt: "اعتماد الرموز",

    working: "جارٍ التنفيذ…",

    controleCreated: "تم إنشاء الفرض وهو يحمل معرّف مسار.",
    controleExisted: "كان هذا الفرض موجودًا؛ وقد سُجِّل عليه معرّف مسار.",
    imported: "تم استيراد {count} نقطة، ورُفض {rejected} سطرًا.",
    adopted: "تم ربط {fields} حقلًا، وتسجيل {pupils} رقم تلميذ في مسار.",

    // ── لائحة التلاميذ (ListEleve) ────────────────────────────────────────────
    roster: {
      title: "لائحة التلاميذ (ListEleve)",
      subtitle:
        "حمّل لائحة قسم من مسار — التلاميذ والأسر والقسم والتسجيلات مع جدول الأداءات — أو نزّل لائحة من هنا.",
      importTitle: "استيراد لائحة قسم",
      importHint: "يتم التعرف على التلاميذ برمزهم في مسار. لا يُكتب شيء قبل تأكيدك أدناه.",
      chooseFile: "اختر ملف ListEleve",
      reading: "جارٍ القراءة…",
      fileSchool: "المؤسسة",
      fileYear: "السنة",
      fileLevel: "المستوى",
      fileClass: "القسم",
      filePupils: "التلاميذ",
      classWillBeCreated: "القسم «{value}» غير موجود هذه السنة وسيتم إنشاؤه.",
      familiesTitle: "أسر للمراجعة",
      familiesHint:
        "لا يتضمن الملف أي ولي، لذلك يُجمع التلاميذ الذين يحملون نفس النسب في أسرة واحدة. افصل المجموعة إن لم تكن بينهم قرابة.",
      groupedPupils: "{count} تلاميذ يحملون هذا النسب",
      attachedTo: "ينضم إلى الأسرة الموجودة {code}",
      newHousehold: "أسرة جديدة",
      split: "فصل",
      group: "جمع",
      confirm: "استيراد {count} تلميذًا",
      importing: "جارٍ الاستيراد…",
      imported:
        "تم استيراد {count} تلميذًا، وفتح {families} أسرة، وإنشاء {classes} قسمًا، و{enrolled} تسجيلًا مع جدول أدائها.",
      exportTitle: "تنزيل لائحة قسم",
      exportHint:
        "يكتب قسمًا من السنة الحالية بصيغة ListEleve: رمز مسار، الأسماء بالعربية، النوع، تاريخ ومكان الازدياد.",
      chooseClass: "اختر قسمًا",
      exportAction: "تنزيل اللائحة",
      exporting: "جارٍ الإعداد…",
      exported: "تمت كتابة {count} تلميذًا في اللائحة.",
      errNoHeader: "هذا الملف ليس لائحة قسم من مسار — الجدول الذي عنوانه «الرمز» غير موجود فيه.",
      errWrongYear:
        "هذه اللائحة خاصة بـ {file}، لكن السنة الدراسية المحددة هي {current}. غيّر السنة أو نزّل اللائحة الصحيحة.",
      errNoClass: "اختر أولًا قسمًا من هذه السنة.",
    },

    errors: {
      emptyFile: "لا يوجد ملف، أو الملف كبير جدًا.",
      notXlsx:
        "هذا ليس مصنّف ‎.xlsx‎. أعد تحميل الورقة من مسار وارفعها دون فتحها ببرنامج آخر.",
      noSheet: "لا يحتوي المصنّف على أي ورقة ظاهرة للقراءة.",
      noMarkers:
        "هذا المصنّف ليس ورقة نقط المراقبة المستمرة — العلامات المخفية التي يكتبها مسار غير موجودة فيه.",
      noPupils: "الورقة لا تحتوي على أي تلميذ.",
      blocked: "فشلت بعض الفحوصات. صحّحها ثم أعد رفع الملف.",
      noRows: "لم يتم رَبْط أي تلميذ من الملف بهذا القسم.",
      noType: "هذا النوع من الفروض غير موجود في هذه المؤسسة.",
      locked: "هذا الفرض لا يقبل النقط — فهو ما يزال مسودة، أو تم إلغاؤه.",
      outOfRange: "توجد في الملف نقطة خارج سلّم الفرض.",
      assessmentNotFound: "هذا الفرض غير موجود في سجلات هذه المؤسسة.",
      nothingToAdopt: "لم يبق شيء لاعتماده — كل شيء مرتبط سلفًا.",
    },
  },
} as const;

export const nav = {
  massar: "مسار",
} as const;

export const permissions = {
  groups: {
    massar: "مسار",
  },
  codes: {
    "massar.reconcile": "التحقق من ملف مسار مقابل المؤسسة",
    "massar.import": "استيراد النقط من مسار",
    "massar.export": "ملء ورقة مسار من نقطنا",
    "massar.map": "اعتماد رموز مسار على الأقسام والتلاميذ",
  },
} as const;

export default ar;
