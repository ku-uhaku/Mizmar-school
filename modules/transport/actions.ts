"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  boolField,
  field,
  listField,
  withActionErrors,
} from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { currentSchoolYearId } from "@/lib/scope";
import { startOfDay } from "@/modules/hr/enums";
import {
  decideFuelRequest,
  markBusRunInBulk,
  moveTripRun,
  markRiderAttendance,
  setRouteNeighbourhoods,
  setRouteSchedules,
  subscribeRider,
  subscribeRiderToRuns,
  unsubscribeRider,
  updateRider,
} from "@/modules/transport/service";
import { tripRunWindow } from "@/modules/transport/enums";
import {
  fuelDecisionSchema,
  fuelRequestSchema,
  riderAttendanceSchema,
  routeSchema,
  stopSchema,
  subscriptionSchema,
  vehicleSchema,
} from "@/modules/transport/validation";

/**
 * Actions for the transport module.
 *
 * The school and the year come from the working context, never from the form.
 * Every id that arrives in a request — a vehicle, a stop, an enrolment — is
 * re-derived against that context before anything is written, because these
 * endpoints seat children on buses and change what their families are charged.
 */

const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

async function schoolContext() {
  const t = await getDictionary();
  const context = await requireAuth();
  return { t, context, schoolId: context.currentSchool?.id };
}

// ── Fleet ────────────────────────────────────────────────────────────────────

export async function saveVehicleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const parsed = vehicleSchema(t).safeParse({
      registration: field(formData, "registration"),
      make: field(formData, "make"),
      model: field(formData, "model"),
      modelYear: field(formData, "modelYear"),
      seatCount: field(formData, "seatCount"),
      status: field(formData, "status"),
      insuranceExpiresOn: field(formData, "insuranceExpiresOn"),
      inspectionExpiresOn: field(formData, "inspectionExpiresOn"),
      driverId: optionalId(formData, "driverId"),
      driverName: field(formData, "driverName"),
      driverPhone: field(formData, "driverPhone"),
      attendantId: optionalId(formData, "attendantId"),
      attendantName: field(formData, "attendantName"),
      attendantPhone: field(formData, "attendantPhone"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const id = field(formData, "id");

    // Editing: the row must be one of this school's before it is touched.
    if (id) {
      const existing = await db.vehicle.findFirst({
        where: { id, schoolId },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    const clash = await db.vehicle.findFirst({
      where: {
        schoolId,
        registration: parsed.data.registration,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });
    if (clash) return failure(t.transport.registrationTaken);

    // Both crew members must be this school's employees — a staff id from the
    // request must never reach another school's payroll.
    const [driver, attendant] = await Promise.all([
      parsed.data.driverId
        ? db.staff.findFirst({
            where: { id: parsed.data.driverId, schoolId },
            select: { id: true },
          })
        : null,
      parsed.data.attendantId
        ? db.staff.findFirst({
            where: { id: parsed.data.attendantId, schoolId },
            select: { id: true },
          })
        : null,
    ]);
    if (parsed.data.driverId && !driver) return failure(t.errors.notFound);
    if (parsed.data.attendantId && !attendant) return failure(t.errors.notFound);

    const data = {
      ...parsed.data,
      driverId: driver?.id ?? null,
      attendantId: attendant?.id ?? null,
      schoolId,
    };

    if (id) {
      await db.vehicle.update({ where: { id }, data });
    } else {
      await db.vehicle.create({ data });
    }

    refresh();
    return success(
      id ? t.transport.vehicleUpdated : t.transport.vehicleCreated,
    );
  });
}

export async function deleteVehicleAction(
  vehicleId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_DELETE);

    const vehicle = await db.vehicle.findFirst({
      where: { id: vehicleId, schoolId },
      select: { id: true, _count: { select: { routes: true } } },
    });
    if (!vehicle) return failure(t.errors.notFound);

    // A bus that has run a line is history. Retiring it keeps the routes it
    // served readable; deleting it would blank them.
    if (vehicle._count.routes > 0) return failure(t.transport.vehicleInUse);

    await db.vehicle.delete({ where: { id: vehicleId } });

    refresh();
    return success(t.transport.vehicleDeleted);
  });
}


export async function saveRouteAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const parsed = routeSchema(t).safeParse({
      code: field(formData, "code"),
      name: field(formData, "name"),
      nameAr: field(formData, "nameAr"),
      direction: field(formData, "direction"),
      vehicleId: optionalId(formData, "vehicleId"),
      capacity: field(formData, "capacity"),
      isActive: boolField(formData, "isActive"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const id = field(formData, "id");
    if (id) {
      const existing = await db.transportRoute.findFirst({
        where: { id, schoolYearId },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    // The bus must be one of this school's.
    const vehicle = parsed.data.vehicleId
      ? await db.vehicle.findFirst({
          where: { id: parsed.data.vehicleId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.vehicleId && !vehicle) return failure(t.errors.notFound);

    const clash = await db.transportRoute.findFirst({
      where: {
        schoolYearId,
        code: parsed.data.code,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });
    if (clash) return failure(t.transport.routeCodeTaken);

    const data = {
      schoolYearId,
      code: parsed.data.code,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      direction: parsed.data.direction,
      vehicleId: vehicle?.id ?? null,
      capacity: parsed.data.capacity,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes,
    };

    if (id) {
      await db.transportRoute.update({ where: { id }, data });
    } else {
      await db.transportRoute.create({ data });
    }

    refresh();
    return success(id ? t.transport.routeUpdated : t.transport.routeCreated);
  });
}

export async function deleteRouteAction(routeId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_DELETE);

    const route = await db.transportRoute.findFirst({
      where: {
        id: routeId,
        schoolYearId: currentSchoolYearId(context),
      },
      select: { id: true, _count: { select: { subscriptions: true } } },
    });
    if (!route) return failure(t.errors.notFound);

    // Restrict on the subscription would throw; saying so is better than a 500.
    if (route._count.subscriptions > 0)
      return failure(t.transport.routeHasRiders);

    await db.transportRoute.delete({ where: { id: routeId } });

    refresh();
    return success(t.transport.routeDeleted);
  });
}

// ── Stops ────────────────────────────────────────────────────────────────────

export async function saveStopAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const parsed = stopSchema(t).safeParse({
      routeId: field(formData, "routeId"),
      name: field(formData, "name"),
      nameAr: field(formData, "nameAr"),
      landmark: field(formData, "landmark"),
      neighbourhoodId: optionalId(formData, "neighbourhoodId"),
      position: field(formData, "position") || "0",
      pickupTime: field(formData, "pickupTime"),
      dropoffTime: field(formData, "dropoffTime"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The line must be one of this year's.
    const route = await db.transportRoute.findFirst({
      where: { id: parsed.data.routeId, schoolYearId },
      select: { id: true },
    });
    if (!route) return failure(t.errors.notFound);

    // The quartier is school-scoped rather than year-scoped — a place does not
    // expire with the tariff — so it is re-read against the school, not the year.
    const neighbourhood = parsed.data.neighbourhoodId
      ? await db.neighbourhood.findFirst({
          where: { id: parsed.data.neighbourhoodId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.neighbourhoodId && !neighbourhood) {
      return failure(t.errors.notFound);
    }

    const id = field(formData, "id");
    if (id) {
      const existing = await db.routeStop.findFirst({
        where: { id, route: { schoolYearId } },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    const clash = await db.routeStop.findFirst({
      where: {
        routeId: route.id,
        name: parsed.data.name,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });
    if (clash) return failure(t.transport.stopNameTaken);

    const data = {
      routeId: route.id,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      landmark: parsed.data.landmark,
      neighbourhoodId: neighbourhood?.id ?? null,
      position: parsed.data.position,
      pickupTime: parsed.data.pickupTime,
      dropoffTime: parsed.data.dropoffTime,
    };

    if (id) {
      await db.routeStop.update({ where: { id }, data });
    } else {
      await db.routeStop.create({ data });
    }

    refresh();
    return success(t.transport.stopSaved);
  });
}

export async function deleteStopAction(stopId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const stop = await db.routeStop.findFirst({
      where: {
        id: stopId,
        route: { schoolYearId: currentSchoolYearId(context) },
      },
      select: { id: true, _count: { select: { subscriptions: true } } },
    });
    if (!stop) return failure(t.errors.notFound);

    if (stop._count.subscriptions > 0)
      return failure(t.transport.stopHasRiders);

    await db.routeStop.delete({ where: { id: stopId } });

    refresh();
    return success(t.transport.stopDeleted);
  });
}

// ── Riders ───────────────────────────────────────────────────────────────────

export async function subscribeRiderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_SUBSCRIBE);

    // The runs the family boards, when the line declares any. Each one becomes
    // its own abonnement with its own direction — see `subscribeRiderToRuns`.
    // Only the shape is settled here; that a run belongs to this line, and to
    // this year, is checked against the database in the service.
    const scheduleIds = listField(formData, "scheduleIds").filter(
      (id) => id && id !== NO_SELECTION,
    );

    const parsed = subscriptionSchema(t).safeParse({
      enrollmentId: field(formData, "enrollmentId"),
      stopId: field(formData, "stopId"),
      // A form offering runs does not also ask which way the child is going —
      // each run answers that on its own, and two controls that can disagree is
      // one too many. The column still needs a shape to parse, and it is
      // replaced per run below.
      direction: field(formData, "direction") || "BOTH",
      status: field(formData, "status") || "ACTIVE",
      scheduleId: optionalId(formData, "scheduleId"),
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The pupil must be enrolled in this school, this year.
    const enrolment = await db.enrollment.findFirst({
      where: {
        id: parsed.data.enrollmentId,
        schoolYearId,
        student: { schoolId },
      },
      select: { id: true },
    });
    if (!enrolment) return failure(t.errors.notFound);

    // The stop must be on a line of this year.
    const stop = await db.routeStop.findFirst({
      where: { id: parsed.data.stopId, route: { schoolYearId } },
      select: { id: true },
    });
    if (!stop) return failure(t.errors.notFound);

    const base = {
      enrollmentId: enrolment.id,
      stopId: stop.id,
      status: parsed.data.status,
      startsOn: parsed.data.startsOn ?? new Date(),
      endsOn: parsed.data.endsOn,
      notes: parsed.data.notes,
    };

    if (scheduleIds.length > 0) {
      const runs = await subscribeRiderToRuns(base, scheduleIds);

      if (runs.created === 0) {
        // Nothing was taken, so the first reason is the whole story.
        switch (runs.refused[0]) {
          case "FULL":
            return failure(t.transport.routeFull);
          case "ALREADY_ON_BOARD":
            return failure(t.transport.alreadySubscribed);
          default:
            return failure(t.errors.notFound);
        }
      }

      refresh();
      return success(
        runs.refused.length > 0
          ? interpolate(t.transport.riderAddedPartly, {
              created: runs.created,
              refused: runs.refused.length,
            })
          : runs.repricedLines > 0
            ? interpolate(t.transport.riderAddedBilled, {
                count: runs.repricedLines,
              })
            : t.transport.riderAdded,
      );
    }

    // No runs declared on the line: the direction is asked for outright, and the
    // abonnement carries no horaire — see the note on
    // `TransportSubscription.scheduleId`.
    const result = await subscribeRider({
      ...base,
      direction: parsed.data.direction,
      scheduleId: null,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "FULL":
          return failure(t.transport.routeFull);
        case "ALREADY_ON_BOARD":
          return failure(t.transport.alreadySubscribed);
        case "STOP_UNREACHABLE":
          return failure(t.errors.notFound);
      }
    }

    refresh();
    return success(
      result.repricedLines > 0
        ? interpolate(t.transport.riderAddedBilled, {
            count: result.repricedLines,
          })
        : t.transport.riderAdded,
    );
  });
}

export async function updateRiderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_SUBSCRIBE);

    const subscriptionId = field(formData, "id");

    // Re-derived through the year and the school, never from the id alone.
    const existing = await db.transportSubscription.findFirst({
      where: {
        id: subscriptionId,
        enrollment: { schoolYearId, student: { schoolId } },
      },
      select: { id: true },
    });
    if (!existing) return failure(t.errors.notFound);

    const parsed = subscriptionSchema(t).safeParse({
      enrollmentId: field(formData, "enrollmentId") || "placeholder",
      stopId: field(formData, "stopId"),
      direction: field(formData, "direction"),
      status: field(formData, "status"),
      scheduleId: optionalId(formData, "scheduleId"),
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const stop = await db.routeStop.findFirst({
      where: { id: parsed.data.stopId, route: { schoolYearId } },
      select: { id: true },
    });
    if (!stop) return failure(t.errors.notFound);

    const result = await updateRider(existing.id, {
      stopId: stop.id,
      direction: parsed.data.direction,
      status: parsed.data.status,
      scheduleId: parsed.data.scheduleId,
      startsOn: parsed.data.startsOn ?? new Date(),
      endsOn: parsed.data.endsOn,
      notes: parsed.data.notes,
    });
    if (!result.ok) {
      return failure(
        result.reason === "ALREADY_ON_BOARD"
          ? t.transport.alreadySubscribed
          : t.errors.notFound,
      );
    }

    refresh();
    return success(t.transport.riderUpdated);
  });
}

export async function unsubscribeRiderAction(
  subscriptionId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_SUBSCRIBE);

    const existing = await db.transportSubscription.findFirst({
      where: {
        id: subscriptionId,
        enrollment: {
          schoolYearId: currentSchoolYearId(context),
          student: { schoolId },
        },
      },
      select: { id: true },
    });
    if (!existing) return failure(t.errors.notFound);

    const result = await unsubscribeRider(existing.id);
    if (!result) return failure(t.errors.notFound);

    refresh();
    return success(
      result.cancelledLines > 0
        ? interpolate(t.transport.riderRemovedBilled, {
            count: result.cancelledLines,
          })
        : t.transport.riderRemoved,
    );
  });
}

// ── What a circuit serves ────────────────────────────────────────────────────

/** Replaces the quartiers a circuit is declared to serve. */
export async function setRouteNeighbourhoodsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const route = await db.transportRoute.findFirst({
      where: { id: field(formData, "routeId"), schoolYearId },
      select: { id: true },
    });
    if (!route) return failure(t.errors.notFound);

    const count = await setRouteNeighbourhoods(
      route.id,
      schoolId,
      listField(formData, "neighbourhoodIds"),
    );

    refresh();
    return success(
      interpolate(t.transport.neighbourhoodsSaved, { count }),
    );
  });
}

/** Replaces the runs a circuit makes. */
export async function setRouteSchedulesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const route = await db.transportRoute.findFirst({
      where: { id: field(formData, "routeId"), schoolYearId },
      select: { id: true },
    });
    if (!route) return failure(t.errors.notFound);

    const count = await setRouteSchedules(
      route.id,
      schoolYearId,
      listField(formData, "scheduleIds"),
    );

    refresh();
    return success(interpolate(t.transport.schedulesSaved, { count }));
  });
}

// ── Consommation ─────────────────────────────────────────────────────────────

/**
 * Raises a fuel request, or edits one still pending.
 *
 * TRANSPORT_FUEL, not TRANSPORT_MANAGE: this is the driver's own permission,
 * and asking for fuel is not the same job as redrawing the lines. Nothing here
 * touches money — that happens only when somebody with the approving permission
 * decides it.
 */
export async function saveFuelRequestAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_FUEL);

    const parsed = fuelRequestSchema(t).safeParse({
      vehicleId: field(formData, "vehicleId"),
      requestedById: optionalId(formData, "requestedById"),
      requestedByName: field(formData, "requestedByName"),
      occurredOn: field(formData, "occurredOn"),
      litres: field(formData, "litres") || "0",
      odometerKm: field(formData, "odometerKm"),
      amount: field(formData, "amount") || "0",
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const vehicle = await db.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, schoolId },
      select: { id: true },
    });
    if (!vehicle) return failure(t.errors.notFound);

    // The driver, when one was named, must be this school's employee.
    const staff = parsed.data.requestedById
      ? await db.staff.findFirst({
          where: { id: parsed.data.requestedById, schoolId },
          select: { id: true },
        })
      : null;

    const data = {
      vehicleId: vehicle.id,
      requestedById: staff?.id ?? null,
      requestedByName: parsed.data.requestedByName,
      occurredOn: parsed.data.occurredOn ?? new Date(),
      litresTenths: parsed.data.litresTenths,
      odometerKm: parsed.data.odometerKm,
      amountCentimes: parsed.data.amountCentimes,
      notes: parsed.data.notes,
    };

    const requestId = field(formData, "id");

    if (requestId) {
      // Only while it is still pending: a decided request is the paper behind a
      // décaissement, and editing the litres under it would make the ledger lie.
      const updated = await db.fuelRequest.updateMany({
        where: { id: requestId, schoolId, status: "PENDING" },
        data,
      });
      if (updated.count === 0) return failure(t.transport.fuelAlreadyDecided);

      refresh();
      return success(t.transport.fuelRequestUpdated);
    }

    await db.fuelRequest.create({ data: { ...data, schoolId } });

    refresh();
    return success(t.transport.fuelRequestCreated);
  });
}

/**
 * Approves or refuses a request — and, when it is approved, posts the money.
 *
 * The separate permission is the point: whoever is at the pump does not get to
 * agree to their own spend. See modules/transport/permissions.ts.
 */
export async function decideFuelRequestAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_FUEL_APPROVE);

    const parsed = fuelDecisionSchema(t).safeParse({
      status: field(formData, "status"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }
    if (parsed.data.status === "PENDING") {
      return failure(t.errors.invalid);
    }

    // The rubrique and the open till, both re-derived against this school.
    const categoryId = optionalId(formData, "categoryId");
    const category = categoryId
      ? await db.operationCategory.findFirst({
          where: { id: categoryId, schoolId, kind: { in: ["OUT", "BOTH"] } },
          select: { id: true },
        })
      : null;

    const session = await db.cashSession.findFirst({
      where: { status: "OPEN", cashRegister: { schoolId } },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });

    const result = await decideFuelRequest({
      requestId: field(formData, "id"),
      schoolId,
      status: parsed.data.status,
      decidedById: context.user.id,
      cashSessionId: session?.id ?? null,
      categoryId: category?.id ?? null,
      notes: parsed.data.notes,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "ALREADY_DECIDED":
          return failure(t.transport.fuelAlreadyDecided);
        case "NOTHING_TO_PAY":
          return failure(t.transport.fuelNothingToPay);
        case "NOT_FOUND":
          return failure(t.errors.notFound);
      }
    }

    refresh();
    return success(
      result.operationId
        ? t.transport.fuelApprovedPosted
        : t.transport.fuelRejected,
    );
  });
}

export async function deleteFuelRequestAction(
  requestId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_FUEL_APPROVE);

    // Only a pending request may be withdrawn. A decided one has a movement
    // behind it and is history — cancel that in the caisse instead.
    const deleted = await db.fuelRequest.deleteMany({
      where: { id: requestId, schoolId, status: "PENDING" },
    });
    if (deleted.count === 0) return failure(t.transport.fuelAlreadyDecided);

    refresh();
    return success(t.transport.fuelRequestDeleted);
  });
}

// ── L'appel du bus ───────────────────────────────────────────────────────────

/**
 * Re-derives a run from the request, against the year in context.
 *
 * The driver's sheet posts a route and a schedule; neither is trusted. The line
 * must belong to this year, and the run must be one that line actually makes —
 * otherwise a crafted pair would write a register against children on another
 * bus. Returns null when either check fails.
 */
async function reachableRun(
  schoolYearId: string,
  routeId: string,
  scheduleId: string,
): Promise<{ routeId: string; scheduleId: string | null } | null> {
  const route = await db.transportRoute.findFirst({
    where: { id: routeId, schoolYearId },
    select: { id: true },
  });
  if (!route) return null;

  if (!scheduleId) return { routeId: route.id, scheduleId: null };

  const link = await db.routeSchedule.findUnique({
    where: { routeId_scheduleId: { routeId: route.id, scheduleId } },
    select: { scheduleId: true },
  });
  if (!link) return null;

  return { routeId: route.id, scheduleId: link.scheduleId };
}

/** Marks one rider on one run. */
export async function markRiderAttendanceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_ATTENDANCE);

    const parsed = riderAttendanceSchema(t).safeParse({
      subscriptionId: field(formData, "subscriptionId"),
      routeId: field(formData, "routeId"),
      scheduleId: optionalId(formData, "scheduleId"),
      date: field(formData, "date"),
      status: field(formData, "status"),
      minutesLate: field(formData, "minutesLate") || "0",
      isJustified: boolField(formData, "isJustified"),
      reason: field(formData, "reason"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const run = await reachableRun(
      schoolYearId,
      parsed.data.routeId,
      parsed.data.scheduleId ?? "",
    );
    if (!run) return failure(t.errors.notFound);

    // The rider must be on that very line, this school, this year.
    const subscription = await db.transportSubscription.findFirst({
      where: {
        id: parsed.data.subscriptionId,
        routeId: run.routeId,
        enrollment: { schoolYearId, student: { schoolId } },
      },
      select: { id: true },
    });
    if (!subscription) return failure(t.errors.notFound);

    await markRiderAttendance({
      subscriptionId: subscription.id,
      scheduleId: run.scheduleId,
      date: startOfDay(parsed.data.date),
      status: parsed.data.status,
      minutesLate: parsed.data.minutesLate,
      isJustified: parsed.data.isJustified,
      reason: parsed.data.reason,
      recordedById: context.user.id,
    });

    refresh();
    return success(t.transport.riderMarked);
  });
}

/** The "everyone else got on" button at the foot of the sheet. */
export async function markBusRunInBulkAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_ATTENDANCE);

    const parsed = riderAttendanceSchema(t).safeParse({
      // The bulk sheet marks a run, not one child, so the schema's
      // subscriptionId is satisfied with a placeholder and the real ids are
      // re-derived from the line below.
      subscriptionId: "bulk",
      routeId: field(formData, "routeId"),
      scheduleId: optionalId(formData, "scheduleId"),
      date: field(formData, "date"),
      status: field(formData, "status"),
      minutesLate: "0",
      isJustified: false,
      reason: "",
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const run = await reachableRun(
      schoolYearId,
      parsed.data.routeId,
      parsed.data.scheduleId ?? "",
    );
    if (!run) return failure(t.errors.notFound);

    const requested = listField(formData, "subscriptionIds");
    const reachable = await db.transportSubscription.findMany({
      where: {
        id: { in: requested },
        routeId: run.routeId,
        status: "ACTIVE",
        enrollment: { schoolYearId, student: { schoolId } },
      },
      select: { id: true },
    });
    if (reachable.length === 0) return failure(t.transport.nothingToMark);

    const written = await markBusRunInBulk({
      subscriptionIds: reachable.map((row) => row.id),
      scheduleId: run.scheduleId,
      date: startOfDay(parsed.data.date),
      status: parsed.data.status,
      recordedById: context.user.id,
    });

    refresh();
    return success(
      written > 0
        ? interpolate(t.transport.bulkMarked, { count: written })
        : t.transport.nothingToMark,
    );
  });
}

// ── Le voyage ────────────────────────────────────────────────────────────────

/**
 * Re-derives a run from the year in context.
 *
 * The id arrives in the request, so it is never enough on its own: the run has
 * to hang off a circuit of *this* school's year before anything is written to
 * it. Same rule as `reachableRun` above, and the reason a crafted id reaches
 * nothing rather than another school's morning.
 */
async function reachableTripRun(
  schoolYearId: string,
  runId: string,
): Promise<{ id: string; date: Date; plannedDepartureTime: string } | null> {
  return db.tripRun.findFirst({
    where: { id: runId, route: { schoolYearId } },
    select: { id: true, date: true, plannedDepartureTime: true },
  });
}

/**
 * Starts a voyage, closes it, or calls it off.
 *
 * One action for the three moves rather than three, because they differ only in
 * which stamp they write and they share every check: the same permission, the
 * same re-derivation, and the same transition table underneath. Which move is
 * legal from where the run actually stands is decided in `moveTripRun`, inside
 * the transaction that performs it.
 *
 * Behind TRANSPORT_ATTENDANCE, which the module already describes as the
 * driver's and the accompagnateur's code: starting the bus and marking who
 * boarded are the same person's shift. Cancelling asks for TRANSPORT_MANAGE on
 * top — striking a run off the day is a supervisory act, and it is the one that
 * leaves a gap somebody will be asked about.
 *
 * ── Who may move a run outside its hour ─────────────────────────────────────
 * A crew member may only start or close a voyage around its own departure —
 * `tripRunWindow`, the same rule the phone is held to, because /transport
 * /mon-voyage is that same screen in a browser and a rule enforced on one and
 * not the other is not a rule.
 *
 * The office is not: a secrétaire recording at four o'clock that the morning
 * bus went out is making a correction, not a departure, and somebody has to be
 * able to. TRANSPORT_MANAGE is what separates them — derived from the session
 * rather than passed in, since a flag in the request would let the caller
 * choose which rules apply to it.
 */
export async function moveTripRunAction(
  runId: string,
  next: "EN_ROUTE" | "ARRIVED" | "CANCELLED",
  cancelReason?: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_ATTENDANCE);
    if (next === "CANCELLED") {
      await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);
    }

    const run = await reachableTripRun(schoolYearId, runId);
    if (!run) return failure(t.errors.notFound);

    // A run struck off with no reason is the gap nobody can explain in June.
    const reason = (cancelReason ?? "").trim();
    if (next === "CANCELLED" && reason.length < 3) {
      return failure(t.transport.cancelRunReasonRequired);
    }

    // Re-derived from what the account holds, never from the form.
    const withinWindow = !context.can(PERMISSIONS.TRANSPORT_MANAGE);

    // Checked here only to say *why* — `moveTripRun` refuses on its own, inside
    // the transaction, whatever this reads.
    if (
      withinWindow &&
      tripRunWindow(run.date, run.plannedDepartureTime, new Date()) !== "OPEN"
    ) {
      return failure(t.transport.runNotItsHour);
    }

    const moved = await moveTripRun(run.id, next, context.user.id, {
      cancelReason: next === "CANCELLED" ? reason : undefined,
      withinWindow,
    });
    // False means the run had already moved on — somebody else pressed first,
    // which is a message rather than an error.
    if (!moved) return failure(t.transport.runAlreadyMoved);

    refresh();
    return success(
      next === "EN_ROUTE"
        ? t.transport.runStarted
        : next === "ARRIVED"
          ? t.transport.runArrived
          : t.transport.runCancelled,
    );
  });
}
