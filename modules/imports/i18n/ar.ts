/** Imports translations (ar). Checked against `en` — see lib/i18n/types.ts. */
const ar = {
  imports: {
    title: "استيراد التلاميذ",
    subtitle:
      "حمّل لائحة التلاميذ من ملف Excel. تُنشأ الأسر والآباء معهم في الآن نفسه.",

    stepTemplate: "1. خذ الملف النموذج",
    stepTemplateHint:
      "يحمل عناوين الأعمدة المنتظرة وسطرًا للمثال. املأه في Excel ثم احذف سطر المثال.",
    downloadTemplate: "تحميل الملف النموذج",

    stepUpload: "2. اختر ملفك",
    stepUploadHint:
      "CSV، بالفاصلة المنقوطة أو بالفاصلة — حسب ما يحفظه Excel عندك. الأعمدة الزائدة تُتجاهل، فلا بأس بملف أغنى.",
    chooseFile: "اختيار ملف",
    reading: "جارٍ قراءة الملف…",

    stepReview: "3. تحقّق ثم أكّد",
    stepReviewHint: "لا يُحفظ شيء ما لم تؤكّد.",

    willCreate: "{count} للإنشاء",
    willSkip: "{count} مسجّلون سلفًا",
    willReject: "{count} مرفوضة",
    newFamilies: "{count} ملفات أُحدثت",
    ignoredColumns: "أعمدة متجاهَلة: {columns}",
    missingColumns:
      "ينقص الملفَّ عمودٌ إجباري: {columns}. خذ الملف النموذج وانقل إليه معطياتك.",
    line: "السطر",
    outcome: "النتيجة",
    pupil: "التلميذ",
    outcomeCreate: "إنشاء",
    outcomeSkip: "تجاهل",
    outcomeReject: "مرفوض",
    problem: "المشكل",
    attachedTo: "يلتحق بالملف {code}",
    showingFirst: "عرض أول {count} سطرًا من {total}.",
    allGood: "كل الأسطر قابلة للاستيراد.",

    confirm: "استيراد {count} تلميذًا",
    importing: "جارٍ الاستيراد…",
    imported: "استُورد {count} تلميذًا، وأُحدث {families} ملفًا.",
    enrolled: "استُورد {count} تلميذًا، وأُحدث {families} ملفًا، و{enrolled} تسجيلًا مع جدولة الواجبات.",
    willEnrol: "{count} تسجيلات",

    exportTitle: "تصدير التلاميذ",
    exportHint:
      "جميع التلاميذ بملفاتهم وآبائهم، بالصيغة نفسها التي تستوردها هذه الشاشة — فالملف الخارج يمكن أن يعود.",
    exportAction: "تصدير إلى Excel",
    exporting: "جارٍ التحضير…",
    exported: "صُدّر {count} سطرًا.",
    exportEmpty: "لا تلميذ للتصدير بعد.",

    errors: {
      emptyFile: "هذا الملف فارغ.",
      fileTooLarge: "هذا الملف كبير جدًا. قسّمه واستورده على مرّتين.",
      notCsv: "احفظ الملف بصيغة CSV من Excel ثم اختره من جديد.",
      nothingToImport: "لا شيء في هذا الملف أمكن استيراده.",
      requiredColumn: "{column} إجباري.",
      badDate:
        "{column}: «{value}» ليست تاريخًا يقرؤه الاستيراد. اكتبه هكذا 15/09/2012.",
      badGender: "«{value}» ليس جنسًا يقرؤه الاستيراد. اكتب F أو M.",
      alreadyOnFile: "مسجّل سلفًا باسم {name} ({code}).",
      duplicateInFile: "نفس التلميذ في السطر {line} من هذا الملف.",
      unknownLevel: "المستوى «{value}» غير مفتوح هذه السنة. المستويات المفتوحة: {available}.",
      unknownClass: "القسم «{value}» غير موجود في {level}. الأقسام: {available}.",
      unknownRoute: "الخط «{value}» غير موجود. الخطوط: {available}.",
      unknownStop: "المحطة «{value}» ليست على الخط {route}. المحطات: {available}.",
      noSchoolYear: "اختر سنة دراسية قبل استيراد التسجيلات.",
      alreadyEnrolled: "مسجّل سلفًا هذه السنة.",
    },

    columns: {
      code: "الرقم الداخلي",
      massarCode: "مسار",
      lastName: "النسب بالفرنسية",
      firstName: "الاسم بالفرنسية",
      lastNameAr: "النسب",
      firstNameAr: "الاسم",
      gender: "الجنس",
      birthDate: "تاريخ الازدياد",
      nationality: "الجنسية",
      birthCity: "مكان الازدياد",
      neighbourhood: "الحي",
      familyName: "الأسرة",
      familyPhone: "هاتف الأسرة",
      familyEmail: "بريد الأسرة",
      addressLine: "العنوان",
      city: "المدينة",
      fatherLastName: "الأب — النسب",
      fatherFirstName: "الأب — الاسم",
      fatherNationalId: "الأب — ب.ت.و",
      fatherPhone: "الأب — الهاتف",
      fatherProfession: "الأب — المهنة",
      motherLastName: "الأم — النسب",
      motherFirstName: "الأم — الاسم",
      motherNationalId: "الأم — ب.ت.و",
      motherPhone: "الأم — الهاتف",
      motherProfession: "الأم — المهنة",
      levelCode: "المستوى",
      trackCode: "الشعبة",
      className: "القسم",
      enrolledOn: "تاريخ التسجيل",
      isRepeating: "معيد",
      usesTransport: "النقل",
      routeName: "الخط",
      stopName: "المحطة",
      usesCanteen: "المطعم",
    },
  },
};

export const permissions = {
  groups: {
    import: "التحميل بالجملة",
  },
  codes: {
    "import.students": "استيراد التلاميذ من ملف Excel",
  },
} as const;

export default ar;
