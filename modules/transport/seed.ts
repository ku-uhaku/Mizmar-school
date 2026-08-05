import { log, type SeedDb } from "@/prisma/seed/client";
import { subscriptionScopeKey } from "@/modules/transport/enums";

/**
 * The fleet, the runs and the lines — the arrangement, not the passengers.
 *
 * No subscriptions are seeded on purpose. Putting a child on a bus reprices
 * their échéancier (see `applyTransportPricing`), so a seeded rider would write
 * amounts onto fee schedules that nobody agreed to, and re-running the seed
 * would do it again. Pupils are subscribed through the screen, which is also the
 * shortest way to see the pricing work.
 *
 * No fuel requests either, and for a related reason: approving one posts a
 * décaissement into the caisse, so a seeded request would either sit pending
 * forever or invent a movement in the ledger.
 *
 * Idempotent — vehicles upsert on `(schoolId, registration)`, runs and lines on
 * their year-scoped codes, stops on `(routeId, name)`, and the two join tables
 * on their pairings.
 */

export type VehicleSeed = {
  registration: string;
  make: string;
  model: string;
  modelYear: number;
  seatCount: number;
  driverName: string;
  driverPhone: string;
  /// L'accompagnateur, as free text — the contractor case, which is what most
  /// schools' accompagnateurs are. The big bus goes without one on purpose, so
  /// the demonstration shows both arrangements.
  attendantName?: string;
  attendantPhone?: string;
};

export const VEHICLE_SEEDS: VehicleSeed[] = [
  { registration: "45231-A-6", make: "Mercedes-Benz", model: "Sprinter", modelYear: 2019, seatCount: 22, driverName: "Hassan Alaoui", driverPhone: "0661234501", attendantName: "Khadija Bennani", attendantPhone: "0661234511" },
  { registration: "78412-B-6", make: "Toyota", model: "Coaster", modelYear: 2021, seatCount: 30, driverName: "Brahim Naji", driverPhone: "0661234502", attendantName: "Fatima Zahra Idrissi", attendantPhone: "0661234512" },
  { registration: "10298-C-6", make: "Renault", model: "Master", modelYear: 2017, seatCount: 16, driverName: "Said Amrani", driverPhone: "0661234503" },
];

export type ScheduleSeed = {
  code: string;
  name: string;
  nameAr: string;
  direction: "MORNING" | "AFTERNOON";
  departureTime: string;
  arrivalTime: string;
  position: number;
};

export const SCHEDULE_SEEDS: ScheduleSeed[] = [
  { code: "M1", name: "Ramassage du matin", nameAr: "جولة الصباح", direction: "MORNING", departureTime: "06:45", arrivalTime: "08:00", position: 1 },
  { code: "S1", name: "Retour de midi", nameAr: "عودة الظهيرة", direction: "AFTERNOON", departureTime: "12:30", arrivalTime: "13:30", position: 2 },
  { code: "S2", name: "Retour du soir", nameAr: "عودة المساء", direction: "AFTERNOON", departureTime: "17:00", arrivalTime: "18:15", position: 3 },
];

export type RouteSeed = {
  /**
   * The town the line runs in, by `City.code`.
   *
   * Every school seeds every quartier, so without this a Rabat school would be
   * given Casablanca lines and its pupils would ride a bus that collects in
   * Maârif. See `seedTransport`.
   */
  cityCode: string;
  code: string;
  name: string;
  nameAr: string;
  direction: "MORNING" | "AFTERNOON" | "BOTH";
  /** Index into VEHICLE_SEEDS, or null while unassigned. */
  vehicleIndex: number | null;
  /** Quartiers this line is advertised to serve — codes from modules/geography. */
  neighbourhoodCodes: string[];
  /** Runs it makes — codes from SCHEDULE_SEEDS above. */
  scheduleCodes: string[];
  stops: {
    name: string;
    /** The quartier the stop physically stands in — see RouteStop. */
    neighbourhoodCode: string;
    nameAr: string;
    landmark: string;
    pickupTime: string;
    dropoffTime: string;
  }[];
};

export const ROUTE_SEEDS: RouteSeed[] = [
  {
    code: "L1",
    cityCode: "CASA",
    name: "Ligne 1 — Maârif",
    nameAr: "الخط 1 — المعاريف",
    direction: "BOTH",
    vehicleIndex: 0,
    neighbourhoodCodes: ["MAARIF", "BOURGOGNE"],
    scheduleCodes: ["M1", "S2"],
    stops: [
      { name: "Place Zerktouni", neighbourhoodCode: "MAARIF", nameAr: "ساحة الزرقطوني", landmark: "devant la pharmacie", pickupTime: "07:15", dropoffTime: "17:15" },
      { name: "Boulevard Ghandi", neighbourhoodCode: "MAARIF", nameAr: "شارع غاندي", landmark: "arrêt de bus", pickupTime: "07:25", dropoffTime: "17:05" },
      { name: "Rond-point Bourgogne", neighbourhoodCode: "BOURGOGNE", nameAr: "دوار بورغوني", landmark: "près du café", pickupTime: "07:35", dropoffTime: "16:55" },
    ],
  },
  {
    code: "L2",
    cityCode: "CASA",
    name: "Ligne 2 — Ain Diab",
    nameAr: "الخط 2 — عين الذئاب",
    direction: "BOTH",
    vehicleIndex: 1,
    neighbourhoodCodes: ["AIN-DIAB", "ANFA"],
    scheduleCodes: ["M1", "S1", "S2"],
    stops: [
      { name: "Corniche", neighbourhoodCode: "AIN-DIAB", nameAr: "الكورنيش", landmark: "face à l'hôtel", pickupTime: "07:00", dropoffTime: "17:30" },
      { name: "Anfa Place", neighbourhoodCode: "ANFA", nameAr: "أنفا بلاس", landmark: "entrée principale", pickupTime: "07:12", dropoffTime: "17:18" },
      { name: "Californie", neighbourhoodCode: "ANFA", nameAr: "كاليفورنيا", landmark: "rond-point", pickupTime: "07:28", dropoffTime: "17:02" },
    ],
  },
  {
    code: "L3",
    cityCode: "CASA",
    name: "Ligne 3 — Sidi Maârouf",
    nameAr: "الخط 3 — سيدي معروف",
    direction: "MORNING",
    vehicleIndex: 2,
    neighbourhoodCodes: ["SIDI-MAAROUF"],
    scheduleCodes: ["M1"],
    stops: [
      { name: "Sidi Maârouf centre", neighbourhoodCode: "SIDI-MAAROUF", nameAr: "سيدي معروف المركز", landmark: "devant la mosquée", pickupTime: "06:50", dropoffTime: "" },
      { name: "Technopark", neighbourhoodCode: "SIDI-MAAROUF", nameAr: "تكنوبارك", landmark: "parking visiteurs", pickupTime: "07:05", dropoffTime: "" },
    ],
  },
  {
    code: "R1",
    cityCode: "RABAT",
    name: "Ligne 1 — Agdal",
    nameAr: "الخط 1 — أكدال",
    direction: "BOTH",
    vehicleIndex: 0,
    neighbourhoodCodes: ["AGDAL"],
    scheduleCodes: ["M1", "S2"],
    stops: [
      { name: "Avenue de France", neighbourhoodCode: "AGDAL", nameAr: "شارع فرنسا", landmark: "devant la poste", pickupTime: "07:10", dropoffTime: "17:20" },
      { name: "Gare Agdal", neighbourhoodCode: "AGDAL", nameAr: "محطة أكدال", landmark: "sortie voyageurs", pickupTime: "07:22", dropoffTime: "17:08" },
    ],
  },
  {
    code: "R2",
    cityCode: "RABAT",
    name: "Ligne 2 — Souissi",
    nameAr: "الخط 2 — السويسي",
    direction: "BOTH",
    vehicleIndex: 1,
    neighbourhoodCodes: ["SOUISSI"],
    scheduleCodes: ["M1", "S1"],
    stops: [
      { name: "Souissi centre", neighbourhoodCode: "SOUISSI", nameAr: "السويسي المركز", landmark: "près de l'ambassade", pickupTime: "06:55", dropoffTime: "17:35" },
      { name: "Zaers", neighbourhoodCode: "SOUISSI", nameAr: "الزعير", landmark: "rond-point", pickupTime: "07:08", dropoffTime: "17:22" },
    ],
  },
  {
    code: "R3",
    cityCode: "RABAT",
    name: "Ligne 3 — Hassan",
    nameAr: "الخط 3 — حسان",
    direction: "MORNING",
    vehicleIndex: 2,
    neighbourhoodCodes: ["HASSAN"],
    scheduleCodes: ["M1"],
    stops: [
      { name: "Tour Hassan", neighbourhoodCode: "HASSAN", nameAr: "صومعة حسان", landmark: "esplanade", pickupTime: "06:50", dropoffTime: "" },
      { name: "Bab Chellah", neighbourhoodCode: "HASSAN", nameAr: "باب شالة", landmark: "arrêt de tram", pickupTime: "07:04", dropoffTime: "" },
    ],
  },
  {
    code: "O1",
    cityCode: "OUJDA",
    name: "Ligne 1 — Sidi Yahya",
    nameAr: "الخط 1 — سيدي يحيى",
    direction: "BOTH",
    vehicleIndex: 0,
    neighbourhoodCodes: ["SIDI-YAHYA", "AL-QODS"],
    scheduleCodes: ["M1", "S2"],
    stops: [
      { name: "Place Sidi Yahya", neighbourhoodCode: "SIDI-YAHYA", nameAr: "ساحة سيدي يحيى", landmark: "devant la mosquée", pickupTime: "07:05", dropoffTime: "17:25" },
      { name: "Avenue Al Qods", neighbourhoodCode: "AL-QODS", nameAr: "شارع القدس", landmark: "près du marché", pickupTime: "07:20", dropoffTime: "17:10" },
    ],
  },
  {
    code: "O2",
    cityCode: "OUJDA",
    name: "Ligne 2 — Lazaret",
    nameAr: "الخط 2 — لازاريت",
    direction: "BOTH",
    vehicleIndex: 1,
    neighbourhoodCodes: ["LAZARET", "HAY-SALAM"],
    scheduleCodes: ["M1", "S1"],
    stops: [
      { name: "Lazaret centre", neighbourhoodCode: "LAZARET", nameAr: "لازاريت المركز", landmark: "arrêt de bus", pickupTime: "06:55", dropoffTime: "17:30" },
      { name: "Hay Salam", neighbourhoodCode: "HAY-SALAM", nameAr: "حي السلام", landmark: "devant l'école primaire", pickupTime: "07:10", dropoffTime: "17:15" },
    ],
  },
  {
    code: "O3",
    cityCode: "OUJDA",
    name: "Ligne 3 — Al Massira",
    nameAr: "الخط 3 — المسيرة",
    direction: "MORNING",
    vehicleIndex: 2,
    neighbourhoodCodes: ["AL-MASSIRA"],
    scheduleCodes: ["M1"],
    stops: [
      { name: "Al Massira centre", neighbourhoodCode: "AL-MASSIRA", nameAr: "المسيرة المركز", landmark: "rond-point", pickupTime: "06:50", dropoffTime: "" },
    ],
  },
];

export async function seedTransport(
  db: SeedDb,
  input: {
    schoolId: string;
    schoolYearId: string;
    /** The town the school is in — picks which lines it runs. */
    cityCode: string;
    /**
     * The school's own drivers, by name, from `seedHr`. Empty is fine — the bus
     * keeps the typed name, which is the contractor case the column is for.
     */
    driverIdByName?: Record<string, string>;
  },
): Promise<void> {
  // The quartiers were seeded by `seedGeography`; looked up by code rather than
  // passed in, so adding a line to a quartier needs no change at the call site.
  const neighbourhoods = await db.neighbourhood.findMany({
    where: { schoolId: input.schoolId },
    select: { id: true, code: true },
  });
  const neighbourhoodIdByCode = Object.fromEntries(
    neighbourhoods.map((row) => [row.code, row.id]),
  ) as Record<string, string | undefined>;

  const vehicleIds: string[] = [];

  for (const vehicle of VEHICLE_SEEDS) {
    const driverId = input.driverIdByName?.[vehicle.driverName] ?? null;

    const row = await db.vehicle.upsert({
      where: {
        schoolId_registration: {
          schoolId: input.schoolId,
          registration: vehicle.registration,
        },
      },
      update: {
        make: vehicle.make,
        model: vehicle.model,
        modelYear: vehicle.modelYear,
        seatCount: vehicle.seatCount,
        driverId,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        attendantName: vehicle.attendantName ?? null,
        attendantPhone: vehicle.attendantPhone ?? null,
      },
      create: {
        schoolId: input.schoolId,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        modelYear: vehicle.modelYear,
        seatCount: vehicle.seatCount,
        status: "ACTIVE",
        driverId,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        attendantName: vehicle.attendantName ?? null,
        attendantPhone: vehicle.attendantPhone ?? null,
      },
      select: { id: true },
    });
    vehicleIds.push(row.id);
  }

  const scheduleIdByCode: Record<string, string> = {};
  for (const schedule of SCHEDULE_SEEDS) {
    const row = await db.transportSchedule.upsert({
      where: {
        schoolYearId_code: {
          schoolYearId: input.schoolYearId,
          code: schedule.code,
        },
      },
      update: {
        name: schedule.name,
        nameAr: schedule.nameAr,
        direction: schedule.direction,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        position: schedule.position,
      },
      create: {
        schoolYearId: input.schoolYearId,
        code: schedule.code,
        name: schedule.name,
        nameAr: schedule.nameAr,
        direction: schedule.direction,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        position: schedule.position,
      },
      select: { id: true },
    });
    scheduleIdByCode[schedule.code] = row.id;
  }

  let stopCount = 0;

  const routeSeeds = ROUTE_SEEDS.filter(
    (route) => route.cityCode === input.cityCode,
  );

  for (const route of routeSeeds) {
    const vehicleId =
      route.vehicleIndex === null ? null : (vehicleIds[route.vehicleIndex] ?? null);

    const row = await db.transportRoute.upsert({
      where: {
        schoolYearId_code: {
          schoolYearId: input.schoolYearId,
          code: route.code,
        },
      },
      update: {
        name: route.name,
        nameAr: route.nameAr,
        direction: route.direction,
        vehicleId,
      },
      create: {
        schoolYearId: input.schoolYearId,
        code: route.code,
        name: route.name,
        nameAr: route.nameAr,
        direction: route.direction,
        vehicleId,
      },
      select: { id: true },
    });

    // Both are plain join rows with nothing of their own to update, so an
    // upsert with an empty `update` is exactly "make sure this pairing exists".
    for (const code of route.neighbourhoodCodes) {
      const neighbourhoodId = neighbourhoodIdByCode[code];
      if (!neighbourhoodId) continue;
      await db.routeNeighbourhood.upsert({
        where: {
          routeId_neighbourhoodId: { routeId: row.id, neighbourhoodId },
        },
        update: {},
        create: { routeId: row.id, neighbourhoodId },
      });
    }

    for (const code of route.scheduleCodes) {
      const scheduleId = scheduleIdByCode[code];
      if (!scheduleId) continue;
      await db.routeSchedule.upsert({
        where: { routeId_scheduleId: { routeId: row.id, scheduleId } },
        update: {},
        create: { routeId: row.id, scheduleId },
      });
    }

    for (const [index, stop] of route.stops.entries()) {
      await db.routeStop.upsert({
        where: { routeId_name: { routeId: row.id, name: stop.name } },
        update: {
          nameAr: stop.nameAr,
          landmark: stop.landmark,
          neighbourhoodId: neighbourhoodIdByCode[stop.neighbourhoodCode] ?? null,
          position: index,
          pickupTime: stop.pickupTime || null,
          dropoffTime: stop.dropoffTime || null,
        },
        create: {
          routeId: row.id,
          name: stop.name,
          nameAr: stop.nameAr,
          landmark: stop.landmark,
          neighbourhoodId: neighbourhoodIdByCode[stop.neighbourhoodCode] ?? null,
          position: index,
          pickupTime: stop.pickupTime || null,
          dropoffTime: stop.dropoffTime || null,
        },
      });
      stopCount += 1;
    }
  }

  log(
    "transport",
    `${VEHICLE_SEEDS.length} vehicles, ${SCHEDULE_SEEDS.length} runs, ${routeSeeds.length} lines, ${stopCount} stops`,
  );
}


// ── Who actually rides, and what it costs to run ─────────────────────────────

/**
 * Abonnements against the lines, and the fuel log behind the buses.
 *
 * Separate from `seedTransport` and run much later, because both need things
 * that do not exist when the lines are drawn: an abonnement hangs off an
 * enrolment, and there is no enrolment until the pupil is inscribed.
 *
 * ── The route is chosen by quartier, not at random ──────────────────────────
 * `RouteNeighbourhood` exists precisely so a line can be drawn against the
 * quartiers it collects, and a seed that ignored it would produce a ramassage
 * where the bus crosses Casablanca for one child. A pupil whose quartier no
 * line covers simply has no abonnement — which is the honest answer, and the
 * one the school gives that family too.
 *
 * Idempotent: upserted on `(enrollmentId, scopeKey)` for the abonnements and
 * on the vehicle-and-date pair for the pleins, so re-running changes nothing.
 */
export async function seedTransportRidership(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
  }: { schoolId: string; schoolYearId: string },
): Promise<void> {
  const routes = await db.transportRoute.findMany({
    where: { schoolYearId, isActive: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      direction: true,
      capacity: true,
      vehicle: { select: { seatCount: true } },
      neighbourhoods: { select: { neighbourhoodId: true } },
      stops: {
        orderBy: { position: "asc" },
        select: { id: true, neighbourhoodId: true },
      },
      schedules: { select: { scheduleId: true } },
    },
  });
  if (routes.length === 0) return;

  const riders = await db.enrollment.findMany({
    where: {
      schoolYearId,
      usesTransport: true,
      status: { in: ["ACTIVE", "PENDING"] },
      student: { schoolId },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      student: { select: { neighbourhoodId: true } },
    },
  });

  /*
    A seat is a seat. Capped at whatever the line declares, or at the bus's own
    seat count when it declares nothing — a ramassage list longer than the
    vehicle is a list somebody stands up on.
  */
  const seatsLeft = new Map(
    routes.map((route) => [
      route.id,
      route.capacity ?? route.vehicle?.seatCount ?? 0,
    ]),
  );

  let subscribed = 0;

  for (const rider of riders) {
    const quartier = rider.student.neighbourhoodId;
    if (!quartier) continue;

    const route = routes.find(
      (candidate) =>
        candidate.neighbourhoods.some(
          (link) => link.neighbourhoodId === quartier,
        ) && (seatsLeft.get(candidate.id) ?? 0) > 0,
    );
    if (!route || route.stops.length === 0) continue;

    // The stop in their own quartier, or the line's first — which is what a
    // secretary does when the address is on the way but not at a stop.
    const stop =
      route.stops.find((candidate) => candidate.neighbourhoodId === quartier) ??
      route.stops[0];

    const scheduleId = route.schedules[0]?.scheduleId ?? null;
    const scopeKey = subscriptionScopeKey(route.direction, scheduleId);

    await db.transportSubscription.upsert({
      where: {
        enrollmentId_scopeKey: {
          enrollmentId: rider.id,
          scopeKey,
        },
      },
      update: { routeId: route.id, stopId: stop.id },
      create: {
        enrollmentId: rider.id,
        routeId: route.id,
        stopId: stop.id,
        direction: route.direction,
        scheduleId,
        scopeKey,
        status: "ACTIVE",
      },
    });

    seatsLeft.set(route.id, (seatsLeft.get(route.id) ?? 1) - 1);
    subscribed += 1;
  }

  /*
    The fuel log: one plein a fortnight per bus across the school year.

    The odometer advances, which is the whole point — consumption is the gap
    between two readings, so a log of fills with a frozen meter reports nothing.
    Litres are jittered off the distance so the L/100km column varies the way a
    real fleet's does rather than reading the same figure down the page.
  */
  const vehicles = await db.vehicle.findMany({
    where: { schoolId, status: "ACTIVE" },
    orderBy: { registration: "asc" },
    select: { id: true, registration: true, driverId: true, driverName: true },
  });

  const year = await db.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { startDate: true, endDate: true },
  });
  if (!year) return;

  let pleins = 0;

  for (const [index, vehicle] of vehicles.entries()) {
    let odometer = 40_000 + index * 17_500;
    const date = new Date(year.startDate);

    while (date <= year.endDate && date <= new Date()) {
      // A fortnight of ramassage: two runs a day, five days a week.
      const distance = 620 + ((index * 7 + date.getMonth()) % 5) * 40;
      odometer += distance;
      /*
        Around 22 L/100 km for a minibus, wandering a little either side.

        Read the units carefully: the rate is in *tenths* of a litre per 100 km
        (220 = 22,0 L), so the divisor is 100 and not 1000. Getting it wrong
        produced a fleet averaging 2,5 L/100 km — which the report rendered
        perfectly, and which is the point of checking the figures and not only
        the columns.
      */
      const litresTenths = Math.round(
        (distance * (220 + ((index + date.getMonth()) % 9) * 6)) / 100,
      );

      const occurredOn = new Date(date);
      const data = {
        schoolId,
        vehicleId: vehicle.id,
        requestedById: vehicle.driverId,
        requestedByName: vehicle.driverName,
        occurredOn,
        litresTenths,
        odometerKm: odometer,
        // Around 15 MAD the litre, in centimes.
        amountCentimes: Math.round((litresTenths / 10) * 1_500),
        // The last fortnight is still awaiting a decision; everything older has
        // been paid, which is what a settled log looks like.
        status:
          occurredOn > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
            ? "PENDING"
            : "PAID",
      };

      /*
        Written rather than only created-if-absent. `FuelRequest` has no unique
        constraint to upsert on — a bus may legitimately be filled twice in a
        day — so the vehicle-and-date pair stands in for one here, and the row
        is brought back to what the formula says. Same inputs, same values, so
        re-running still changes nothing; but a figure this seed once got wrong
        gets corrected instead of surviving forever.
      */
      const existing = await db.fuelRequest.findFirst({
        where: { vehicleId: vehicle.id, occurredOn },
        select: { id: true },
      });

      if (existing) {
        await db.fuelRequest.update({ where: { id: existing.id }, data });
      } else {
        await db.fuelRequest.create({ data });
        pleins += 1;
      }

      date.setDate(date.getDate() + 14);
    }
  }

  log("ramassage", `${subscribed} abonnements, ${pleins} pleins`);
}
