"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import {
  repriceZone,
  subscribeRider,
  unsubscribeRider,
  updateRider,
} from "@/modules/transport/service";
import {
  routeSchema,
  stopSchema,
  subscriptionSchema,
  vehicleSchema,
  zoneSchema,
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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
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
    return success(id ? t.transport.vehicleUpdated : t.transport.vehicleCreated);
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

// ── Zones ────────────────────────────────────────────────────────────────────

export async function saveZoneAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TRANSPORT_MANAGE);

    const parsed = zoneSchema(t).safeParse({
      code: field(formData, "code"),
      name: field(formData, "name"),
      nameAr: field(formData, "nameAr"),
      amount: field(formData, "amount"),
      position: field(formData, "position") || "0",
      isActive: boolField(formData, "isActive"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const id = field(formData, "id");
    if (id) {
      const existing = await db.transportZone.findFirst({
        where: { id, schoolYearId },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);
    }

    const clash = await db.transportZone.findFirst({
      where: {
        schoolYearId,
        code: parsed.data.code,
        ...(id ? { NOT: { id } } : {}),
      },
      select: { id: true },
    });
    if (clash) return failure(t.transport.zoneCodeTaken);

    const data = {
      schoolYearId,
      code: parsed.data.code,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      amountCentimes: parsed.data.amountCentimes,
      position: parsed.data.position,
      isActive: parsed.data.isActive,
    };

    const zone = id
      ? await db.transportZone.update({ where: { id }, data, select: { id: true } })
      : await db.transportZone.create({ data, select: { id: true } });

    // A price change is expected to reach the families riding from it — see
    // `repriceZone`.
    const repriced = id ? await repriceZone(zone.id) : 0;

    refresh();
    return success(
      repriced > 0
        ? interpolate(t.transport.zoneRepriced, { count: repriced })
        : t.transport.zoneSaved,
    );
  });
}

// ── Lines ────────────────────────────────────────────────────────────────────

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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
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
      where: { id: routeId, schoolYearId: context.currentSchoolYear?.id ?? "__none__" },
      select: { id: true, _count: { select: { subscriptions: true } } },
    });
    if (!route) return failure(t.errors.notFound);

    // Restrict on the subscription would throw; saying so is better than a 500.
    if (route._count.subscriptions > 0) return failure(t.transport.routeHasRiders);

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
      zoneId: optionalId(formData, "zoneId"),
      position: field(formData, "position") || "0",
      pickupTime: field(formData, "pickupTime"),
      dropoffTime: field(formData, "dropoffTime"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // The line must be one of this year's.
    const route = await db.transportRoute.findFirst({
      where: { id: parsed.data.routeId, schoolYearId },
      select: { id: true },
    });
    if (!route) return failure(t.errors.notFound);

    const zone = parsed.data.zoneId
      ? await db.transportZone.findFirst({
          where: { id: parsed.data.zoneId, schoolYearId },
          select: { id: true },
        })
      : null;
    if (parsed.data.zoneId && !zone) return failure(t.errors.notFound);

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
      zoneId: zone?.id ?? null,
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

    if (stop._count.subscriptions > 0) return failure(t.transport.stopHasRiders);

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
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
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
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
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
