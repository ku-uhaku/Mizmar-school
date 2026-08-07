/**
 * Configuration translations (ar). Same shape as `en.ts`, which is canonical —
 * a key added there is a compile error here until it is supplied.
 */
const ar = {
  configuration: {
    title: "الإعدادات",
    subtitle: "اضبط طريقة عمل هذه المدرسة.",
    scopeSchool: "إعدادات {school}.",
    scopeYear: "{school} — {year}.",
    newItem: "إدخال جديد",
    editItem: "تعديل الإدخال",
    created: "تم إنشاء الإدخال.",
    updated: "تم تحديث الإدخال.",
    deleted: "تم حذف الإدخال.",
    empty: "لا توجد إعدادات بعد.",
    deleteTitle: "حذف هذا الإدخال؟",
    deleteBody: "سيتم حذفه من إعدادات هذه المدرسة.",
    outOfContext: "هذا الاختيار لا ينتمي إلى المدرسة التي تعمل بها.",

    arrivalBeforeDeparture:
      "يجب أن يكون الوصول بعد الانطلاق.",
    inUse:
      "لا يمكن الحذف — ما زال {count} سجلًا آخر يستعمله. احذفها أو أعد ربطها أولاً.",

    sections: {
      school: "المؤسسة",
      academics: "البنية البيداغوجية",
      facilities: "المرافق",
      year: "السنة الدراسية",
      classes: "الأقسام",
      billing: "الرسوم",
      treasury: "الصندوق",
      logistique: "النقل",
    },

    scopeGroups: {
      general: "الإعدادات العامة",
      year: "السنة الدراسية",
    },

    groups: {
      billing: "الأقساط",
    },

    resources: {
      schoolWeeks: "أسابيع السنة",
      teacherUnavailability: "أوقات عمل الأساتذة",
      transportSchedules: "مواعيد النقل",
      supplyArticles: "\u0643\u062a\u0627\u0644\u0648\u062c \u0627\u0644\u0644\u0648\u0627\u0632\u0645",
      documentTypes: "\u0648\u062b\u0627\u0626\u0642 \u0627\u0644\u0645\u0644\u0641",
      suppliers: "\u0627\u0644\u0645\u0632\u0648\u0651\u062f\u0648\u0646",
      banks: "الأبناك",
      operationCategories: "الأبواب",
      operationSubcategories: "الأبواب الفرعية",
      operationMotifs: "الأسباب",
      educationLevels: "الأسلاك",
      levels: "المستويات",
      tracks: "الشعب",
      subjects: "المواد",
      programme: "المقرر",
      assessmentTypes: "أنواع الفروض",
      rooms: "القاعات",
      cities: "المدن",
      neighbourhoods: "الأحياء",
      terms: "الدورات",
      holidays: "العطل",
      teacherAbsences: "غيابات الأساتذة",
      timeSlots: "الحصص الزمنية",
      levelOfferings: "المستويات المفتوحة",
      schoolClasses: "الأقسام",
      classGroups: "الأفواج",
      schoolSettings: "قواعد الفوترة",
      feeTypes: "أنواع الرسوم",
      feeRates: "لائحة الأسعار",
      discounts: "التخفيضات",
    },

    fields: {
      defaultInstalmentCount: "عدد الأقساط في السنة",
      feeDueDayOfMonth: "يستحق يوم",
      weekNumber: "الأسبوع",
      weekParity: "المناوبة",
      weekLabel: "التسمية",
      teacher: "الأستاذ",
      timeSlot: "الحصة",
      unavailabilityReason: "السبب",
      scheduleDirection: "الاتجاه",
      departureTime: "الانطلاق",
      arrivalTime: "الوصول",
      region: "الجهة",
      city: "المدينة",
      landmark: "شارع أو معلمة",
      agency: "الوكالة",
      accountNumber: "رقم الحساب",
      categoryKind: "الاتجاه",
      operationCategory: "الباب",
      teacherSubjects: "من يدرّس ماذا",
      preferenceRank: "الأولوية",
      payrollWorkingDays: "أيام العمل في الشهر",
      name: "الاسم",
      nameAr: "الاسم بالعربية",
      code: "الرمز",
      shortName: "الاختصار",
      massarCode: "رمز مسار",
      position: "الترتيب",
      isActive: "نشط",
      cycle: "السلك",
      educationLevel: "السلك",
      level: "المستوى",
      track: "الشعبة",
      subject: "المادة",
      parentSubject: "المادة الأم",
      gradeYear: "السنة داخل السلك",
      defaultCoefficient: "الوزن الافتراضي",
      defaultMaxScore: "النقطة القصوى",
      countsTowardAverage: "يُحتسب في المعدل",
      gradesWholeSubject: "يُجرى على المادة كاملة",
      allowTeacherCreate: "يمكن للأساتذة إعطاؤه",
      supplyCategory: "\u0627\u0644\u0641\u0626\u0629",
      defaultQuantity: "\u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0639\u062a\u0627\u062f\u0629",
      supplyArticleNotes: "\u062a\u0641\u0635\u064a\u0644",
      supplierKind: "\u0627\u0644\u0646\u0648\u0639",
      defaultCategory: "\u064a\u064f\u062d\u0645\u0644 \u0639\u0644\u0649",
      accountRef: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062f",
      isRequiredDocument: "\u0625\u062c\u0628\u0627\u0631\u064a\u0629",
      copies: "\u0627\u0644\u0646\u0633\u062e",
      documentNotes: "\u062a\u0648\u0636\u064a\u062d",
      colorHex: "اللون",
      isLanguage: "مادة لغوية",
      requiresLab: "تتطلب مختبرا",
      coefficient: "المعامل",
      weeklyMinutes: "دقائق في الأسبوع",
      isGraded: "منقطة",
      isEliminatory: "إقصائية",
      roomKind: "النوع",
      building: "البناية",
      floor: "الطابق",
      capacity: "الطاقة الاستيعابية",
      notes: "ملاحظات",
      termNumber: "الرقم",
      startDate: "تاريخ البداية",
      holidayKind: "النوع",
      absenceKind: "السبب",
      substitute: "ينوب عنه",
      endDate: "تاريخ النهاية",
      status: "الحالة",
      dayOfWeek: "اليوم",
      session: "الفترة",
      startTime: "البداية",
      endTime: "النهاية",
      scheduleKind: "التوقيت",
      isBreak: "استراحة",
      levelOffering: "المستوى المفتوح",
      plannedCapacity: "المقاعد المتوقعة",
      section: "الفوج",
      mainTeacher: "الأستاذ الرئيسي",
      room: "القاعة المعتادة",
      schoolClass: "القسم",
      purpose: "الغرض",
      feeKind: "النوع",
      billingCycle: "طريقة التحصيل",
      isMandatory: "إجبارية",
      feeType: "الرسم",
      amount: "المبلغ (درهم)",
      instalmentCount: "عدد الأقساط",
      perInstalment: "نفس المبلغ في كل قسط",
      discountKind: "النوع",
      percentBps: "النسبة المئوية",
      discountReason: "السبب",
      isStackable: "قابل للجمع",
    },

    hints: {
      defaultInstalmentCount:
        "عدد الأقساط التي يُقسَّم إليها رسم شهري. اتركه 0 ليتبع السنة الدراسية — فسنة من اثني عشر شهرًا تُفوتر اثنتي عشرة مرة. وتغلب التسعيرة التي تحدد عددها الخاص.",
      feeDueDayOfMonth:
        "اليوم من الشهر الذي يستحق فيه كل قسط. محدود بـ 28 حتى يوجد في فبراير.",
      supplierKind:
        "\u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062a \u0648\u0627\u0644\u0645\u0643\u0631\u064a \u0648\u0645\u0642\u062f\u0651\u0645\u0648 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u062a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631\u061b \u0648\u0627\u0644\u0645\u0632\u0648\u0651\u062f\u0648\u0646 \u0641\u064a \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a.",
      defaultCategory:
        "\u0627\u0644\u0628\u0627\u0628 \u0627\u0644\u0630\u064a \u062a\u064f\u062d\u0645\u0644 \u0639\u0644\u064a\u0647 \u0623\u062f\u0627\u0621\u0627\u062a\u0647\u060c \u064a\u064f\u0645\u0644\u0623 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627.",
      accountRef:
        "\u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062f \u0623\u0648 \u0627\u0644\u0648\u062b\u064a\u0642\u0629 \u2014 \u064a\u064f\u0639\u0631\u0636 \u0628\u062c\u0627\u0646\u0628 \u0627\u0644\u0645\u0628\u0644\u063a \u0644\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629.",
      isRequiredDocument:
        "\u0627\u0644\u0648\u062b\u064a\u0642\u0629 \u0627\u0644\u0625\u062c\u0628\u0627\u0631\u064a\u0629 \u0648\u062d\u062f\u0647\u0627 \u062a\u0648\u0642\u0641 \u0627\u0644\u062a\u0633\u062c\u064a\u0644. \u0623\u0645\u0627 \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u0629 \u0641\u062a\u064f\u0637\u0644\u0628 \u0648\u062a\u064f\u0639\u0631\u0636 \u062f\u0648\u0646 \u0623\u0646 \u062a\u0645\u0646\u0639.",
      copies:
        "\u0639\u062f\u062f \u0627\u0644\u0646\u0633\u062e \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629. \u0627\u062a\u0631\u0643\u0647 \u0641\u0627\u0631\u063a\u064b\u0627 \u0625\u0630\u0627 \u0643\u0641\u062a \u0646\u0633\u062e\u0629 \u0648\u0627\u062d\u062f\u0629.",
      documentNotes:
        "\u0645\u0646 \u0623\u064a\u0646 \u062a\u064f\u0633\u062d\u0628\u060c \u0648\u0645\u0627 \u0645\u062f\u0629 \u0635\u0644\u0627\u062d\u064a\u062a\u0647\u0627 \u2014 \u0645\u0627 \u0644\u0627 \u064a\u0642\u0648\u0644\u0647 \u0627\u0644\u0627\u0633\u0645.",
      supplyCategory:
        "\u0631\u0641 \u0627\u0644\u0645\u0643\u062a\u0628\u0629 \u0627\u0644\u0630\u064a \u064a\u0646\u062a\u0645\u064a \u0625\u0644\u064a\u0647 \u0627\u0644\u0645\u0646\u062a\u0648\u062c\u060c \u0648\u0645\u0646\u0647 \u064a\u064f\u0631\u062a\u0651\u0628 \u0645\u062e\u062a\u0627\u0631 \u0627\u0644\u0644\u0627\u0626\u062d\u0629.",
      defaultQuantity:
        "\u062a\u064f\u0645\u0644\u0623 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0639\u0646\u062f \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0645\u0646\u062a\u0648\u062c. \u0627\u062a\u0631\u0643\u0647\u0627 \u0641\u0627\u0631\u063a\u0629 \u0644\u0645\u0627 \u0644\u0627 \u064a\u064f\u0639\u062f\u0651.",
      supplyArticleNotes:
        "\u0627\u0644\u0642\u064a\u0627\u0633 \u0648\u0627\u0644\u062a\u0633\u0637\u064a\u0631 \u0648\u0627\u0644\u062d\u062c\u0645 \u2014 \u0645\u0627 \u064a\u062e\u0635\u0651 \u0627\u0644\u0645\u0646\u062a\u0648\u062c \u0644\u0627 \u0644\u0627\u0626\u062d\u0629 \u0628\u0639\u064a\u0646\u0647\u0627.",
      weekNumber:
        "يعدّ الأسابيع التي تُدرَّس فعلًا — تُتخطى العطل ولا تُرقَّم.",
      weekParity:
        "يناوب بين A وB حتى تتسع حصة كل أسبوعين في جدول واحد. عدِّل سطرًا لتغيير موضع استئناف المناوبة.",
      weekLabel: "فقط للأسابيع التي لها تسمية — «الامتحانات»، «الدخول».",
      timeSlot: "الحصة التي لا يعمل فيها هذا الأستاذ.",
      unavailabilityReason:
        "لمن يبني الجدول — «يدرّس في المؤسسة الأخرى»، «بدوام جزئي».",
      scheduleDirection:
        "تسير الرحلة في اتجاه واحد. التلميذ الذي يقطع الذهاب والإياب يُسجّل في رحلتين، أو على المسار نفسه.",
      arrivalTime:
        "يُترك فارغًا ما لم تُضبط مدة الجولة بعد.",
      region: "اختياري — يفيد فقط في تجميع لائحة طويلة.",
      holidayEnd: "شامل — ليوم واحد، كرّر تاريخ البداية.",
      substitute: "اتركه فارغًا إذا لم ينب عنه أحد.",
      landmark: "ما يحدّد موقعه عندما لا يكفي الاسم وحده.",
      agency: "الوكالة التي تحتفظ فيها المدرسة بحسابها فعلًا.",
      accountNumber: "حساب المدرسة، للتحويلات التي تصدرها.",
      categoryKind:
        "الاتجاه الذي يجوز استعماله فيه. «كلاهما» لباب مثل التسوية.",
      subcategoryParent: "الباب الذي يتبعه. لا يُختار الباب الفرعي وحده أبدًا.",
      motifCategory: "اتركه فارغًا ليُقترح تحت كل الأبواب.",
      preferenceRank:
        "الأدنى أولاً عند تعدّد الأساتذة. 0 للمتخصّص، وأعلى لمن يسدّ الخصاص.",
      payrollWorkingDays:
        "يقسّم الأجر الشهري لاقتراح أجرة اليوم. ويبقى اقتراحًا لا يُطبَّق تلقائيًا.",
      gradesWholeSubject:
        "\u0641\u0639\u0651\u0644\u0647 \u0644\u0645\u0627 \u064a\u064f\u062c\u0631\u0649 \u0639\u0644\u0649 \u0627\u0644\u0645\u0627\u062f\u0629 \u0643\u0627\u0645\u0644\u0629 \u0641\u064a \u0641\u0631\u0636 \u0648\u0627\u062d\u062f \u2014 \u0627\u0644\u0641\u0631\u0648\u0636 \u0648\u0627\u0644\u0634\u0641\u0648\u064a. \u0648\u0625\u0630\u0627 \u0639\u064f\u0637\u0651\u0644 \u0641\u0641\u0631\u0636 \u0644\u0643\u0644 \u0645\u0643\u0648\u0651\u0646\u060c \u0643\u0645\u0627 \u0647\u0648 \u0627\u0644\u0634\u0623\u0646 \u0641\u064a \u0627\u0644\u0648\u0627\u062c\u0628.",
      allowTeacherCreate:
        "فعّله لما يعطيه الأستاذ بنفسه — الواجبات. أما الفروض فتبقى معطّلة، إذ يبرمجها المسؤول البيداغوجي وحده.",
      defaultCoefficient:
        "الوزن الأولي لفرض جديد من هذا النوع، داخل نقطة المادة في الدورة.",
      defaultMaxScore:
        "النقط في المغرب من 20، لكن الشفوي أو الأشغال التطبيقية غالبًا من 10.",
      countsTowardAverage:
        "عطّله بالنسبة لعمل يُنقّط ويُعرض على الأسرة لكنه يجب ألا يؤثر في المعدل.",
      position: "الأصغر يظهر أولا.",
      massarCode: "الرمز المقابل في منظومة مسار. اتركه فارغا إلى حين الربط.",
      levelCode: "الرمز المختصر للوزارة، مثل 1AP و3AC وTC و2BAC.",
      gradeYear: "الرتبة داخل السلك: 1AP تساوي 1 و6AP تساوي 6.",
      trackLevel: "الشعب تخص السلك التأهيلي فقط.",
      parentSubject:
        "حدّدها لجعل هذه المادة مكوّنا، مثل القراءة ضمن اللغة العربية.",
      programmeTrack: "اتركه فارغا ليطبق على جميع شعب المستوى.",
      coefficient:
        "الوزن في معدل المستوى — أو داخل المادة الأم بالنسبة للمكوّن.",
      weeklyMinutes: "الغلاف الزمني. ساعتان ونصف تساوي 150.",
      termNumber: "1 أو 2 في سنة من دورتين.",
      dayOfWeek: "الأسبوع من الاثنين إلى السبت.",
      scheduleKind: "احتفظ بتوقيت رمضان إلى جانب التوقيت العادي.",
      isBreak: "تشغل الجدول دون أن تحتوي على درس.",
      offeringTrack: "اتركه فارغا بالنسبة للابتدائي والإعدادي.",
      plannedCapacity: "المقاعد المزمع فتحها في جميع أقسام هذا المستوى.",
      mainTeacher: "المسؤول عن القسم: النقط والمجلس والأسر.",
      classRoom: "القاعة التي يدرس بها القسم عادة.",
      groupSubject: "حدّدها عندما يكون الفوج مخصصا لمادة واحدة.",
      billingCycle: "طريقة تحصيل المبلغ، لا طريقة الإعلان عنه.",
      isMandatory: "الرسوم الإجبارية تفرض على كل تلميذ مسجل.",
      feeRateLevel: "اتركه فارغا لتطبيق نفس السعر على جميع المستويات.",
      amount: "بالدرهم. يُسجّل بدقة السنتيم.",
      instalmentCount: "توزيع المبلغ على هذا العدد من الدفعات.",
      perInstalment:
        "معطّل: المبلغ أعلاه هو الإجمالي، يُوزَّع على الدفعات (كالواجبات الدراسية). مفعّل: يُفرض كاملاً في كل دفعة (كرسم مطعم أو نقل شهري ثابت).",
      discountKind: "نسبة مئوية أو مبلغ ثابت بالدرهم.",
      percentBps: "بالنسبة المئوية: 12,5 تعني خصم الثُمن.",
      discountFeeType: "اتركه فارغا للسماح به على جميع الرسوم.",
      isStackable: "إمكانية جمعه مع تخفيض آخر.",
    },
  },

  configOptions: {
    weekParities: {
      A: "الأسبوع A",
      B: "الأسبوع B",
    },
    supplyCategories: {
      ECRITURE: "\u0627\u0644\u0643\u062a\u0627\u0628\u0629",
      CAHIERS: "\u0627\u0644\u062f\u0641\u0627\u062a\u0631",
      COUVERTURES: "\u0627\u0644\u0623\u063a\u0644\u0641\u0629",
      CLASSEMENT: "\u0627\u0644\u062a\u0631\u062a\u064a\u0628",
      GEOMETRIE: "\u0627\u0644\u0647\u0646\u062f\u0633\u0629",
      ARTS: "\u0627\u0644\u062a\u0631\u0628\u064a\u0629 \u0627\u0644\u062a\u0634\u0643\u064a\u0644\u064a\u0629",
      CARTABLE: "\u0627\u0644\u0645\u062d\u0641\u0638\u0629 \u0648\u0627\u0644\u0645\u0642\u0644\u0645\u0629",
      SPORT: "\u0627\u0644\u0631\u064a\u0627\u0636\u0629",
      HYGIENE: "\u0627\u0644\u0646\u0638\u0627\u0641\u0629",
      AUTRE: "\u0645\u062a\u0641\u0631\u0642\u0627\u062a",
    },
    scheduleDirections: {
      MORNING: "صباحًا",
      AFTERNOON: "بعد الزوال",
    },
    categoryKinds: {
      IN: "مداخيل",
      OUT: "مصاريف",
      BOTH: "كلاهما",
    },
    cycles: {
      PRESCHOOL: "التعليم الأولي",
      PRIMARY: "التعليم الابتدائي",
      SECONDARY_COLLEGE: "الثانوي الإعدادي",
      SECONDARY_QUALIFYING: "الثانوي التأهيلي",
    },
    absenceKinds: {
      SICK: "عطلة مرضية",
      LEAVE: "رخصة",
      TRAINING: "تكوين",
      OTHER: "أخرى",
    },
    holidayKinds: {
      SCHOOL_HOLIDAY: "عطلة مدرسية",
      PUBLIC_HOLIDAY: "عيد وطني",
      EXAM_PERIOD: "فترة امتحانات",
      CLOSURE: "إغلاق",
    },
    roomKinds: {
      CLASSROOM: "قاعة الدرس",
      LAB_SCIENCE: "مختبر",
      LAB_COMPUTER: "قاعة الإعلاميات",
      WORKSHOP: "ورشة",
      SPORTS: "الرياضة",
      LIBRARY: "الخزانة",
      MULTIPURPOSE: "قاعة متعددة الاستعمالات",
      OUTDOOR: "فضاء خارجي",
    },
    termStatuses: {
      PLANNED: "مبرمجة",
      ACTIVE: "جارية",
      CLOSED: "مغلقة",
    },
    days: {
      "1": "الاثنين",
      "2": "الثلاثاء",
      "3": "الأربعاء",
      "4": "الخميس",
      "5": "الجمعة",
      "6": "السبت",
      // مُتاح للمدرسة التي تدرّس يوم الأحد. أما اختيار الحصص فلا يعرض
      // إلا الأيام المصرَّح بها فعلًا.
      "7": "الأحد",
    },
    sessions: {
      MORNING: "صباحا",
      AFTERNOON: "مساء",
    },
    scheduleKinds: {
      STANDARD: "عادي",
      RAMADAN: "رمضان",
    },
    groupPurposes: {
      LAB: "أشغال تطبيقية",
      LANGUAGE: "لغة",
      SPORTS: "رياضة",
      SUPPORT: "دعم",
      OTHER: "أخرى",
    },
    feeKinds: {
      TUITION: "الرسوم الدراسية",
      REGISTRATION: "التسجيل",
      INSURANCE: "التأمين",
      TRANSPORT: "النقل",
      CANTEEN: "المطعم",
      CLUB: "نادٍ",
      SUPPLIES: "اللوازم",
      UNIFORM: "الزي المدرسي",
      EXAM: "الامتحان",
      OTHER: "أخرى",
    },
    billingCycles: {
      ANNUAL: "سنوي",
      MONTHLY: "شهري",
      TERM: "كل دورة",
      ONE_OFF: "مرة واحدة",
    },
    discountKinds: {
      PERCENTAGE: "نسبة مئوية",
      FIXED_AMOUNT: "مبلغ ثابت",
    },
    discountReasons: {
      SIBLING: "الإخوة",
      STAFF: "أبناء الموظفين",
      EARLY_PAYMENT: "الأداء المسبق",
      SCHOLARSHIP: "منحة",
      MERIT: "استحقاق",
      HARDSHIP: "حالة اجتماعية",
      OTHER: "أخرى",
    },
  },
};

/** Sidebar label this module contributes to the `nav` namespace. */
export const nav = { configuration: "الإعدادات" };

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: { configuration: "الإعدادات" },
  codes: {
    "configuration.view": "الاطلاع على الإعدادات",
    "configuration.manage": "تدبير الإعدادات",
  },
};

export default ar;
