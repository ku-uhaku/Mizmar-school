/**
 * Transport translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  transport: {
    title: "Transport",
    subtitle: "The fleet, the lines it runs, and who rides on them.",

    // ── Fleet ───────────────────────────────────────────────────────────────
    fleet: "Fleet",
    vehicles: "Vehicles",
    vehicle: "Vehicle",
    newVehicle: "New vehicle",
    editVehicle: "Edit vehicle",
    registration: "Registration",
    registrationHint: "As written on the plate, e.g. 12345-A-6.",
    make: "Make",
    model: "Model",
    modelYear: "First registered",
    seatCount: "Seats",
    seatCountHint: "Seats available to pupils, which is not always the seats fitted.",
    vehicleStatus: "Status",
    insurance: "Insurance expires",
    inspection: "Roadworthiness expires",
    complianceHint:
      "A bus whose papers have lapsed may not legally carry children.",
    driverStaff: "Driver on the payroll",
    driverStaffHint:
      "Picks one of the school's own employees, so the bus and the payroll name the same person.",
    driverExternal: "Not an employee",
    driverName: "Driver",
    driverPhone: "Driver's phone",
    driverHint: "Whoever is called when a bus has not arrived.",
    noVehicles: "No vehicle in the fleet yet.",
    vehicleCreated: "Vehicle added.",
    vehicleUpdated: "Vehicle updated.",
    vehicleDeleted: "Vehicle removed.",
    registrationTaken: "That registration is already on the fleet.",
    vehicleInUse: "This bus has run a line — retire it instead of deleting it.",
    deleteVehicleTitle: "Remove this vehicle?",
    deleteVehicleBody: "“{name}” will be removed from the fleet.",
    expired: "Expired",
    expiringSoon: "Expires soon",
    paperworkDue: "Papers to renew",
    noExpiryRecorded: "No date recorded",

    riders: "Riders",

    // ── Lines ───────────────────────────────────────────────────────────────
    routes: "Lines",
    route: "Line",
    newRoute: "New line",
    editRoute: "Edit line",
    routeCode: "Code",
    routeName: "Name",
    direction: "Runs",
    assignedVehicle: "Bus",
    capacity: "Seats offered",
    capacityHint: "Leave blank to use the bus's own seat count.",
    seats: "Seats",
    taken: "Taken",
    remaining: "Free",
    routeFull: "This line is full.",
    routeCodeTaken: "That line code is already used this year.",
    routeCreated: "Line created.",
    routeUpdated: "Line updated.",
    routeDeleted: "Line deleted.",
    routeHasRiders: "This line has riders — move them before deleting it.",
    deleteRouteTitle: "Delete this line?",
    deleteRouteBody: "“{name}” will be removed.",
    noRoutes: "No line has been drawn for this year yet.",
    noVehicleAssigned: "No bus assigned",
    unassignedWarning:
      "A line with no bus offers no seats — assign one before subscribing riders.",

    // ── Stops ───────────────────────────────────────────────────────────────
    stops: "Stops",
    stop: "Stop",
    newStop: "New stop",
    editStop: "Edit stop",
    stopName: "Stop",
    landmark: "Landmark",
    neighbourhood: "District",
    landmarkHint: "What to look for: “outside the pharmacy”.",
    position: "Order",
    pickupTime: "Pick-up",
    dropoffTime: "Drop-off",
    invalidTime: "Use a 24-hour time, e.g. 07:30.",
    stopSaved: "Stop saved.",
    stopDeleted: "Stop removed.",
    stopNameTaken: "That stop already exists on this line.",
    stopHasRiders: "Pupils board here — move them before removing the stop.",
    noStops: "No stop on this line yet.",

    // ── Riders ──────────────────────────────────────────────────────────────
    addRider: "Add a rider",
    editRider: "Edit rider",
    rider: "Rider",
    noRiders: "Nobody rides this line yet.",
    pupil: "Pupil",
    subscriptionStatus: "Status",
    startsOn: "From",
    endsOn: "Until",
    riderAdded: "Rider added.",
    riderAddedBilled: "Rider added — {count} instalments priced.",
    riderUpdated: "Rider updated.",
    riderRemoved: "Rider removed.",
    riderRemovedBilled:
      "Rider removed — {count} future instalments cancelled.",
    alreadySubscribed: "This pupil already rides in that direction.",
    removeRiderTitle: "Take this pupil off the bus?",
    removeRiderBody:
      "“{name}” loses their seat. Instalments already paid are kept; future unpaid ones are cancelled.",
    noSubscribable: "Every enrolled pupil already has a seat.",
    notRiding: "This pupil does not take the bus.",
    transportOf: "Transport",
    billingNote:
      "The bus is billed once, at enrolment, from the price list. Putting a pupil on a circuit does not change what their family owes.",

    // ── Summary ─────────────────────────────────────────────────────────────
    seatsOffered: "Seats offered",
    seatsFree: "Seats free",
    ridersTotal: "Riders",
    linesRunning: "Lines running",

    // ── Section dashboard ───────────────────────────────────────────────────
    routesHint: "The lines drawn for the year, their stops, and who boards where.",
    fleetHint: "The buses, the papers that keep them legal, and the driver on each.",
    paperworkCount: "{count} to renew",
    paperworkHint:
      "Insurance or roadworthiness lapsed, or expiring within the month.",
    allPapersValid: "Every bus in service has valid papers.",
    stopsAcrossLines: "{count} stops",
    ofSeatsOffered: "of {count} seats offered",
    seatsFreeHint: "Across every line running",
    busesInService: "{count} buses in service",
    occupancy: "How full the lines run",
    occupancyHint: "Riders against the seats each line offers.",
    seatsTaken: "{taken} of {seats} seats",

    // ── Runs ────────────────────────────────────────────────────────────────
    schedules: "Timetables",
    schedule: "Run",
    noSchedules: "No run declared for this year yet.",
    noSchedulesHint:
      "Declare them under Configuration, then tick the ones each line makes.",
    schedulesSaved: "{count} runs on this line.",
    routeSchedules: "Runs",
    routeSchedulesHint: "Which departures this line makes.",
    scheduleOnRoute: "Run",
    noScheduleChosen: "No particular run",

    // ── Districts served ────────────────────────────────────────────────────
    routeNeighbourhoods: "Districts served",
    routeNeighbourhoodsHint:
      "The catchment this line is offered for. It is what a family's district is matched against at enrolment, and it does not have to wait for the stops to be drawn.",
    neighbourhoodsSaved: "{count} districts on this line.",
    noNeighbourhoods: "No district declared for this school yet.",
    noNeighbourhoodsHint: "Add them under Configuration, Establishment.",

    // ── The pupil's arrangement ─────────────────────────────────────────────
    riderNotes: "Notes",
    tabTransport: "Transport",
    arrangement: "Bus arrangement",
    arrangementHint:
      "Pick the district first: only the lines serving it are offered, and the stop follows from the two.",
    chooseNeighbourhood: "District",
    chooseRoute: "Line",
    chooseSchedule: "Run",
    chooseStop: "Stop",
    stopAutoResolved: "One stop serves this district on this line.",
    stopsUnfilteredHint:
      "No stop on this line is tagged with this district yet, so every stop is offered.",
    noRoutesForNeighbourhood: "No line serves this district yet.",
    notSubscribed: "This pupil does not take the bus.",
    notSubscribedHint:
      "Choose a district and a line to put them on one. The transport instalments are rewritten to match.",
    subscribe: "Put on the bus",
    enrolFirst: "Enrol the pupil for this year before putting them on a line.",

    // ── Fuel ────────────────────────────────────────────────────────────────
    fuel: "Fuel",
    fuelTitle: "Fuel requests",
    fuelSubtitle:
      "What each bus has been fuelled with, who asked, and who agreed to it.",
    newFuelRequest: "New request",
    editFuelRequest: "Edit request",
    fuelVehicle: "Bus",
    fuelDriver: "Driver",
    fuelDriverHint:
      "The employee at the pump. Leave it and type a name for a contractor.",
    fuelDriverName: "Driver's name",
    fuelDate: "Date",
    fuelLitres: "Litres",
    fuelOdometer: "Odometer",
    fuelOdometerHint:
      "Kilometres on the clock. Without it the consumption cannot be worked out.",
    fuelAmount: "Amount",
    fuelStatus: "Status",
    fuelCategory: "Expense heading",
    fuelCategoryHint: "The heading the payment is posted under in the cash desk.",
    fuelDecidedBy: "Decided by",
    fuelConsumption: "Consumption",
    fuelDistance: "Distance",
    fuelPerHundred: "{value} L/100km",
    fuelLitresValue: "{value} L",
    fuelKilometres: "{value} km",
    noFuelRequests: "No fuel request yet.",
    noFuelRequestsHint: "A driver raises one; whoever runs the fleet agrees it.",
    fuelRequestCreated: "Request raised.",
    fuelRequestUpdated: "Request updated.",
    fuelRequestDeleted: "Request withdrawn.",
    fuelApprove: "Approve",
    fuelReject: "Refuse",
    fuelApprovedPosted: "Approved. The payment is in the cash desk.",
    fuelRejected: "Request refused.",
    fuelAlreadyDecided: "That request has already been decided.",
    fuelNothingToPay: "A request for nothing cannot be approved.",
    fuelPending: "{count} awaiting a decision",
    fuelRecent: "Spent in the last 30 days",
    fuelDeleteTitle: "Withdraw this request?",
    fuelDeleteBody: "It has not been decided, so nothing in the ledger changes.",

    // ── L'appel du bus ──────────────────────────────────────────────────────
    attendance: "Bus register",
    attendanceTitle: "Bus register",
    attendanceSubtitle:
      "Who boarded, on which run. Marked at the kerb by the driver or the accompagnateur.",
    chooseRun: "Run",
    noRuns: "No line runs this year yet.",
    noRunsHint: "Draw a line first, then declare the runs it makes.",
    noRidersOnRun: "Nobody is booked on this run.",
    noRidersHint:
      "Riders appear here once they are put on this line at enrolment.",
    riderMarked: "Marked.",
    bulkMarked: "{count} riders marked as boarded.",
    nothingToMark: "Everybody on this run has already been marked.",
    markRest: "Everyone else boarded",
    unmarked: "Not marked",
    stopColumn: "Stop",
    minutesWaited: "Minutes waited",
    reason: "Reason",
    justified: "Family warned us",
    notBoardedCount: "{count} not on the bus",
    allBoarded: "Everybody on this run boarded.",
    registerNote:
      "This register is the bus only. A pupil who missed it is not thereby absent from school.",
  },
  transportOptions: {
    riderAttendanceStatuses: {
      PRESENT: "Boarded",
      LATE: "Late",
      ABSENT: "Did not board",
      EXCUSED: "Not travelling",
    },
    scheduleDirections: {
      MORNING: "Morning",
      AFTERNOON: "Afternoon",
    },
    fuelStatuses: {
      PENDING: "Awaiting a decision",
      APPROVED: "Approved",
      REJECTED: "Refused",
      PAID: "Paid",
    },
    vehicleStatuses: {
      ACTIVE: "In service",
      MAINTENANCE: "In the garage",
      RETIRED: "Retired",
    },
    directions: {
      MORNING: "Morning only",
      AFTERNOON: "Afternoon only",
      BOTH: "Both ways",
    },
    subscriptionStatuses: {
      ACTIVE: "Riding",
      SUSPENDED: "Suspended",
      CANCELLED: "Cancelled",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  transportSchedules: "Timetables",
  transportConsumption: "Fuel",
  transportAttendance: "Bus register",
  transportRoutes: "Routes",
  transportFleet: "Fleet",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    transport: "Transport",
  },
  codes: {
    "transport.view": "View transport",
    "transport.manage": "Manage the fleet and lines",
    "transport.subscribe": "Put pupils on a line",
    "transport.delete": "Delete vehicles and lines",
    "transport.attendance": "Mark the bus register",
    "transport.fuel": "Raise fuel requests",
    "transport.fuelApprove": "Approve fuel requests",
  },
} as const;

export default en;
