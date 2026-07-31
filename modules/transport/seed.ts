import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The fleet, the zones and the lines — the arrangement, not the passengers.
 *
 * No subscriptions are seeded on purpose. Putting a child on a bus reprices
 * their échéancier (see `applyTransportPricing`), so a seeded rider would write
 * amounts onto fee schedules that nobody agreed to, and re-running the seed
 * would do it again. Pupils are subscribed through the screen, which is also the
 * shortest way to see the pricing work.
 *
 * Idempotent — vehicles upsert on `(schoolId, registration)`, zones and lines on
 * their year-scoped codes, stops on `(routeId, name)`.
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

export type ZoneSeed = {
  code: string;
  name: string;
  nameAr: string;
  /** Annual price in dirhams; converted to centimes on the way in. */
  amount: number;
  position: number;
};

export const ZONE_SEEDS: ZoneSeed[] = [
  { code: "Z1", name: "Zone 1 — centre", nameAr: "المنطقة 1 — الوسط", amount: 2400, position: 1 },
  { code: "Z2", name: "Zone 2 — périphérie", nameAr: "المنطقة 2 — الضواحي", amount: 3200, position: 2 },
  { code: "Z3", name: "Zone 3 — éloignée", nameAr: "المنطقة 3 — البعيدة", amount: 4000, position: 3 },
];

export type RouteSeed = {
  code: string;
  name: string;
  nameAr: string;
  direction: "MORNING" | "AFTERNOON" | "BOTH";
  /** Index into VEHICLE_SEEDS, or null while unassigned. */
  vehicleIndex: number | null;
  stops: {
    name: string;
    nameAr: string;
    landmark: string;
    zoneCode: string;
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
    stops: [
      { name: "Place Zerktouni", nameAr: "ساحة الزرقطوني", landmark: "devant la pharmacie", zoneCode: "Z1", pickupTime: "07:15", dropoffTime: "17:15" },
      { name: "Boulevard Ghandi", nameAr: "شارع غاندي", landmark: "arrêt de bus", zoneCode: "Z1", pickupTime: "07:25", dropoffTime: "17:05" },
      { name: "Rond-point Bourgogne", nameAr: "دوار بورغوني", landmark: "près du café", zoneCode: "Z2", pickupTime: "07:35", dropoffTime: "16:55" },
    ],
  },
  {
    code: "L2",
    name: "Ligne 2 — Ain Diab",
    nameAr: "الخط 2 — عين الذئاب",
    direction: "BOTH",
    vehicleIndex: 1,
    stops: [
      { name: "Corniche", nameAr: "الكورنيش", landmark: "face à l'hôtel", zoneCode: "Z2", pickupTime: "07:00", dropoffTime: "17:30" },
      { name: "Anfa Place", nameAr: "أنفا بلاس", landmark: "entrée principale", zoneCode: "Z2", pickupTime: "07:12", dropoffTime: "17:18" },
      { name: "Californie", nameAr: "كاليفورنيا", landmark: "rond-point", zoneCode: "Z3", pickupTime: "07:28", dropoffTime: "17:02" },
    ],
  },
  {
    code: "L3",
    name: "Ligne 3 — Sidi Maârouf",
    nameAr: "الخط 3 — سيدي معروف",
    direction: "MORNING",
    vehicleIndex: 2,
    stops: [
      { name: "Sidi Maârouf centre", nameAr: "سيدي معروف المركز", landmark: "devant la mosquée", zoneCode: "Z3", pickupTime: "06:50", dropoffTime: "" },
      { name: "Technopark", nameAr: "تكنوبارك", landmark: "parking visiteurs", zoneCode: "Z3", pickupTime: "07:05", dropoffTime: "" },
    ],
  },
];

export async function seedTransport(
  db: SeedDb,
  input: { schoolId: string; schoolYearId: string },
): Promise<void> {
  const vehicleIds: string[] = [];

  for (const vehicle of VEHICLE_SEEDS) {
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
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
      },
      select: { id: true },
    });
    vehicleIds.push(row.id);
  }

  const zoneIdByCode: Record<string, string> = {};
  for (const zone of ZONE_SEEDS) {
    const row = await db.transportZone.upsert({
      where: {
        schoolYearId_code: {
          schoolYearId: input.schoolYearId,
          code: zone.code,
        },
      },
      update: {
        name: zone.name,
        nameAr: zone.nameAr,
        // Centimes, exactly as an action would write them.
        amountCentimes: Math.round(zone.amount * 100),
        position: zone.position,
      },
      create: {
        schoolYearId: input.schoolYearId,
        code: zone.code,
        name: zone.name,
        nameAr: zone.nameAr,
        amountCentimes: Math.round(zone.amount * 100),
        position: zone.position,
      },
      select: { id: true },
    });
    zoneIdByCode[zone.code] = row.id;
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

    for (const [index, stop] of route.stops.entries()) {
      await db.routeStop.upsert({
        where: { routeId_name: { routeId: row.id, name: stop.name } },
        update: {
          nameAr: stop.nameAr,
          landmark: stop.landmark,
          zoneId: zoneIdByCode[stop.zoneCode] ?? null,
          position: index,
          pickupTime: stop.pickupTime || null,
          dropoffTime: stop.dropoffTime || null,
        },
        create: {
          routeId: row.id,
          name: stop.name,
          nameAr: stop.nameAr,
          landmark: stop.landmark,
          zoneId: zoneIdByCode[stop.zoneCode] ?? null,
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
    `${VEHICLE_SEEDS.length} vehicles, ${ZONE_SEEDS.length} zones, ${ROUTE_SEEDS.length} lines, ${stopCount} stops`,
  );
}
