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

    // ── Zones ───────────────────────────────────────────────────────────────
    zones: "Pricing zones",
    zone: "Zone",
    newZone: "New zone",
    editZone: "Edit zone",
    zonesHint:
      "The bus is priced by how far the child lives, so a stop's zone decides what its riders pay.",
    zonePrice: "Price for the year",
    zoneCodeTaken: "That zone code is already used this year.",
    zoneSaved: "Zone saved.",
    zoneRepriced: "Zone saved — {count} pupils repriced.",
    noZones: "No zone declared. Riders cannot be priced until there is one.",
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
    noZoneOnStop: "No zone — riders here cannot be priced.",

    // ── Riders ──────────────────────────────────────────────────────────────
    addRider: "Add a rider",
    editRider: "Edit rider",
    rider: "Rider",
    noRiders: "Nobody rides this line yet.",
    pupil: "Pupil",
    subscriptionStatus: "Status",
    startsOn: "From",
    endsOn: "Until",
    pricePerYear: "Price for the year",
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
      "Subscribing writes the zone's price onto the pupil's transport instalments. What is owed stays on the échéancier.",

    // ── Summary ─────────────────────────────────────────────────────────────
    seatsOffered: "Seats offered",
    seatsFree: "Seats free",
    ridersTotal: "Riders",
    linesRunning: "Lines running",
  },
  transportOptions: {
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
  transport: "Transport",
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
  },
} as const;

export default en;
