import { log, type SeedDb } from "@/prisma/seed/client";

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
};

export const VEHICLE_SEEDS: VehicleSeed[] = [
  { registration: "45231-A-6", make: "Mercedes-Benz", model: "Sprinter", modelYear: 2019, seatCount: 22, driverName: "Hassan Alaoui", driverPhone: "0661234501" },
  { registration: "78412-B-6", make: "Toyota", model: "Coaster", modelYear: 2021, seatCount: 30, driverName: "Brahim Naji", driverPhone: "0661234502" },
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
];

export async function seedTransport(
  db: SeedDb,
  input: {
    schoolId: string;
    schoolYearId: string;
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

  for (const route of ROUTE_SEEDS) {
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
    `${VEHICLE_SEEDS.length} vehicles, ${SCHEDULE_SEEDS.length} runs, ${ROUTE_SEEDS.length} lines, ${stopCount} stops`,
  );
}
