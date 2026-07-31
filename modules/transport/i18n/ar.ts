/**
 * Transport translations (ar). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const ar = {
  transport: {
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

    // ── Zones ───────────────────────────────────────────────────────────────
    zones: "مناطق التسعير",
    zone: "المنطقة",
    newZone: "منطقة جديدة",
    editZone: "تعديل المنطقة",
    zonesHint:
      "يُسعَّر النقل حسب المسافة: منطقة المحطة هي التي تحدد ما يؤديه المشتركون فيها.",
    zonePrice: "التعريفة السنوية",
    zoneCodeTaken: "رمز المنطقة مستعمل بالفعل هذه السنة.",
    zoneSaved: "تم حفظ المنطقة.",
    zoneRepriced: "تم حفظ المنطقة — أُعيد تسعير {count} تلميذًا.",
    noZones: "لم تُعلَن أي منطقة. لا يمكن تسعير الاشتراكات بدونها.",
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
    noZoneOnStop: "بدون منطقة — لا يمكن تسعير المشتركين من هنا.",

    // ── Riders ──────────────────────────────────────────────────────────────
    addRider: "اشتراك تلميذ",
    editRider: "تعديل الاشتراك",
    rider: "المشترك",
    noRiders: "لا يوجد أي تلميذ في هذا الخط.",
    pupil: "التلميذ",
    subscriptionStatus: "الحالة",
    startsOn: "ابتداءً من",
    endsOn: "إلى غاية",
    pricePerYear: "التعريفة السنوية",
    riderAdded: "تم اشتراك التلميذ.",
    riderAddedBilled: "تم اشتراك التلميذ — سُعِّرت {count} أقساط.",
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
      "الاشتراك يكتب تعريفة المنطقة على أقساط نقل التلميذ. أما ما هو مستحق فيبقى في جدول الرسوم.",

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
  },
  transportOptions: {
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
  transportRoutes: "الخطوط",
  transportFleet: "الأسطول",
  transportZones: "المناطق",
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
  },
};

export default ar;
