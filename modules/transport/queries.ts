import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { currentSchoolYearId, schoolScope } from "@/lib/scope";
import {
  COUNTED_FUEL_STATUSES,
  REGISTER_OPEN_STATUSES,
  SEAT_HOLDING_STATUSES,
  busRegisterScopeKey,
  consumptionPer100km,
  departureDelayMinutes,
  driverLabel,
  tripRunWindow,
  type RunWindow,
  scheduleLabel,
  seatsOnRoute,
  seatsRemaining,
} from "@/modules/transport/enums";

/**
 * Reads for the transport module.
 *
 * The fleet is scoped to `context.currentSchool`; the lines, the runs and the
 * subscriptions are scoped to the year as well, since all three are year-shaped
 * facts. Both come from the working context and never from the request.
 */

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
  /** The employee driving it, when there is one. */
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  /** Who to show as the driver: the employee's name, else the typed one. */
  driverLabel: string | null;
  /** The accompagnateur riding with the children, by the same rule. */
  attendantId: string | null;
  attendantName: string | null;
  attendantPhone: string | null;
  attendantLabel: string | null;
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
      driver: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      attendant: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      _count: {
        select: {
          routes: { where: { schoolYearId: currentSchoolYearId(context) } },
        },
      },
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
    driverId: vehicle.driver?.id ?? null,
    driverName: vehicle.driverName,
    // The employee's own phone beats the one typed on the bus, for the same
    // reason their name does.
    driverPhone: vehicle.driver?.phone ?? vehicle.driverPhone,
    driverLabel: driverLabel(
      vehicle.driver
        ? `${vehicle.driver.firstName} ${vehicle.driver.lastName}`
        : null,
      vehicle.driverName,
    ),
    attendantId: vehicle.attendant?.id ?? null,
    attendantName: vehicle.attendantName,
    attendantPhone: vehicle.attendant?.phone ?? vehicle.attendantPhone,
    attendantLabel: driverLabel(
      vehicle.attendant
        ? `${vehicle.attendant.firstName} ${vehicle.attendant.lastName}`
        : null,
      vehicle.attendantName,
    ),
    notes: vehicle.notes,
    routeCount: vehicle._count.routes,
  }));
}

/** The driver of the bus on a line, by the rule in `driverLabel`. */
function routeDriverName(
  vehicle: {
    driverName: string | null;
    driver: { firstName: string; lastName: string } | null;
  } | null,
): string | null {
  if (!vehicle) return null;
  return driverLabel(
    vehicle.driver
      ? `${vehicle.driver.firstName} ${vehicle.driver.lastName}`
      : null,
    vehicle.driverName,
  );
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
    where: { schoolYearId: currentSchoolYearId(context) },
    orderBy: [{ code: "asc" }],
    include: {
      vehicle: {
        select: {
          id: true,
          registration: true,
          seatCount: true,
          driverName: true,
          driver: { select: { firstName: true, lastName: true } },
        },
      },
      _count: {
        select: {
          stops: true,
          subscriptions: {
            where: { status: { in: [...SEAT_HOLDING_STATUSES] } },
          },
        },
      },
    },
  });

  return routes.map((route) => {
    const seats = seatsOnRoute(
      route.capacity,
      route.vehicle?.seatCount ?? null,
    );
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
      driverName: routeDriverName(route.vehicle),
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
  /** The quartier the stop stands in — the place, not the price band. */
  neighbourhoodId: string | null;
  neighbourhoodName: string | null;
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
  /** The run they board, when the line makes more than one. */
  scheduleId: string | null;
  scheduleLabel: string | null;
};

/** The runs a circuit may be given, for the assignment checklist. */
export async function listScheduleOptions(
  context: AuthContext,
): Promise<{ id: string; label: string; name: string; direction: string }[]> {
  const schedules = await db.transportSchedule.findMany({
    where: { schoolYearId: currentSchoolYearId(context), isActive: true },
    orderBy: [{ direction: "asc" }, { departureTime: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      direction: true,
      departureTime: true,
    },
  });

  return schedules.map((schedule) => ({
    id: schedule.id,
    label: scheduleLabel(schedule.code, schedule.departureTime),
    name: schedule.name,
    direction: schedule.direction,
  }));
}

export type RouteDetail = RouteRow & {
  notes: string | null;
  capacity: number | null;
  stops: StopRow[];
  riders: RiderRow[];
  /** The runs this line makes. */
  schedules: { id: string; label: string; name: string; direction: string }[];
  /** Ticked boxes on the two assignment tabs — ids only; the lists come from
   *  `listScheduleOptions` and `listNeighbourhoodChoices`. */
  scheduleIds: string[];
  neighbourhoodIds: string[];
};

/** One line: its stops in order, and everyone riding it. */
export async function findRoute(
  context: AuthContext,
  routeId: string,
): Promise<RouteDetail | null> {
  const route = await db.transportRoute.findFirst({
    // Scoped by the year in context — a route id alone must not reach another
    // year's line, let alone another school's.
    where: { id: routeId, schoolYearId: currentSchoolYearId(context) },
    include: {
      vehicle: {
        select: {
          id: true,
          registration: true,
          seatCount: true,
          driverName: true,
          driver: { select: { firstName: true, lastName: true } },
        },
      },
      stops: {
        orderBy: [{ position: "asc" }, { name: "asc" }],
        include: {
          neighbourhood: { select: { id: true, name: true } },
          _count: {
            select: {
              subscriptions: {
                where: { status: { in: [...SEAT_HOLDING_STATUSES] } },
              },
            },
          },
        },
      },
      schedules: {
        include: {
          schedule: {
            select: {
              id: true,
              code: true,
              name: true,
              direction: true,
              departureTime: true,
            },
          },
        },
      },
      neighbourhoods: { select: { neighbourhoodId: true } },
      subscriptions: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          stop: { select: { id: true, name: true } },
          schedule: { select: { id: true, code: true, departureTime: true } },
          enrollment: {
            select: {
              schoolClass: { select: { code: true } },
              student: {
                select: {
                  id: true,
                  code: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          stops: true,
          subscriptions: {
            where: { status: { in: [...SEAT_HOLDING_STATUSES] } },
          },
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
    driverName: routeDriverName(route.vehicle),
    seats,
    taken,
    remaining: seatsRemaining(seats, taken),
    stopCount: route._count.stops,
    schedules: route.schedules
      // Sorted before it is shaped: the join row has no departure time to order
      // by in the query, and the read order of a join is not a promise. "HH:MM"
      // compares correctly as text, which is half of why it is stored that way.
      .toSorted((a, b) =>
        a.schedule.departureTime.localeCompare(b.schedule.departureTime),
      )
      .map((link) => ({
        id: link.schedule.id,
        label: scheduleLabel(link.schedule.code, link.schedule.departureTime),
        name: link.schedule.name,
        direction: link.schedule.direction,
      })),
    scheduleIds: route.schedules.map((link) => link.scheduleId),
    neighbourhoodIds: route.neighbourhoods.map((link) => link.neighbourhoodId),
    stops: route.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      nameAr: stop.nameAr,
      landmark: stop.landmark,
      position: stop.position,
      neighbourhoodId: stop.neighbourhood?.id ?? null,
      neighbourhoodName: stop.neighbourhood?.name ?? null,
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
      scheduleId: subscription.schedule?.id ?? null,
      scheduleLabel: subscription.schedule
        ? scheduleLabel(
            subscription.schedule.code,
            subscription.schedule.departureTime,
          )
        : null,
    })),
  };
}

export type SubscribableStudent = {
  enrollmentId: string;
  studentId: string;
  label: string;
  /**
   * Where the child lives — `Student.neighbourhoodId`, the address, not a stop.
   *
   * Carried here because it is what the création wizard groups its passenger
   * list by: a line is drawn for a set of quartiers, and the families it exists
   * to collect are the ones living in them. Null for a pupil whose address was
   * never taken down; they are still subscribable, just not from the wizard —
   * see the note on its passenger step.
   */
  neighbourhoodId: string | null;
  /**
   * Whether the family actually took the bus at enrolment — an EnrollmentOption
   * on a charge of kind TRANSPORT.
   *
   * Carried rather than filtered on, because the two callers want opposite
   * defaults and neither wants the other's. The wizard shows subscribers first:
   * a line is drawn for the families who asked for it. The rider dialog on the
   * line's page offers everyone, because it exists partly for the case
   * `syncTransportOption` was written for — a child put on a circuit whose
   * enrolment never ticked the box, who is then billed rather than left riding
   * free. Filtering here would make that case unreachable instead of merely
   * deliberate.
   */
  usesTransport: boolean;
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
      schoolYearId: currentSchoolYearId(context),
      student: { ...schoolScope(context), isActive: true },
      transportSubscriptions: {
        none: { status: { in: [...SEAT_HOLDING_STATUSES] } },
      },
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      schoolClass: { select: { code: true } },
      student: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          neighbourhoodId: true,
        },
      },
      // The opt-in, not a flag: `Enrollment.usesTransport` was replaced by a
      // row naming the charge — see prisma/schema/enrolment/enrollment-option.prisma.
      options: {
        where: { feeType: { kind: "TRANSPORT" } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    studentId: enrollment.student.id,
    label: `${enrollment.student.firstName} ${enrollment.student.lastName} · ${enrollment.student.code}${
      enrollment.schoolClass ? ` · ${enrollment.schoolClass.code}` : ""
    }`,
    neighbourhoodId: enrollment.student.neighbourhoodId,
    usesTransport: enrollment.options.length > 0,
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
        schoolYearId: currentSchoolYearId(context),
        student: schoolScope(context),
      },
    },
    include: {
      stop: { select: { id: true, name: true } },
      route: { select: { code: true, name: true } },
      schedule: { select: { id: true, code: true, departureTime: true } },
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
    scheduleId: subscription.schedule?.id ?? null,
    scheduleLabel: subscription.schedule
      ? scheduleLabel(
          subscription.schedule.code,
          subscription.schedule.departureTime,
        )
      : null,
  }));
}

/** The lines a rider may be put on — the picker on the route screen. */
export async function listRouteOptions(
  context: AuthContext,
): Promise<{ id: string; label: string }[]> {
  const routes = await db.transportRoute.findMany({
    where: { schoolYearId: currentSchoolYearId(context), isActive: true },
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

// ── The inscription cascade ──────────────────────────────────────────────────

export type TransportStopChoice = {
  id: string;
  label: string;
};

export type TransportRouteChoice = {
  id: string;
  label: string;
  direction: string;
  seats: number;
  remaining: number;
  schedules: { id: string; label: string; name: string; direction: string }[];
  stops: TransportStopChoice[];
  /**
   * True when `stops` is every stop on the line rather than the quartier's own.
   *
   * Happens when a circuit is declared to serve a quartier but none of its
   * stops has been tagged with it — ordinary in July, when the catchment is
   * agreed before the stops are drawn. Falling back to the whole line beats
   * offering an empty select, and the flag lets the form say why the list is
   * longer than expected.
   */
  stopsUnfiltered: boolean;
};

export type NeighbourhoodChoice = {
  id: string;
  label: string;
  /** The town it sits in, so the picker can group by it — see `NeighbourhoodOptions`. */
  cityName: string;
  /** Circuits declared to serve this quartier — see RouteNeighbourhood. */
  routes: TransportRouteChoice[];
};

/**
 * Everything the Quartier → Circuit → Horaire → Arrêt cascade needs, in one
 * read and pre-nested.
 *
 * Shaped like `loadEnrolmentChoices`, and for the same reason: the form narrows
 * by `.find()` in memory, so choosing a quartier costs nothing and there is no
 * loading state to design around. The duplication of a circuit under each
 * quartier it serves is deliberate — a handful of lines against a round trip
 * per keystroke is not a trade worth making.
 */
export async function loadTransportChoices(
  context: AuthContext,
): Promise<NeighbourhoodChoice[]> {
  const [neighbourhoods, routes] = await Promise.all([
    db.neighbourhood.findMany({
      where: { ...schoolScope(context), isActive: true },
      orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, city: { select: { name: true } } },
    }),
    db.transportRoute.findMany({
      where: { schoolYearId: currentSchoolYearId(context), isActive: true },
      orderBy: [{ code: "asc" }],
      include: {
        vehicle: { select: { seatCount: true } },
        neighbourhoods: { select: { neighbourhoodId: true } },
        schedules: {
          include: {
            schedule: {
              select: {
                id: true,
                code: true,
                name: true,
                direction: true,
                departureTime: true,
                isActive: true,
              },
            },
          },
        },
        stops: {
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: { id: true, name: true, neighbourhoodId: true },
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: { in: [...SEAT_HOLDING_STATUSES] } },
            },
          },
        },
      },
    }),
  ]);

  const stopChoice = (stop: (typeof routes)[number]["stops"][number]) => ({
    id: stop.id,
    label: stop.name,
  });

  return neighbourhoods.map((neighbourhood) => ({
    id: neighbourhood.id,
    label: `${neighbourhood.city.name} · ${neighbourhood.name}`,
    cityName: neighbourhood.city.name,
    routes: routes
      .filter((route) =>
        route.neighbourhoods.some(
          (link) => link.neighbourhoodId === neighbourhood.id,
        ),
      )
      .map((route) => {
        const seats = seatsOnRoute(
          route.capacity,
          route.vehicle?.seatCount ?? null,
        );
        const own = route.stops.filter(
          (stop) => stop.neighbourhoodId === neighbourhood.id,
        );
        const stops = own.length > 0 ? own : route.stops;

        return {
          id: route.id,
          label: `${route.code} · ${route.name}`,
          direction: route.direction,
          seats,
          remaining: seatsRemaining(seats, route._count.subscriptions),
          schedules: route.schedules
            .filter((link) => link.schedule.isActive)
            .sort((a, b) =>
              a.schedule.departureTime.localeCompare(b.schedule.departureTime),
            )
            .map((link) => ({
              id: link.schedule.id,
              label: scheduleLabel(
                link.schedule.code,
                link.schedule.departureTime,
              ),
              name: link.schedule.name,
              direction: link.schedule.direction,
            })),
          stops: stops.map(stopChoice),
          stopsUnfiltered: own.length === 0 && route.stops.length > 0,
        };
      }),
  }));
}

// ── Consommation ─────────────────────────────────────────────────────────────

export type FuelRequestRow = {
  id: string;
  vehicleId: string;
  vehicleRegistration: string;
  /** Who asked: the employee's name, else the typed one — as `driverLabel` does. */
  requestedBy: string | null;
  occurredOn: string;
  litresTenths: number;
  odometerKm: number | null;
  amountCentimes: number;
  status: string;
  notes: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  cashOperationId: string | null;
  /** Kilometres since this bus's previous counted reading, when both are known. */
  distanceKm: number | null;
  /** Tenths of a litre per 100 km over that distance — see `consumptionPer100km`. */
  consumptionTenths: number | null;
};

/**
 * Every fuel request for the school, newest first, with each one's consumption.
 *
 * The consumption is worked out here rather than on the screen because it needs
 * the *previous* reading for the same bus, which no single row carries. Doing it
 * in the query is also what keeps the fleet list and a bus's own history from
 * quoting two different figures for the same tank.
 */
export async function listFuelRequests(
  context: AuthContext,
): Promise<FuelRequestRow[]> {
  const requests = await db.fuelRequest.findMany({
    where: schoolScope(context),
    orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
    include: {
      vehicle: { select: { id: true, registration: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
      decidedBy: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  // Walked oldest-first, one cursor per bus, so each row is measured against the
  // reading before it. A rejected request never happened, so it neither advances
  // the cursor nor gets a figure of its own.
  const lastOdometer = new Map<string, number>();

  const rows = requests.map((request) => {
    const counted = COUNTED_FUEL_STATUSES.includes(
      request.status as (typeof COUNTED_FUEL_STATUSES)[number],
    );
    const previous = lastOdometer.get(request.vehicleId);
    const distanceKm =
      counted && request.odometerKm !== null && previous !== undefined
        ? request.odometerKm - previous
        : null;

    if (counted && request.odometerKm !== null) {
      lastOdometer.set(request.vehicleId, request.odometerKm);
    }

    return {
      id: request.id,
      vehicleId: request.vehicleId,
      vehicleRegistration: request.vehicle.registration,
      requestedBy: driverLabel(
        request.requestedBy
          ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`
          : null,
        request.requestedByName,
      ),
      occurredOn: request.occurredOn.toISOString(),
      litresTenths: request.litresTenths,
      odometerKm: request.odometerKm,
      amountCentimes: request.amountCentimes,
      status: request.status,
      notes: request.notes,
      decidedBy: request.decidedBy
        ? (request.decidedBy.profile
            ? `${request.decidedBy.profile.firstName} ${request.decidedBy.profile.lastName}`.trim()
            : "") || request.decidedBy.username
        : null,
      decidedAt: request.decidedAt?.toISOString() ?? null,
      cashOperationId: request.cashOperationId,
      distanceKm,
      consumptionTenths:
        distanceKm === null
          ? null
          : consumptionPer100km(request.litresTenths, distanceKm),
    };
  });

  // Read newest-first, computed oldest-first. The two orders are not the same
  // question and reversing here is cheaper than a second pass over the table.
  return rows.reverse();
}

export type FuelSummary = {
  pendingCount: number;
  pendingCentimes: number;
  /** Approved or paid, in the last thirty days. */
  recentCentimes: number;
  recentLitresTenths: number;
};

export async function fuelSummary(context: AuthContext): Promise<FuelSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [pending, recent] = await Promise.all([
    db.fuelRequest.aggregate({
      where: { ...schoolScope(context), status: "PENDING" },
      _count: { _all: true },
      _sum: { amountCentimes: true },
    }),
    db.fuelRequest.aggregate({
      where: {
        ...schoolScope(context),
        status: { in: ["APPROVED", "PAID"] },
        occurredOn: { gte: since },
      },
      _sum: { amountCentimes: true, litresTenths: true },
    }),
  ]);

  return {
    pendingCount: pending._count._all,
    pendingCentimes: pending._sum.amountCentimes ?? 0,
    recentCentimes: recent._sum.amountCentimes ?? 0,
    recentLitresTenths: recent._sum.litresTenths ?? 0,
  };
}

/** Buses a fuel request may be raised against: anything not retired. */
export async function listFuelVehicleOptions(
  context: AuthContext,
): Promise<{ id: string; label: string; driverId: string | null }[]> {
  const vehicles = await db.vehicle.findMany({
    where: { ...schoolScope(context), status: { not: "RETIRED" } },
    orderBy: { registration: "asc" },
    select: {
      id: true,
      registration: true,
      make: true,
      driverId: true,
    },
  });

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.make
      ? `${vehicle.registration} · ${vehicle.make}`
      : vehicle.registration,
    // So the request form can default the driver to whoever drives the bus.
    driverId: vehicle.driverId,
  }));
}

// ── L'appel du bus ───────────────────────────────────────────────────────────

export type BusRunOption = {
  routeId: string;
  routeLabel: string;
  scheduleId: string | null;
  scheduleLabel: string | null;
  /** "MORNING" | "AFTERNOON" | "BOTH" — the run's, else the line's. */
  direction: string;
  riderCount: number;
};

/**
 * Every register that could be taken today: each line crossed with each run it
 * makes.
 *
 * A line that declares no horaire still gets one entry with a null run — that
 * is the single-departure case the nullable `scheduleId` exists for, and a
 * driver on such a line must still be able to call the roll.
 */
export async function listBusRuns(
  context: AuthContext,
): Promise<BusRunOption[]> {
  const routes = await db.transportRoute.findMany({
    where: { schoolYearId: currentSchoolYearId(context), isActive: true },
    orderBy: [{ code: "asc" }],
    include: {
      schedules: {
        include: {
          schedule: {
            select: {
              id: true,
              code: true,
              direction: true,
              departureTime: true,
              isActive: true,
            },
          },
        },
      },
      subscriptions: {
        where: { status: "ACTIVE" },
        select: {
          direction: true,
          scheduleId: true,
          schedule: { select: { direction: true } },
        },
      },
    },
  });

  const runs: BusRunOption[] = [];

  for (const route of routes) {
    const routeLabel = `${route.code} · ${route.name}`;
    const schedules = route.schedules
      .filter((link) => link.schedule.isActive)
      .map((link) => link.schedule)
      .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

    if (schedules.length === 0) {
      runs.push({
        routeId: route.id,
        routeLabel,
        scheduleId: null,
        scheduleLabel: null,
        direction: route.direction,
        riderCount: route.subscriptions.length,
      });
      continue;
    }

    for (const schedule of schedules) {
      runs.push({
        routeId: route.id,
        routeLabel,
        scheduleId: schedule.id,
        scheduleLabel: scheduleLabel(schedule.code, schedule.departureTime),
        direction: schedule.direction,
        riderCount: route.subscriptions.filter((subscription) =>
          ridesThisRun(
            {
              ...subscription,
              scheduleDirection: subscription.schedule?.direction ?? null,
            },
            schedule.id,
            schedule.direction,
          ),
        ).length,
      });
    }
  }

  return runs;
}

/**
 * Whether one abonnement is expected on one departure.
 *
 * Two rules, and both matter at the kerb:
 *
 *   * **Direction.** A child who only rides home is not called on the morning
 *     run. BOTH rides every departure of their line.
 *   * **The named run, within its own direction only.** A rider who chose the
 *     07:00 pick-up is expected on that departure and no other *morning* one —
 *     but choosing it says nothing about which return they take, so they are
 *     still called on every afternoon run of their line. Binding the choice
 *     across directions would drop every BOTH rider off the evening register,
 *     which is exactly the half of the day a school worries about.
 *
 * Kept here rather than inlined so the picker's rider count and the sheet's
 * rider list cannot disagree about who should be on the bus.
 */
function ridesThisRun(
  subscription: {
    direction: string;
    scheduleId: string | null;
    /** The direction of the run they named, when they named one. */
    scheduleDirection: string | null;
  },
  scheduleId: string | null,
  runDirection: string,
): boolean {
  const goesThisWay =
    subscription.direction === "BOTH" ||
    runDirection === "BOTH" ||
    subscription.direction === runDirection;
  if (!goesThisWay) return false;

  // No run named: expected on any departure going their way, which is what a
  // line with a single departure looks like.
  if (subscription.scheduleId === null) return true;

  // Named a run going the other way: it does not speak to this departure.
  if (subscription.scheduleDirection !== runDirection) return true;

  return subscription.scheduleId === scheduleId;
}

export type BusRegisterEntry = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  stopName: string;
  /** Scheduled pick-up at their stop, so the driver reads the sheet in order. */
  pickupTime: string | null;
  direction: string;
  /** Null when nobody has marked this rider on this run yet. */
  attendanceId: string | null;
  status: string | null;
  minutesLate: number;
  isJustified: boolean;
  reason: string | null;
};

/**
 * One run's register for one day: everybody expected on the bus, with their
 * mark if it exists.
 *
 * Built as a left join rather than a list of marks, exactly as `listRegister`
 * is: the question a driver has before pulling away is "who have I not
 * accounted for", and a list of what was recorded cannot answer it.
 *
 * Ordered by the stop's pick-up time — the order the bus actually meets them,
 * which is the order the sheet has to be read in.
 */
export async function loadBusRegister(
  context: AuthContext,
  input: { routeId: string; scheduleId: string | null; date: Date },
): Promise<BusRegisterEntry[] | null> {
  // Scoped by the year in context: a route id alone must never reach another
  // year's line, let alone another school's.
  const route = await db.transportRoute.findFirst({
    where: { id: input.routeId, schoolYearId: currentSchoolYearId(context) },
    select: { id: true, direction: true },
  });
  if (!route) return null;

  // The run must be one this line actually makes — otherwise a crafted id would
  // open a register for a departure that does not serve these children.
  let runDirection = route.direction;
  if (input.scheduleId) {
    const link = await db.routeSchedule.findUnique({
      where: {
        routeId_scheduleId: {
          routeId: route.id,
          scheduleId: input.scheduleId,
        },
      },
      select: { schedule: { select: { direction: true } } },
    });
    if (!link) return null;
    runDirection = link.schedule.direction;
  }

  const subscriptions = await db.transportSubscription.findMany({
    where: { routeId: route.id, status: "ACTIVE" },
    include: {
      schedule: { select: { direction: true } },
      stop: { select: { name: true, position: true, pickupTime: true } },
      enrollment: {
        select: {
          schoolClass: { select: { code: true } },
          student: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      },
      attendance: {
        where: {
          date: input.date,
          scopeKey: busRegisterScopeKey(input.scheduleId),
        },
        select: {
          id: true,
          status: true,
          minutesLate: true,
          isJustified: true,
          reason: true,
        },
        take: 1,
      },
    },
  });

  return subscriptions
    .filter((subscription) =>
      ridesThisRun(
        {
          ...subscription,
          scheduleDirection: subscription.schedule?.direction ?? null,
        },
        input.scheduleId,
        runDirection,
      ),
    )
    .sort(
      (a, b) =>
        a.stop.position - b.stop.position ||
        a.enrollment.student.lastName.localeCompare(
          b.enrollment.student.lastName,
        ),
    )
    .map((subscription) => {
      const mark = subscription.attendance[0] ?? null;
      return {
        subscriptionId: subscription.id,
        studentId: subscription.enrollment.student.id,
        studentName: `${subscription.enrollment.student.firstName} ${subscription.enrollment.student.lastName}`,
        studentCode: subscription.enrollment.student.code,
        className: subscription.enrollment.schoolClass?.code ?? null,
        stopName: subscription.stop.name,
        pickupTime: subscription.stop.pickupTime,
        direction: subscription.direction,
        attendanceId: mark?.id ?? null,
        status: mark?.status ?? null,
        minutesLate: mark?.minutesLate ?? 0,
        isJustified: mark?.isJustified ?? false,
        reason: mark?.reason ?? null,
      };
    });
}

// ── Le voyage ────────────────────────────────────────────────────────────────

export type TripRunRow = {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  /**
   * The horaire, carried so the board can link to this run's register — which
   * the attendance screen addresses as `routeId:scheduleId`, not by run.
   */
  scheduleId: string;
  scheduleName: string;
  direction: string;
  status: string;
  /** As the horaire called for on the day — "07:00". */
  plannedDepartureTime: string;
  startedAt: string | null;
  startedByName: string | null;
  arrivedAt: string | null;
  arrivedByName: string | null;
  /** Minutes late leaving; negative is early, null before departure. */
  delayMinutes: number | null;
  vehicleRegistration: string | null;
  driverName: string | null;
  /** Riders holding a seat on this circuit — how many the bus is expected to carry. */
  riderCount: number;
  cancelReason: string | null;
  /**
   * Where the run stands against the clock, as of the moment it was read.
   *
   * Computed here rather than on the client because the phone cannot import
   * this module — see the note on mobile/src/api/types.ts — and because the
   * server has to make the same judgement anyway when it decides whether to
   * accept a départ.
   */
  window: RunWindow;
};

const tripRunInclude = {
  route: {
    select: {
      code: true,
      name: true,
      vehicle: {
        select: {
          registration: true,
          driverName: true,
          driver: { select: { firstName: true, lastName: true } },
        },
      },
      _count: { select: { subscriptions: true } },
    },
  },
  schedule: { select: { name: true, direction: true } },
  vehicle: { select: { registration: true } },
  startedBy: {
    select: {
      username: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
  arrivedBy: {
    select: {
      username: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

function toTripRunRow(
  run: Prisma.TripRunGetPayload<{ include: typeof tripRunInclude }>,
  now: Date = new Date(),
): TripRunRow {
  return {
    id: run.id,
    routeId: run.routeId,
    routeCode: run.route.code,
    routeName: run.route.name,
    scheduleId: run.scheduleId,
    scheduleName: run.schedule.name,
    direction: run.schedule.direction,
    status: run.status,
    plannedDepartureTime: run.plannedDepartureTime,
    startedAt: run.startedAt?.toISOString() ?? null,
    startedByName: run.startedBy ? displayName(run.startedBy) : null,
    arrivedAt: run.arrivedAt?.toISOString() ?? null,
    arrivedByName: run.arrivedBy ? displayName(run.arrivedBy) : null,
    delayMinutes: departureDelayMinutes(
      run.plannedDepartureTime,
      run.startedAt,
    ),
    // The bus that went, falling back to the circuit's usual one for a run that
    // has not started — the board should say which bus is *expected*.
    vehicleRegistration:
      run.vehicle?.registration ?? run.route.vehicle?.registration ?? null,
    driverName: driverLabel(
      run.route.vehicle?.driver
        ? `${run.route.vehicle.driver.firstName} ${run.route.vehicle.driver.lastName}`.trim()
        : null,
      run.route.vehicle?.driverName ?? null,
    ),
    riderCount: run.route._count.subscriptions,
    cancelReason: run.cancelReason,
    window: tripRunWindow(run.date, run.plannedDepartureTime, now),
  };
}

/**
 * The day's board: every voyage the school is meant to make, and where each is.
 *
 * Ordered by the time it was due out rather than by circuit, because the
 * question this screen answers is "what is happening now" — a board sorted by
 * line makes somebody read all of it to find the 07:00 that has not left.
 */
export async function listDayRuns(
  context: AuthContext,
  date: Date,
): Promise<TripRunRow[]> {
  const runs = await db.tripRun.findMany({
    where: { date, route: { schoolYearId: currentSchoolYearId(context) } },
    orderBy: [{ plannedDepartureTime: "asc" }, { route: { code: "asc" } }],
    include: tripRunInclude,
  });

  const now = new Date();
  return runs.map((run) => toTripRunRow(run, now));
}

/**
 * The buses an account is crew on — the one `where` every driver read is built
 * from.
 *
 * Matched through the employment record, which is what links a login to a bus:
 * a driver or accompagnateur who is not on the payroll is free text on the
 * vehicle and has no account to sign in with anyway.
 *
 * The two are one clause rather than two code paths because they answer the
 * same question — *is this person on this bus today* — and splitting them would
 * be two chances to forget one. What the accompagnateur may then *do* is not
 * decided here: it is TRANSPORT_ATTENDANCE, checked by every route.
 */
function crewScope(userId: string): Prisma.TransportRouteWhereInput {
  return {
    vehicle: {
      OR: [{ driver: { userId } }, { attendant: { userId } }],
    },
  };
}

/**
 * A day's voyages for the buses this account crews.
 *
 * Returns an empty list rather than everything for an account that crews
 * nothing: this screen must never become a way to read the whole fleet.
 *
 * Every run of the day is returned, `window` and all — a driver who cannot see
 * that he has an afternoon return cannot plan his day. It is the *actions* that
 * the window closes, not the sight of the run, and that decision is re-made on
 * the server in `moveTripRun` rather than left to the phone.
 */
export async function listMyRuns(
  context: AuthContext,
  date: Date,
): Promise<TripRunRow[]> {
  const runs = await db.tripRun.findMany({
    where: {
      date,
      route: {
        schoolYearId: currentSchoolYearId(context),
        ...crewScope(context.user.id),
      },
    },
    orderBy: [{ plannedDepartureTime: "asc" }],
    include: tripRunInclude,
  });

  const now = new Date();
  return runs.map((run) => toTripRunRow(run, now));
}

/**
 * A run this account is crew on, or null.
 *
 * The id arrives from a phone, so it is never enough on its own: it is combined
 * with the year *and* with the crew link before anything is read or written
 * through it. This is the driver's equivalent of `reachableTripRun` in
 * `actions.ts`, and it is deliberately stricter — an office account may act on
 * any run of its school, a driver only on the bus he is on.
 */
export async function findMyRun(
  context: AuthContext,
  runId: string,
): Promise<{
  id: string;
  status: string;
  scheduleId: string;
  date: Date;
} | null> {
  return db.tripRun.findFirst({
    where: {
      id: runId,
      route: {
        schoolYearId: currentSchoolYearId(context),
        ...crewScope(context.user.id),
      },
    },
    select: { id: true, status: true, scheduleId: true, date: true },
  });
}

export type ItineraryStop = {
  id: string;
  name: string;
  nameAr: string | null;
  /** What to look for: "devant la pharmacie". */
  landmark: string | null;
  neighbourhoodName: string | null;
  position: number;
  /** "HH:MM", the scheduled time for the direction being driven. */
  time: string | null;
  /** Children holding a seat who board or alight here. */
  riderCount: number;
};

export type RunItinerary = {
  routeCode: string;
  routeName: string;
  direction: string;
  /** In the order the bus meets them — reversed on the way home. */
  stops: ItineraryStop[];
  totalRiders: number;
};

/**
 * Le trajet: the stops of the line this run drives, in the order they come.
 *
 * Separate from the register because it answers a different question. The
 * register is "who am I missing"; this is "where do I go next, and how many am
 * I picking up there" — which a driver new to a line, or covering somebody
 * else's, has no other way to learn.
 *
 * ── Why it is available before the départ ───────────────────────────────────
 * The register is withheld until the bus is under way, because a sheet marked
 * from the yard is a sheet marked wrongly. The itinerary is the opposite: it is
 * what somebody reads *before* setting off, and it names no child, so there is
 * nothing in it to withhold. The rider counts are figures, not identities.
 *
 * Crew-scoped exactly as the register is, so a run belonging to another bus
 * answers null rather than handing over a line's stops.
 */
export async function loadRunItinerary(
  context: AuthContext,
  runId: string,
): Promise<RunItinerary | null> {
  const run = await db.tripRun.findFirst({
    where: {
      id: runId,
      route: {
        schoolYearId: currentSchoolYearId(context),
        ...crewScope(context.user.id),
      },
    },
    select: {
      routeId: true,
      scheduleId: true,
      route: {
        select: {
          id: true,
          code: true,
          name: true,
          direction: true,
          stops: {
            orderBy: [{ position: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              nameAr: true,
              landmark: true,
              position: true,
              pickupTime: true,
              dropoffTime: true,
              neighbourhood: { select: { name: true } },
            },
          },
        },
      },
      schedule: { select: { direction: true } },
    },
  });
  if (!run) return null;

  // The horaire's direction wins where there is one: the same line is driven
  // outward in the morning and back in the afternoon, and the stops are read in
  // opposite orders.
  const direction = run.schedule?.direction ?? run.route.direction;
  const isReturn = direction === "AFTERNOON";

  /*
    Counted through `ridesThisRun` rather than with a `_count` on the stop.

    A plain count answers "how many hold a seat at this arrêt on this line",
    which is not the question: a child who only rides home is not standing there
    in the morning. That is the disagreement between the picker's figure and the
    sheet's list that `ridesThisRun` exists to prevent, so the trajet goes
    through it too.
  */
  const subscriptions = await db.transportSubscription.findMany({
    where: {
      routeId: run.routeId,
      status: { in: [...SEAT_HOLDING_STATUSES] },
    },
    select: {
      stopId: true,
      direction: true,
      scheduleId: true,
      schedule: { select: { direction: true } },
    },
  });

  const ridersByStop = new Map<string, number>();
  for (const subscription of subscriptions) {
    const rides = ridesThisRun(
      {
        direction: subscription.direction,
        scheduleId: subscription.scheduleId,
        scheduleDirection: subscription.schedule?.direction ?? null,
      },
      run.scheduleId,
      direction,
    );
    if (!rides) continue;
    ridersByStop.set(
      subscription.stopId,
      (ridersByStop.get(subscription.stopId) ?? 0) + 1,
    );
  }

  const stops = run.route.stops.map((stop) => ({
    id: stop.id,
    name: stop.name,
    nameAr: stop.nameAr,
    landmark: stop.landmark,
    neighbourhoodName: stop.neighbourhood?.name ?? null,
    position: stop.position,
    // Each stop carries both times; which one is meaningful depends on which
    // way the bus is going.
    time: isReturn ? stop.dropoffTime : stop.pickupTime,
    riderCount: ridersByStop.get(stop.id) ?? 0,
  }));

  return {
    routeCode: run.route.code,
    routeName: run.route.name,
    direction,
    // `position` runs from the first pick-up to the school, so the journey home
    // is that same list read backwards.
    stops: isReturn ? [...stops].reverse() : stops,
    totalRiders: stops.reduce((total, stop) => total + stop.riderCount, 0),
  };
}

export type RunRider = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  levelName: string | null;
  photoUrl: string | null;
  stopName: string;
  landmark: string | null;
  time: string | null;
  status: string | null;
  minutesLate: number;
  reason: string | null;
  /**
   * Who to ring when the child is not at the kerb.
   *
   * The one piece of family data this app puts in front of a driver, and it is
   * here for the reason the parent is given the driver's number: when a child
   * is missing from a stop, a name without a telephone is of no use to anybody.
   * Only the guardians on the child's own dossier, and only their name, their
   * relationship and their number — no address, no fee, nothing about the
   * household beyond how to reach it.
   */
  guardians: {
    name: string;
    relationship: string;
    phone: string | null;
    isPrimaryContact: boolean;
    /** Whether this adult may take the child off the bus. */
    canPickUp: boolean;
  }[];
};

/**
 * One rider of a run, for the crew.
 *
 * Reached from the register, and scoped the same way: the run must be this
 * account's, and the subscription must be on that run's line. Both are `where`
 * clauses, so a crafted subscription id answers null rather than a child.
 */
export async function findRunRider(
  context: AuthContext,
  runId: string,
  subscriptionId: string,
): Promise<RunRider | null> {
  const run = await db.tripRun.findFirst({
    where: {
      id: runId,
      route: {
        schoolYearId: currentSchoolYearId(context),
        ...crewScope(context.user.id),
      },
    },
    select: {
      routeId: true,
      scheduleId: true,
      date: true,
      route: { select: { direction: true } },
      schedule: { select: { direction: true } },
    },
  });
  if (!run) return null;

  const runDirection = run.schedule?.direction ?? run.route.direction;

  const subscription = await db.transportSubscription.findFirst({
    // Bound to the run's own line: a subscription of another route is not on
    // this bus, whoever asks.
    where: { id: subscriptionId, routeId: run.routeId },
    select: {
      id: true,
      direction: true,
      scheduleId: true,
      stop: {
        select: {
          name: true,
          landmark: true,
          pickupTime: true,
          dropoffTime: true,
        },
      },
      schedule: { select: { direction: true } },
      attendance: {
        // Keyed the same way the register keys it. Filtering on the date alone
        // would hand back the morning's mark while the afternoon run is on
        // screen — the unique index is (subscription, date, scopeKey), so a
        // rider genuinely has one row per departure.
        where: {
          date: run.date,
          scopeKey: busRegisterScopeKey(run.scheduleId),
        },
        select: { status: true, minutesLate: true, reason: true },
        take: 1,
      },
      enrollment: {
        select: {
          schoolClass: { select: { code: true } },
          levelOffering: { select: { level: { select: { name: true } } } },
          student: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              family: {
                select: {
                  guardians: {
                    where: { isActive: true },
                    // The contact the school rings first, first here too.
                    orderBy: [{ isPrimaryContact: "desc" }],
                    select: {
                      firstName: true,
                      lastName: true,
                      relationship: true,
                      phone: true,
                      isPrimaryContact: true,
                      canPickUp: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!subscription) return null;

  // The same rule the sheet uses to decide who is called at all: a child who
  // only rides home is not on the morning bus, and opening their file from a
  // run they are not on would be the register and this screen disagreeing.
  const onThisRun = ridesThisRun(
    {
      direction: subscription.direction,
      scheduleId: subscription.scheduleId,
      scheduleDirection: subscription.schedule?.direction ?? null,
    },
    run.scheduleId,
    runDirection,
  );
  if (!onThisRun) return null;

  const student = subscription.enrollment.student;
  const mark = subscription.attendance[0] ?? null;
  // The run's own direction, not the abonnement's: a BOTH rider has no single
  // direction of their own, and it is the departure that decides whether the
  // pick-up or the drop-off time is the meaningful one.
  const isReturn = runDirection === "AFTERNOON";

  return {
    subscriptionId: subscription.id,
    studentId: student.id,
    studentName: `${student.firstName} ${student.lastName}`,
    studentCode: student.code,
    className: subscription.enrollment.schoolClass?.code ?? null,
    levelName: subscription.enrollment.levelOffering?.level.name ?? null,
    photoUrl: student.photoUrl,
    stopName: subscription.stop?.name ?? "—",
    landmark: subscription.stop?.landmark ?? null,
    time: isReturn
      ? (subscription.stop?.dropoffTime ?? null)
      : (subscription.stop?.pickupTime ?? null),
    status: mark?.status ?? null,
    minutesLate: mark?.minutesLate ?? 0,
    reason: mark?.reason ?? null,
    guardians: (student.family?.guardians ?? []).map((guardian) => ({
      name: `${guardian.firstName} ${guardian.lastName}`.trim(),
      relationship: guardian.relationship,
      phone: guardian.phone,
      isPrimaryContact: guardian.isPrimaryContact,
      canPickUp: guardian.canPickUp,
    })),
  };
}

/**
 * A run and the sheet that goes with it, keyed by the run itself — the
 * chauffeur's screen, and the only read behind it.
 *
 * The office screens hold the route, the horaire and the day separately and can
 * pass all three; a driver's phone has a run id and nothing else. Rather than
 * let a route handler take the run apart to find them — which would put a
 * `where` clause in `app/` and re-derive the year scoping a third time — the
 * lookup lives here, beside the register it feeds.
 *
 * Scoped by `crewScope` as well as by the year, so a stale id from a phone that
 * has been in a drawer since June reaches nothing, and a driver cannot read
 * another bus's children by guessing.
 *
 * ── Why the list is empty before the bus leaves ──────────────────────────────
 * `entries` is withheld until the run is under way. The register is the thing
 * that is *done* on the voyage, and a sheet on screen before anybody has said
 * the bus is going is a sheet that gets marked from the yard — or worse, marked
 * for the morning run while the driver is looking at the evening one. Pressing
 * "démarrer" is what says which voyage is being made, so it is what opens the
 * names. ARRIVED keeps them, because a driver still has to be able to read back
 * and correct what he took.
 *
 * The run itself is always returned: the phone needs its status and its hour to
 * know what to offer, and the counts on it reveal nothing about a child.
 */
export async function loadRunRegister(
  context: AuthContext,
  runId: string,
): Promise<{ run: TripRunRow; entries: BusRegisterEntry[] } | null> {
  const run = await db.tripRun.findFirst({
    where: {
      id: runId,
      route: {
        schoolYearId: currentSchoolYearId(context),
        ...crewScope(context.user.id),
      },
    },
    include: tripRunInclude,
  });
  if (!run) return null;

  const row = toTripRunRow(run);
  if (!REGISTER_OPEN_STATUSES.includes(run.status)) {
    return { run: row, entries: [] };
  }

  const entries = await loadBusRegister(context, {
    routeId: run.routeId,
    scheduleId: run.scheduleId,
    date: run.date,
  });

  return { run: row, entries: entries ?? [] };
}

export type StaffVehicleRow = {
  id: string;
  registration: string;
  label: string;
  seatCount: number;
  status: string;
  /** "DRIVER" | "ATTENDANT" — how this employee rides on this bus. */
  duty: string;
  insuranceExpiresOn: string | null;
  inspectionExpiresOn: string | null;
  /** The lines the bus runs this year, in code order. */
  routes: {
    id: string;
    code: string;
    name: string;
    direction: string;
    isActive: boolean;
    stopCount: number;
    taken: number;
  }[];
};

/**
 * The fleet duty of one employee: the buses they drive or accompany, and the
 * lines those buses run this year.
 *
 * Scoped by the school through the vehicle, so a staff id alone can never reach
 * another school's fleet. The vehicles themselves are not year-shaped — a bus
 * belongs to the school — but the lines are, so only this year's are attached:
 * "which line does Hassan drive" has to mean the current one.
 *
 * A driver and an accompagnateur are one query rather than two because the
 * employee file asks one question — what is this person's service on the bus —
 * and a person can be both on different vehicles.
 */
export async function listStaffVehicles(
  context: AuthContext,
  staffId: string,
): Promise<StaffVehicleRow[]> {
  const vehicles = await db.vehicle.findMany({
    where: {
      ...schoolScope(context),
      OR: [{ driverId: staffId }, { attendantId: staffId }],
    },
    orderBy: [{ registration: "asc" }],
    select: {
      id: true,
      registration: true,
      make: true,
      model: true,
      seatCount: true,
      status: true,
      driverId: true,
      insuranceExpiresOn: true,
      inspectionExpiresOn: true,
      routes: {
        where: { schoolYearId: currentSchoolYearId(context) },
        orderBy: [{ code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          direction: true,
          isActive: true,
          _count: {
            select: {
              stops: true,
              subscriptions: {
                where: { status: { in: [...SEAT_HOLDING_STATUSES] } },
              },
            },
          },
        },
      },
    },
  });

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    registration: vehicle.registration,
    label: [vehicle.make, vehicle.model].filter(Boolean).join(" "),
    seatCount: vehicle.seatCount,
    status: vehicle.status,
    duty: vehicle.driverId === staffId ? "DRIVER" : "ATTENDANT",
    insuranceExpiresOn: vehicle.insuranceExpiresOn?.toISOString() ?? null,
    inspectionExpiresOn: vehicle.inspectionExpiresOn?.toISOString() ?? null,
    routes: vehicle.routes.map((route) => ({
      id: route.id,
      code: route.code,
      name: route.name,
      direction: route.direction,
      isActive: route.isActive,
      stopCount: route._count.stops,
      taken: route._count.subscriptions,
    })),
  }));
}
