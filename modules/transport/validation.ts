import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  dateField,
  enumField,
  optionalDate,
  optionalPositiveInt,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  FUEL_REQUEST_STATUSES,
  MAX_MINUTES_WAITED,
  RIDER_ATTENDANCE_STATUSES,
  SUBSCRIPTION_STATUSES,
  TRANSPORT_DIRECTIONS,
  VEHICLE_STATUSES,
  isTimeOfDay,
  litresToTenths,
} from "@/modules/transport/enums";

/** Built per-request from the dictionary so messages come back localised. */

/** `HH:MM`, blank-able. Stored as text — see the note on RouteStop.pickupTime. */
function timeField(t: Dictionary) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine((value) => value === null || isTimeOfDay(value), {
      error: t.transport.invalidTime,
    });
}

export function vehicleSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    registration: requiredText(v, { max: 40 }),
    make: optionalText(60),
    model: optionalText(60),
    modelYear: optionalPositiveInt(v),
    seatCount: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(120, { error: v.invalidNumber }),
    status: enumField(VEHICLE_STATUSES, v),
    insuranceExpiresOn: optionalDate(v),
    inspectionExpiresOn: optionalDate(v),
    /** The employee driving it, when they are on the school's payroll. */
    driverId: optionalText(40),
    driverName: optionalText(120),
    driverPhone: optionalText(40),
    /** L'accompagnateur, by the same rule. See Vehicle.attendantId. */
    attendantId: optionalText(40),
    attendantName: optionalText(120),
    attendantPhone: optionalText(40),
    notes: optionalText(1000),
  });
}

export function routeSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    code: requiredText(v, { max: 20 }),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    direction: enumField(TRANSPORT_DIRECTIONS, v),
    vehicleId: optionalText(40),
    capacity: optionalPositiveInt(v),
    isActive: z.boolean(),
    notes: optionalText(1000),
  });
}

export function stopSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    routeId: requiredText(v, { max: 40 }),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    landmark: optionalText(160),
    neighbourhoodId: optionalText(40),
    position: z.coerce.number({ error: v.invalidNumber }).int().min(0).max(999),
    pickupTime: timeField(t),
    dropoffTime: timeField(t),
  });
}

/**
 * An abonnement.
 *
 * Nothing here is a price. Transport is billed from the price list at
 * enrolment; putting a child on a circuit never rewrites an échéancier.
 */
export function subscriptionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    enrollmentId: requiredText(v, { max: 40 }),
    stopId: requiredText(v, { max: 40 }),
    direction: enumField(TRANSPORT_DIRECTIONS, v),
    status: enumField(SUBSCRIPTION_STATUSES, v),
    /**
     * Which run they board. Optional, like the column: a line that makes one
     * run needs no answer. Never trusted — `subscribeRider` re-derives whether
     * the circuit actually makes it.
     */
    scheduleId: optionalText(40),
    startsOn: optionalDate(v),
    endsOn: optionalDate(v),
    notes: optionalText(1000),
  });
}

/**
 * A demande de consommation.
 *
 * Litres and dirhams are typed as decimals and stored as integers — tenths and
 * centimes — and this is the one place either conversion happens on the way in.
 */
export function fuelRequestSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      vehicleId: requiredText(v, { max: 40 }),
      /** The employee at the pump, when they are on the payroll. */
      requestedById: optionalText(40),
      requestedByName: optionalText(120),
      occurredOn: optionalDate(v),
      litres: z.coerce
        .number({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(2000, { error: v.invalidNumber }),
      odometerKm: optionalPositiveInt(v),
      amount: z.coerce
        .number({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(1_000_000, { error: v.invalidNumber }),
      notes: optionalText(1000),
    })
    .transform((data) => ({
      ...data,
      litresTenths: litresToTenths(data.litres),
      amountCentimes: Math.round(data.amount * 100),
    }));
}

/** The approve/reject decision. Its own schema — it shares no field with the ask. */
export function fuelDecisionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    status: enumField(FUEL_REQUEST_STATUSES, v),
    notes: optionalText(1000),
  });
}

/**
 * One mark on the bus register.
 *
 * The route travels with the mark so the action can re-derive that the rider is
 * actually on that line — the sheet is posted from a driver's phone and nothing
 * on it is trusted.
 */
export function riderAttendanceSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    subscriptionId: requiredText(v, { max: 40 }),
    routeId: requiredText(v, { max: 40 }),
    scheduleId: optionalText(40),
    date: dateField(v),
    status: enumField(RIDER_ATTENDANCE_STATUSES, v),
    /** Only meaningful on a LATE; the service clears it for every other status. */
    minutesLate: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(MAX_MINUTES_WAITED, { error: v.invalidNumber }),
    isJustified: z.boolean(),
    reason: optionalText(300),
  });
}
