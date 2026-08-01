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
import { startOfDay } from "@/modules/hr/enums";
import {
  decideFuelRequest,
  markBusRunInBulk,
  markRiderAttendance,
  setRouteNeighbourhoods,
  setRouteSchedules,
  subscribeRider,
  unsubscribeRider,
  updateRider,
} from "@/modules/transport/service";
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

    // The driver must be one of this school's employees — a staff id from the
    // request must never reach another school's payroll.
    const driver = parsed.data.driverId
      ? await db.staff.findFirst({
          where: { id: parsed.data.driverId, schoolId },
          select: { id: true },
        })
      : null;
    if (parsed.data.driverId && !driver) return failure(t.errors.notFound);

    const data = { ...parsed.data, driverId: driver?.id ?? null, schoolId };

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
        schoolYearId: context.currentSchoolYear?.id ?? "__none__",
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
        route: { schoolYearId: context.currentSchoolYear?.id ?? "__none__" },
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

    const parsed = subscriptionSchema(t).safeParse({
      enrollmentId: field(formData, "enrollmentId"),
      stopId: field(formData, "stopId"),
      direction: field(formData, "direction"),
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

    const result = await subscribeRider({
      enrollmentId: enrolment.id,
      stopId: stop.id,
      direction: parsed.data.direction,
      status: parsed.data.status,
      // Checked against the line inside the service — see `resolveSchedule`.
      scheduleId: parsed.data.scheduleId,
      startsOn: parsed.data.startsOn ?? new Date(),
      endsOn: parsed.data.endsOn,
      notes: parsed.data.notes,
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
    if (!result.ok) return failure(t.errors.notFound);

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
          schoolYearId: context.currentSchoolYear?.id ?? "__none__",
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
