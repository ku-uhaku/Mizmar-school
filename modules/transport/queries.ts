import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  SEAT_HOLDING_STATUSES,
  priceForDirection,
  seatsOnRoute,
  seatsRemaining,
  type TransportDirection,
} from "@/modules/transport/enums";

/**
 * Reads for the transport module.
 *
 * The fleet is scoped to `context.currentSchool`; the lines, the zones and the
 * subscriptions are scoped to the year as well, since all three are year-shaped
 * facts. Both come from the working context and never from the request.
 */

function schoolScope(context: AuthContext) {
  return { schoolId: context.currentSchool?.id ?? "__none__" };
}

function yearId(context: AuthContext): string {
  return context.currentSchoolYear?.id ?? "__none__";
}

export type VehicleRow = {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  seatCount: number;
  status: string;
  insuranceExpiresOn: string | null;
  inspectionExpiresOn: string | null;
  driverName: string | null;
  driverPhone: string | null;
  notes: string | null;
  /** Lines this bus is running in the year in context. */
  routeCount: number;
};

export async function listVehicles(
  context: AuthContext,
): Promise<VehicleRow[]> {
  const vehicles = await db.vehicle.findMany({
    where: schoolScope(context),
    orderBy: [{ status: "asc" }, { registration: "asc" }],
    include: {
      _count: { select: { routes: { where: { schoolYearId: yearId(context) } } } },
    },
  });

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    registration: vehicle.registration,
    make: vehicle.make,
    model: vehicle.model,
    modelYear: vehicle.modelYear,
    seatCount: vehicle.seatCount,
    status: vehicle.status,
    insuranceExpiresOn: vehicle.insuranceExpiresOn?.toISOString() ?? null,
    inspectionExpiresOn: vehicle.inspectionExpiresOn?.toISOString() ?? null,
    driverName: vehicle.driverName,
    driverPhone: vehicle.driverPhone,
    notes: vehicle.notes,
    routeCount: vehicle._count.routes,
  }));
}

export type ZoneRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  amountCentimes: number;
  position: number;
  isActive: boolean;
  stopCount: number;
  riderCount: number;
};

export async function listZones(context: AuthContext): Promise<ZoneRow[]> {
  const zones = await db.transportZone.findMany({
    where: { schoolYearId: yearId(context) },
    orderBy: [{ position: "asc" }, { code: "asc" }],
    include: {
      _count: {
        select: {
          stops: true,
          subscriptions: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } },
        },
      },
    },
  });

  return zones.map((zone) => ({
    id: zone.id,
    code: zone.code,
    name: zone.name,
    nameAr: zone.nameAr,
    amountCentimes: zone.amountCentimes,
    position: zone.position,
    isActive: zone.isActive,
    stopCount: zone._count.stops,
    riderCount: zone._count.subscriptions,
  }));
}

export type RouteRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  direction: string;
  isActive: boolean;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  driverName: string | null;
  /** Seats the line offers — its own cap, else the bus's. */
  seats: number;
  taken: number;
  remaining: number;
  stopCount: number;
};

/** The lines running this year, each with how full it is. */
export async function listRoutes(context: AuthContext): Promise<RouteRow[]> {
  const routes = await db.transportRoute.findMany({
    where: { schoolYearId: yearId(context) },
    orderBy: [{ code: "asc" }],
    include: {
      vehicle: {
        select: { id: true, registration: true, seatCount: true, driverName: true },
      },
      _count: {
        select: {
          stops: true,
          subscriptions: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } },
        },
      },
    },
  });

  return routes.map((route) => {
    const seats = seatsOnRoute(route.capacity, route.vehicle?.seatCount ?? null);
    const taken = route._count.subscriptions;

    return {
      id: route.id,
      code: route.code,
      name: route.name,
      nameAr: route.nameAr,
      direction: route.direction,
      isActive: route.isActive,
      vehicleId: route.vehicle?.id ?? null,
      vehicleRegistration: route.vehicle?.registration ?? null,
      driverName: route.vehicle?.driverName ?? null,
      seats,
      taken,
      remaining: seatsRemaining(seats, taken),
      stopCount: route._count.stops,
    };
  });
}

export type StopRow = {
  id: string;
  name: string;
  nameAr: string | null;
  landmark: string | null;
  position: number;
  zoneId: string | null;
  zoneName: string | null;
  zoneAmountCentimes: number | null;
  pickupTime: string | null;
  dropoffTime: string | null;
  riderCount: number;
};

export type RiderRow = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  stopId: string;
  stopName: string;
  direction: string;
  status: string;
  zoneName: string | null;
  /** What this rider is charged for the year, given their zone and direction. */
  priceCentimes: number;
};

export type RouteDetail = RouteRow & {
  notes: string | null;
  capacity: number | null;
  stops: StopRow[];
  riders: RiderRow[];
};

/** One line: its stops in order, and everyone riding it. */
export async function findRoute(
  context: AuthContext,
  routeId: string,
): Promise<RouteDetail | null> {
  const route = await db.transportRoute.findFirst({
    // Scoped by the year in context — a route id alone must not reach another
    // year's line, let alone another school's.
    where: { id: routeId, schoolYearId: yearId(context) },
    include: {
      vehicle: {
        select: { id: true, registration: true, seatCount: true, driverName: true },
      },
      stops: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
        include: {
          zone: { select: { id: true, name: true, amountCentimes: true } },
          _count: {
            select: {
              subscriptions: {
                where: { status: { in: [...SEAT_HOLDING_STATUSES] } },
              },
            },
          },
        },
      },
      subscriptions: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          zone: { select: { name: true, amountCentimes: true } },
          stop: { select: { id: true, name: true } },
          enrollment: {
            select: {
              schoolClass: { select: { code: true } },
              student: {
                select: { id: true, code: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
      _count: {
        select: {
          stops: true,
          subscriptions: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } },
        },
      },
    },
  });

  if (!route) return null;

  const seats = seatsOnRoute(route.capacity, route.vehicle?.seatCount ?? null);
  const taken = route._count.subscriptions;

  return {
    id: route.id,
    code: route.code,
    name: route.name,
    nameAr: route.nameAr,
    direction: route.direction,
    isActive: route.isActive,
    notes: route.notes,
    capacity: route.capacity,
    vehicleId: route.vehicle?.id ?? null,
    vehicleRegistration: route.vehicle?.registration ?? null,
    driverName: route.vehicle?.driverName ?? null,
    seats,
    taken,
    remaining: seatsRemaining(seats, taken),
    stopCount: route._count.stops,
    stops: route.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      nameAr: stop.nameAr,
      landmark: stop.landmark,
      position: stop.position,
      zoneId: stop.zone?.id ?? null,
      zoneName: stop.zone?.name ?? null,
      zoneAmountCentimes: stop.zone?.amountCentimes ?? null,
      pickupTime: stop.pickupTime,
      dropoffTime: stop.dropoffTime,
      riderCount: stop._count.subscriptions,
    })),
    riders: route.subscriptions.map((subscription) => ({
      subscriptionId: subscription.id,
      studentId: subscription.enrollment.student.id,
      studentName: `${subscription.enrollment.student.firstName} ${subscription.enrollment.student.lastName}`,
      studentCode: subscription.enrollment.student.code,
      className: subscription.enrollment.schoolClass?.code ?? null,
      stopId: subscription.stop.id,
      stopName: subscription.stop.name,
      direction: subscription.direction,
      status: subscription.status,
      zoneName: subscription.zone?.name ?? null,
      priceCentimes: priceForDirection(
        subscription.zone?.amountCentimes ?? 0,
        subscription.direction as TransportDirection,
      ),
    })),
  };
}

export type SubscribableStudent = {
  enrollmentId: string;
  studentId: string;
  label: string;
};

/**
 * Pupils enrolled this year who are not yet on any line — what the "add a
 * rider" picker offers.
 *
 * Excludes anyone already holding a seat in either direction: putting the same
 * child on two lines is almost always a mis-click, and the unique index would
 * refuse the second one anyway.
 */
export async function listSubscribableStudents(
  context: AuthContext,
): Promise<SubscribableStudent[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolYearId: yearId(context),
      student: { ...schoolScope(context), isActive: true },
      transportSubscriptions: {
        none: { status: { in: [...SEAT_HOLDING_STATUSES] } },
      },
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    select: {
      id: true,
      schoolClass: { select: { code: true } },
      student: {
        select: { id: true, code: true, firstName: true, lastName: true },
      },
    },
  });

  return enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    studentId: enrollment.student.id,
    label: `${enrollment.student.firstName} ${enrollment.student.lastName} · ${enrollment.student.code}${
      enrollment.schoolClass ? ` · ${enrollment.schoolClass.code}` : ""
    }`,
  }));
}

export type TransportSummary = {
  vehicleCount: number;
  activeVehicleCount: number;
  routeCount: number;
  riderCount: number;
  seatsOffered: number;
  seatsRemaining: number;
  /** Vehicles whose insurance or inspection has lapsed or is about to. */
  paperworkDue: number;
};

export async function transportSummary(
  context: AuthContext,
): Promise<TransportSummary> {
  const [vehicles, routes] = await Promise.all([
    listVehicles(context),
    listRoutes(context),
  ]);

  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const paperworkDue = vehicles.filter((vehicle) => {
    if (vehicle.status === "RETIRED") return false;
    const dates = [vehicle.insuranceExpiresOn, vehicle.inspectionExpiresOn];
    return dates.some((date) => date !== null && new Date(date) <= soon);
  }).length;

  const seatsOffered = routes.reduce((total, route) => total + route.seats, 0);
  const riderCount = routes.reduce((total, route) => total + route.taken, 0);

  return {
    vehicleCount: vehicles.length,
    activeVehicleCount: vehicles.filter((v) => v.status === "ACTIVE").length,
    routeCount: routes.length,
    riderCount,
    seatsOffered,
    seatsRemaining: seatsRemaining(seatsOffered, riderCount),
    paperworkDue,
  };
}

/**
 * A pupil's bus arrangement for the year, for their own file.
 *
 * Returns null when they do not ride — the caller renders "not subscribed"
 * rather than an empty card.
 */
export async function studentTransport(
  context: AuthContext,
  studentId: string,
): Promise<RiderRow[]> {
  const subscriptions = await db.transportSubscription.findMany({
    where: {
      enrollment: {
        studentId,
        schoolYearId: yearId(context),
        student: schoolScope(context),
      },
    },
    include: {
      zone: { select: { name: true, amountCentimes: true } },
      stop: { select: { id: true, name: true } },
      route: { select: { code: true, name: true } },
      enrollment: {
        select: {
          schoolClass: { select: { code: true } },
          student: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  return subscriptions.map((subscription) => ({
    subscriptionId: subscription.id,
    studentId: subscription.enrollment.student.id,
    studentName: `${subscription.enrollment.student.firstName} ${subscription.enrollment.student.lastName}`,
    studentCode: subscription.enrollment.student.code,
    className: subscription.enrollment.schoolClass?.code ?? null,
    stopId: subscription.stop.id,
    stopName: `${subscription.route.code} · ${subscription.stop.name}`,
    direction: subscription.direction,
    status: subscription.status,
    zoneName: subscription.zone?.name ?? null,
    priceCentimes: priceForDirection(
      subscription.zone?.amountCentimes ?? 0,
      subscription.direction as TransportDirection,
    ),
  }));
}

/** The lines a rider may be put on — the picker on the route screen. */
export async function listRouteOptions(
  context: AuthContext,
): Promise<{ id: string; label: string }[]> {
  const routes = await db.transportRoute.findMany({
    where: { schoolYearId: yearId(context), isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return routes.map((route) => ({
    id: route.id,
    label: `${route.code} · ${route.name}`,
  }));
}

/** Vehicles that may be put on a line: anything not retired. */
export async function listVehicleOptions(
  context: AuthContext,
): Promise<{ id: string; label: string; seatCount: number }[]> {
  const vehicles = await db.vehicle.findMany({
    where: { ...schoolScope(context), status: { not: "RETIRED" } },
    orderBy: { registration: "asc" },
    select: { id: true, registration: true, make: true, seatCount: true },
  });

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.make
      ? `${vehicle.registration} · ${vehicle.make}`
      : vehicle.registration,
    seatCount: vehicle.seatCount,
  }));
}
