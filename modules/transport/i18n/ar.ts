/**
 * Transport translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  transport: {
    voyages: "الرحلات",
    voyagesHint: "كل الرحلات المقررة اليوم، وأين وصلت كل واحدة.",
    runStart: "انطلاق",
    runArrive: "وصل",
    runCancel: "إلغاء الرحلة",
    runStarted: "انطلقت الرحلة.",
    runArrived: "أُقفلت الرحلة.",
    runCancelled: "أُلغيت الرحلة.",
    runAlreadyMoved: "تغيّرت حالة هذه الرحلة سلفًا — أعد تحميل اللوحة.",
    cancelRunReasonRequired: "بيّن سبب عدم إجراء الرحلة.",
    cancelRunTitle: "إلغاء هذه الرحلة؟",
    cancelRunHint: "تبقى في اللوحة كملغاة مع سببك. بيّن ما وقع: عطب، أو غياب سائق، أو طريق مقطوعة.",
    myVoyages: "رحلاتي",
    myVoyagesHint: "رحلات اليوم للحافلة التي تسوقها.",
    noRunsToday: "لا رحلة مقررة اليوم.",
    noRunsForDriver: "لا حافلة مسندة إليك اليوم.",
    plannedAt: "الانطلاق المقرر {time}",
    leftAt: "انطلقت {time}",
    arrivedAt: "رجعت {time}",
    lateBy: "تأخر {count} د",
    earlyBy: "تقدم {count} د",
    onTime: "في الوقت",
    runsEnRoute: "{count} في الطريق",
    runsEnRouteOne: "في الطريق",
    runsPending: "{count} لم تنطلق",
    riderCount: "{count} مشترك",
    title: "النقل",
    subtitle: "الحظيرة، والخطوط التي تخدمها، والتلاميذ المنقولون.",

    // ── Fleet ───────────────────────────────────────────────────────────────
    fleet: "الحظيرة",
    vehicles: "المركبات",
    vehicle: "المركبة",
    newVehicle: "مركبة جديدة",
    editVehicle: "تعديل المركبة",
    registration: "رقم التسجيل",
    registrationHint: "كما هو مكتوب في اللوحة، مثل 12345-A-6.",
    make: "الصانع",
    model: "الطراز",
    modelYear: "سنة الوضع في السير",
    seatCount: "المقاعد",
    seatCountHint: "المقاعد المتاحة للتلاميذ، وهي ليست دائمًا مقاعد المركبة كلها.",
    vehicleStatus: "الحالة",
    insurance: "انتهاء التأمين",
    inspection: "انتهاء الفحص التقني",
    complianceHint: "الحافلة التي انتهت وثائقها لا يجوز قانونًا أن تنقل التلاميذ.",
    driverStaff: "سائق من الموظفين",
    driverStaffHint:
      "يختار أحد موظفي المدرسة، حتى تشير الحافلة والأجور إلى الشخص نفسه.",
    driverExternal: "ليس موظفًا",
    driverName: "السائق",
    driverPhone: "هاتف السائق",
    driverHint: "من يُتصل به عندما تتأخر الحافلة.",
    noVehicles: "لا توجد أي مركبة في الحظيرة.",
    vehicleCreated: "تمت إضافة المركبة.",
    vehicleUpdated: "تم تحديث المركبة.",
    vehicleDeleted: "تم حذف المركبة.",
    registrationTaken: "رقم التسجيل موجود بالفعل في الحظيرة.",
    vehicleInUse: "خدمت هذه الحافلة خطًا — أحِلها على التقاعد بدل حذفها.",
    deleteVehicleTitle: "حذف هذه المركبة؟",
    deleteVehicleBody: "سيتم سحب «{name}» من الحظيرة.",
    expired: "منتهٍ",
    expiringSoon: "ينتهي قريبًا",
    paperworkDue: "وثائق للتجديد",
    noExpiryRecorded: "لم يُسجَّل أي تاريخ",

    riders: "المشتركون",

    // ── Lines ───────────────────────────────────────────────────────────────
    routes: "الخطوط",
    route: "الخط",
    newRoute: "خط جديد",
    editRoute: "تعديل الخط",
    routeCode: "الرمز",
    routeName: "الاسم",
    direction: "يخدم",
    assignedVehicle: "الحافلة",
    capacity: "المقاعد المعروضة",
    capacityHint: "اتركه فارغًا لاستعمال مقاعد الحافلة نفسها.",
    seats: "المقاعد",
    taken: "مشغولة",
    remaining: "شاغرة",
    routeFull: "هذا الخط ممتلئ.",
    routeCodeTaken: "رمز الخط مستعمل بالفعل هذه السنة.",
    routeCreated: "تم إنشاء الخط.",
    routeUpdated: "تم تحديث الخط.",
    routeDeleted: "تم حذف الخط.",
    routeHasRiders: "لهذا الخط مشتركون — انقلهم قبل حذفه.",
    deleteRouteTitle: "حذف هذا الخط؟",
    deleteRouteBody: "سيتم حذف «{name}».",
    noRoutes: "لم يُرسَم أي خط لهذه السنة بعد.",
    noVehicleAssigned: "لا حافلة مسندة",
    unassignedWarning:
      "الخط بلا حافلة لا يوفّر أي مقعد — أسند واحدة قبل اشتراك التلاميذ.",

    // ── Stops ───────────────────────────────────────────────────────────────
    stops: "المحطات",
    stop: "المحطة",
    newStop: "محطة جديدة",
    editStop: "تعديل المحطة",
    stopName: "المحطة",
    landmark: "المَعْلَمة",
    neighbourhood: "الحي",
    landmarkHint: "ما يُستدل به: «أمام الصيدلية».",
    position: "الترتيب",
    pickupTime: "وقت الأخذ",
    dropoffTime: "وقت الإنزال",
    invalidTime: "استعمل توقيتًا على 24 ساعة، مثل 07:30.",
    stopSaved: "تم حفظ المحطة.",
    stopDeleted: "تم حذف المحطة.",
    stopNameTaken: "هذه المحطة موجودة بالفعل في هذا الخط.",
    stopHasRiders: "يصعد تلاميذ من هنا — انقلهم قبل حذف المحطة.",
    noStops: "لا توجد أي محطة في هذا الخط.",

    // ── Riders ──────────────────────────────────────────────────────────────
    addRider: "اشتراك تلميذ",
    editRider: "تعديل الاشتراك",
    rider: "المشترك",
    noRiders: "لا يوجد أي تلميذ في هذا الخط.",
    pupil: "التلميذ",
    subscriptionStatus: "الحالة",
    startsOn: "ابتداءً من",
    endsOn: "إلى غاية",
    riderAdded: "تم اشتراك التلميذ.",
    riderAddedBilled: "تم اشتراك التلميذ — سُعِّرت {count} أقساط.",
    riderAddedPartly:
      "تم اشتراك {created} رحلة، ورÙفضت {refused} — الحافلة ممتلئة أو التلميذ مشترك في هذا الاتجاه.",
    riderUpdated: "تم تحديث الاشتراك.",
    riderRemoved: "تم فسخ الاشتراك.",
    riderRemovedBilled: "تم فسخ الاشتراك — أُلغيت {count} أقساط مقبلة.",
    alreadySubscribed: "هذا التلميذ مشترك بالفعل في هذا الاتجاه.",
    removeRiderTitle: "سحب هذا التلميذ من الحافلة؟",
    removeRiderBody:
      "سيفقد «{name}» مقعده. تُحفظ الأقساط المؤدّاة، وتُلغى الأقساط المقبلة غير المؤدّاة.",
    noSubscribable: "كل التلاميذ المسجّلين لهم مقاعد بالفعل.",
    notRiding: "هذا التلميذ لا يستعمل الحافلة.",
    transportOf: "النقل",
    billingNote:
      "يُفوتر النقل مرة واحدة عند التسجيل انطلاقًا من لائحة الأسعار. إسناد التلميذ إلى مسار لا يغيّر ما تدين به أسرته.",

    // ── Summary ─────────────────────────────────────────────────────────────
    seatsOffered: "المقاعد المعروضة",
    seatsFree: "المقاعد الشاغرة",
    ridersTotal: "المشتركون",
    linesRunning: "الخطوط العاملة",

    // ── لوحة قيادة القسم ────────────────────────────────────────────────────
    routesHint: "الخطوط المرسومة للسنة ومحطاتها ومن يصعد من أين.",
    fleetHint: "الحافلات والوثائق التي تسمح لها بالسير والسائق المكلف بكل واحدة.",
    paperworkCount: "{count} للتجديد",
    paperworkHint: "التأمين أو الفحص التقني منتهٍ أو ينتهي خلال الشهر.",
    allPapersValid: "جميع الحافلات العاملة وثائقها سارية.",
    stopsAcrossLines: "{count} محطة",
    ofSeatsOffered: "من أصل {count} مقعدًا",
    seatsFreeHint: "على مجموع الخطوط",
    busesInService: "{count} حافلة في الخدمة",
    occupancy: "نسبة امتلاء الخطوط",
    occupancyHint: "عدد المشتركين مقابل المقاعد التي يوفرها كل خط.",
    seatsTaken: "{taken} مقعدًا من {seats}",

    // ── \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f ──────────────
    schedules: "\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0646\u0642\u0644",
    schedule: "\u0631\u062d\u0644\u0629",
    noSchedules:
      "\u0644\u0645 \u062a\u064f\u0635\u0631\u064e\u0651\u062d \u0623\u064a \u0631\u062d\u0644\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0633\u0646\u0629.",
    noSchedulesHint:
      "\u0635\u0631\u0651\u062d \u0628\u0647\u0627 \u0641\u064a \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a\u060c \u062b\u0645 \u0627\u062e\u062a\u0631 \u0645\u0627 \u064a\u0642\u0648\u0645 \u0628\u0647 \u0643\u0644 \u0645\u0633\u0627\u0631 \u0645\u0646\u0647\u0627.",
    schedulesSaved: "{count} \u0631\u062d\u0644\u0627\u062a \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631.",
    routeSchedules: "\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f",
    routeSchedulesHint:
      "\u0627\u0644\u0631\u062d\u0644\u0627\u062a \u0627\u0644\u062a\u064a \u064a\u0642\u0648\u0645 \u0628\u0647\u0627 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631.",
    scheduleOnRoute: "\u0627\u0644\u0631\u062d\u0644\u0629",
    noScheduleChosen: "\u062f\u0648\u0646 \u0631\u062d\u0644\u0629 \u0645\u062d\u062f\u062f\u0629",

    // ── \u0627\u0644\u0623\u062d\u064a\u0627\u0621 ───────────────────
    routeNeighbourhoods: "\u0627\u0644\u0623\u062d\u064a\u0627\u0621 \u0627\u0644\u0645\u062e\u062f\u0648\u0645\u0629",
    routeNeighbourhoodsHint:
      "\u0646\u0637\u0627\u0642 \u0627\u0644\u062c\u0645\u0639 \u0627\u0644\u0645\u0639\u0644\u0646 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631\u060c \u0648\u0647\u0648 \u0645\u0627 \u064a\u064f\u0642\u0627\u0631\u0646 \u0628\u062d\u064a \u0627\u0644\u0623\u0633\u0631\u0629 \u0639\u0646\u062f \u0627\u0644\u062a\u0633\u062c\u064a\u0644.",
    neighbourhoodsSaved: "{count} \u0623\u062d\u064a\u0627\u0621 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631.",
    noNeighbourhoods:
      "\u0644\u0645 \u064a\u064f\u0635\u0631\u0651\u062d \u0623\u064a \u062d\u064a \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0624\u0633\u0633\u0629.",
    noNeighbourhoodsHint:
      "\u0623\u0636\u0641\u0647\u0627 \u0641\u064a \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a\u060c \u0627\u0644\u0645\u0624\u0633\u0633\u0629.",

    // ── \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643 ──────────────
    riderNotes: "ملاحظات",
    tabTransport: "\u0627\u0644\u0646\u0642\u0644",
    arrangement: "\u0627\u0634\u062a\u0631\u0627\u0643 \u0627\u0644\u0646\u0642\u0644",
    arrangementHint:
      "\u0627\u062e\u062a\u0631 \u0627\u0644\u062d\u064a \u0623\u0648\u0644\u064b\u0627: \u0644\u0627 \u062a\u064f\u0639\u0631\u0636 \u0625\u0644\u0627 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u062a\u064a \u062a\u062e\u062f\u0645\u0647\u060c \u0648\u062a\u0646\u062a\u062c \u0627\u0644\u0645\u062d\u0637\u0629 \u0639\u0646\u0647\u0645\u0627 \u0645\u0639\u064b\u0627.",
    chooseNeighbourhood: "\u0627\u0644\u062d\u064a",
    chooseRoute: "\u0627\u0644\u0645\u0633\u0627\u0631",
    chooseSchedule: "\u0627\u0644\u0631\u062d\u0644\u0629",
    chooseRuns: "الرحلات",
    chooseRunsHint:
      "أشِر إلى الرحلة التي يركبها التلميذ في كل اتجاه، وكل واحدة تصير اشتراكًا مستقلاً.",
    noSchedulesOnRoute:
      "لم تُعلَن بعد أي رحلة على هذا الخط، لذلك يُطلب الاتجاه مباشرة.",
    chooseStop: "\u0627\u0644\u0645\u062d\u0637\u0629",
    stopAutoResolved:
      "\u0645\u062d\u0637\u0629 \u0648\u0627\u062d\u062f\u0629 \u062a\u062e\u062f\u0645 \u0647\u0630\u0627 \u0627\u0644\u062d\u064a \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631.",
    stopsUnfilteredHint:
      "\u0644\u0645 \u062a\u064f\u0631\u0628\u0637 \u0623\u064a \u0645\u062d\u0637\u0629 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 \u0628\u0647\u0630\u0627 \u0627\u0644\u062d\u064a \u0628\u0639\u062f\u060c \u0644\u0630\u0627 \u062a\u064f\u0639\u0631\u0636 \u0643\u0644 \u0627\u0644\u0645\u062d\u0637\u0627\u062a.",
    noRoutesForNeighbourhood:
      "\u0644\u0627 \u064a\u062e\u062f\u0645 \u0623\u064a \u0645\u0633\u0627\u0631 \u0647\u0630\u0627 \u0627\u0644\u062d\u064a \u0628\u0639\u062f.",
    notSubscribed:
      "\u0647\u0630\u0627 \u0627\u0644\u062a\u0644\u0645\u064a\u0630 \u0644\u0627 \u064a\u0633\u062a\u0639\u0645\u0644 \u0627\u0644\u062d\u0627\u0641\u0644\u0629.",
    notSubscribedHint:
      "\u0627\u062e\u062a\u0631 \u062d\u064a\u064b\u0627 \u0648\u0645\u0633\u0627\u0631\u064b\u0627 \u0644\u062a\u0633\u062c\u064a\u0644\u0647. \u062a\u064f\u0639\u0627\u062f \u0643\u062a\u0627\u0628\u0629 \u0623\u0642\u0633\u0627\u0637 \u0627\u0644\u0646\u0642\u0644 \u062a\u0628\u0639\u064b\u0627 \u0644\u0630\u0644\u0643.",
    subscribe: "\u062a\u0633\u062c\u064a\u0644 \u0641\u064a \u0627\u0644\u0646\u0642\u0644",
    enrolFirst:
      "\u0633\u062c\u0651\u0644 \u0627\u0644\u062a\u0644\u0645\u064a\u0630 \u0644\u0647\u0630\u0647 \u0627\u0644\u0633\u0646\u0629 \u0642\u0628\u0644 \u0625\u0633\u0646\u0627\u062f\u0647 \u0625\u0644\u0649 \u0645\u0633\u0627\u0631.",

    // ── \u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643 ────────
    fuel: "\u0627\u0644\u0648\u0642\u0648\u062f",
    fuelTitle: "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643",
    fuelSubtitle:
      "\u0645\u0627 \u0627\u0633\u062a\u0647\u0644\u0643\u062a\u0647 \u0643\u0644 \u062d\u0627\u0641\u0644\u0629\u060c \u0648\u0645\u0646 \u0637\u0644\u0628\u0647\u060c \u0648\u0645\u0646 \u0635\u0627\u062f\u0642 \u0639\u0644\u064a\u0647.",
    newFuelRequest: "\u0637\u0644\u0628 \u062c\u062f\u064a\u062f",
    editFuelRequest: "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0637\u0644\u0628",
    fuelVehicle: "\u0627\u0644\u062d\u0627\u0641\u0644\u0629",
    fuelDriver: "\u0627\u0644\u0633\u0627\u0626\u0642",
    fuelDriverHint:
      "\u0627\u0644\u0645\u0648\u0638\u0641 \u0639\u0646\u062f \u0627\u0644\u0645\u062d\u0637\u0629. \u0627\u062a\u0631\u0643\u0647 \u0641\u0627\u0631\u063a\u064b\u0627 \u0648\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u064b\u0627 \u0644\u0645\u062a\u0639\u0627\u0642\u062f \u062e\u0627\u0631\u062c\u064a.",
    fuelDriverName: "\u0627\u0633\u0645 \u0627\u0644\u0633\u0627\u0626\u0642",
    fuelDate: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
    fuelLitres: "\u0627\u0644\u0644\u062a\u0631\u0627\u062a",
    fuelOdometer: "\u0639\u062f\u0627\u062f \u0627\u0644\u0645\u0633\u0627\u0641\u0629",
    fuelOdometerHint:
      "\u0627\u0644\u0643\u064a\u0644\u0648\u0645\u062a\u0631\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629. \u0628\u062f\u0648\u0646\u0647\u0627 \u0644\u0627 \u064a\u0645\u0643\u0646 \u062d\u0633\u0627\u0628 \u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643.",
    fuelAmount: "\u0627\u0644\u0645\u0628\u0644\u063a",
    fuelStatus: "\u0627\u0644\u062d\u0627\u0644\u0629",
    fuelCategory: "\u0627\u0644\u0628\u0627\u0628",
    fuelCategoryHint:
      "\u0627\u0644\u0628\u0627\u0628 \u0627\u0644\u0630\u064a \u064a\u064f\u0633\u062c\u0644 \u062a\u062d\u062a\u0647 \u0627\u0644\u0635\u0631\u0641 \u0641\u064a \u0627\u0644\u0635\u0646\u062f\u0648\u0642.",
    fuelDecidedBy: "\u0642\u0631\u0651\u0631\u0647",
    fuelConsumption: "\u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643",
    fuelDistance: "\u0627\u0644\u0645\u0633\u0627\u0641\u0629",
    fuelPerHundred: "{value} \u0644/100\u0643\u0645",
    fuelLitresValue: "{value} \u0644",
    fuelKilometres: "{value} \u0643\u0645",
    noFuelRequests:
      "\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0627\u0633\u062a\u0647\u0644\u0627\u0643.",
    noFuelRequestsHint:
      "\u064a\u0648\u062f\u0639 \u0627\u0644\u0633\u0627\u0626\u0642 \u0637\u0644\u0628\u064b\u0627\u060c \u0648\u064a\u0635\u0627\u062f\u0642 \u0639\u0644\u064a\u0647 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0623\u0633\u0637\u0648\u0644.",
    fuelRequestCreated: "\u0623\u064f\u0648\u062f\u0639 \u0627\u0644\u0637\u0644\u0628.",
    fuelRequestUpdated: "\u0639\u064f\u062f\u0651\u0644 \u0627\u0644\u0637\u0644\u0628.",
    fuelRequestDeleted: "\u0633\u064f\u062d\u0628 \u0627\u0644\u0637\u0644\u0628.",
    fuelApprove: "\u0645\u0635\u0627\u062f\u0642\u0629",
    fuelReject: "\u0631\u0641\u0636",
    fuelApprovedPosted:
      "\u062a\u0645\u062a \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629. \u0627\u0644\u0635\u0631\u0641 \u0645\u0633\u062c\u0651\u0644 \u0641\u064a \u0627\u0644\u0635\u0646\u062f\u0648\u0642.",
    fuelRejected: "\u0631\u064f\u0641\u0636 \u0627\u0644\u0637\u0644\u0628.",
    fuelAlreadyDecided:
      "\u0633\u0628\u0642 \u0627\u0644\u0628\u062a\u0651 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628.",
    fuelNothingToPay:
      "\u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0628\u0644\u0627 \u0645\u0628\u0644\u063a.",
    fuelPending: "{count} \u0641\u064a \u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0642\u0631\u0627\u0631",
    fuelRecent: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u062e\u0644\u0627\u0644 30 \u064a\u0648\u0645\u064b\u0627",
    fuelDeleteTitle: "\u0633\u062d\u0628 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628\u061f",
    fuelDeleteBody:
      "\u0644\u0645 \u064a\u064f\u0628\u062a\u0651 \u0641\u064a\u0647\u060c \u0641\u0644\u0627 \u064a\u062a\u063a\u064a\u0631 \u0634\u064a\u0621 \u0641\u064a \u0627\u0644\u0635\u0646\u062f\u0648\u0642.",

    // ── نداء الحافلة ────────────────────────────────────────────────────────
    attendance: "نداء الحافلة",
    attendanceTitle: "نداء الحافلة",
    attendanceSubtitle:
      "من صعد، وفي أي رحلة. يُسجَّل عند الرصيف من طرف السائق أو المرافق.",
    chooseRun: "الرحلة",
    noRuns: "لا يسير أي مسار هذه السنة.",
    noRunsHint: "ارسم مسارًا أولًا، ثم صرِّح بالرحلات التي يقوم بها.",
    noRidersOnRun: "لا أحد مسجَّل في هذه الرحلة.",
    noRidersHint:
      "يظهر التلاميذ هنا بمجرد إسنادهم إلى هذا المسار عند التسجيل.",
    riderMarked: "تم التسجيل.",
    bulkMarked: "تم تسجيل {count} تلاميذ كصاعدين.",
    nothingToMark: "الجميع مسجَّل في هذه الرحلة.",
    markRest: "الباقون صعدوا",
    unmarked: "غير مسجَّل",
    stopColumn: "المحطة",
    minutesWaited: "دقائق الانتظار",
    reason: "السبب",
    justified: "الأسرة أخبرت",
    notBoardedCount: "{count} لم يصعدوا",
    allBoarded: "صعد الجميع في هذه الرحلة.",
    registerNote:
      "هذا النداء يخص الحافلة وحدها. التلميذ الذي فاتته ليس بالضرورة غائبًا عن المدرسة.",
  },
  transportOptions: {
    riderAttendanceStatuses: {
      PRESENT: "صعد",
      LATE: "متأخر",
      ABSENT: "لم يصعد",
      EXCUSED: "لا يسافر",
    },
    scheduleDirections: {
      MORNING: "\u0635\u0628\u0627\u062d\u064b\u0627",
      AFTERNOON: "\u0628\u0639\u062f \u0627\u0644\u0632\u0648\u0627\u0644",
    },
    fuelStatuses: {
      PENDING: "\u0641\u064a \u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0642\u0631\u0627\u0631",
      APPROVED: "\u0645\u0635\u0627\u062f\u064e\u0642 \u0639\u0644\u064a\u0647\u0627",
      REJECTED: "\u0645\u0631\u0641\u0648\u0636\u0629",
      PAID: "\u0645\u0624\u062f\u0627\u0629",
    },
    vehicleStatuses: {
      ACTIVE: "في الخدمة",
      MAINTENANCE: "في الورشة",
      RETIRED: "محال على التقاعد",
    },
    directions: {
      MORNING: "ذهابًا فقط",
      AFTERNOON: "إيابًا فقط",
      BOTH: "ذهابًا وإيابًا",
    },
    subscriptionStatuses: {
      ACTIVE: "مشترك",
      SUSPENDED: "موقوف",
      CANCELLED: "مفسوخ",
    },
  },
};

export const nav = {
  transportVoyages: "الرحلات",
  transportMyVoyages: "رحلاتي",
  transportSchedules: "\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0646\u0642\u0644",
  transportConsumption: "\u0627\u0644\u0648\u0642\u0648\u062f",
  transportAttendance: "نداء الحافلة",
  transportRoutes: "الخطوط",
  transportFleet: "الأسطول",
};

export const permissions = {
  groups: {
    transport: "النقل",
  },
  codes: {
    "transport.view": "الاطلاع على النقل",
    "transport.manage": "تدبير الحظيرة والخطوط",
    "transport.subscribe": "اشتراك التلاميذ",
    "transport.delete": "حذف المركبات والخطوط",
    "transport.attendance": "تسجيل نداء الحافلة",
    "transport.fuel": "\u0625\u064a\u062f\u0627\u0639 \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0648\u0642\u0648\u062f",
    "transport.fuelApprove": "\u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0648\u0642\u0648\u062f",
  },
};

export default ar;
