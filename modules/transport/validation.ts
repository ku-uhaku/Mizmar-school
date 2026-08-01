import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  enumField,
  optionalDate,
  optionalPositiveInt,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  SUBSCRIPTION_STATUSES,
  TRANSPORT_DIRECTIONS,
  VEHICLE_STATUSES,
  isTimeOfDay,
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
    notes: optionalText(1000),
  });
}

export function zoneSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      code: requiredText(v, { max: 20 }),
      name: requiredText(v, { max: 120 }),
      nameAr: optionalText(120),
      /** Typed in dirhams, stored in centimes — the one conversion on the way in. */
      amount: z.coerce
        .number({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(1_000_000, { error: v.invalidNumber }),
      position: z.coerce.number({ error: v.invalidNumber }).int().min(0).max(999),
      isActive: z.boolean(),
    })
    .transform((data) => ({
      ...data,
      amountCentimes: Math.round(data.amount * 100),
    }));
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
    zoneId: optionalText(40),
    position: z.coerce.number({ error: v.invalidNumber }).int().min(0).max(999),
    pickupTime: timeField(t),
    dropoffTime: timeField(t),
  });
}

/**
 * An abonnement.
 *
 * The zone is deliberately absent: it comes from the stop, so that two families
 * boarding at the same corner cannot be priced differently. See the note on
 * RouteStop.
 */
export function subscriptionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    enrollmentId: requiredText(v, { max: 40 }),
    stopId: requiredText(v, { max: 40 }),
    direction: enumField(TRANSPORT_DIRECTIONS, v),
    status: enumField(SUBSCRIPTION_STATUSES, v),
    startsOn: optionalDate(v),
    endsOn: optionalDate(v),
    notes: optionalText(1000),
  });
}
