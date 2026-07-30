import * as z from "zod";

import { interpolate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Zod schemas are built per-request from the active dictionary so validation
 * messages come back in the user's language. Every schema module exports a
 * factory that takes the dictionary rather than a ready-made schema.
 */
export type V = Dictionary["validation"];

export const PASSWORD_MIN_LENGTH = 8;

/** Trims, then treats "" as undefined — HTML forms send empty strings. */
export function optionalText(max = 200) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();
}

export function requiredText(v: V, { min = 1, max = 200 } = {}) {
  return z
    .string({ error: v.required })
    .trim()
    .min(min, {
      error: min === 1 ? v.required : interpolate(v.tooShort, { min }),
    })
    .max(max, { error: interpolate(v.tooLong, { max }) });
}

export function optionalEmail(v: V) {
  return z
    .union([z.literal(""), z.email({ error: v.email })])
    .transform((value) => (value === "" ? null : value.toLowerCase()))
    .nullable();
}

export function optionalUrl(v: V) {
  return z
    .union([z.literal(""), z.url({ error: v.url })])
    .transform((value) => (value === "" ? null : value))
    .nullable();
}

/** `<input type="number">` sends "" when cleared and a string otherwise. */
export function optionalPositiveInt(v: V) {
  return z
    .union([z.literal(""), z.coerce.number({ error: v.invalidNumber })])
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0), {
      error: v.invalidNumber,
    });
}

/**
 * ISO 3166-1 alpha-2. Non-nullable in the schema (it has a default), so a blank
 * input falls back rather than becoming null.
 */
export function countryField(v: V, fallback = "MA") {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? fallback : value.toUpperCase()))
    .refine((value) => /^[A-Z]{2}$/.test(value), { error: v.invalidChoice });
}

export function dateField(v: V) {
  return z.coerce.date({ error: v.invalidDate });
}

/** Blank-able `<input type="date">`. */
export function optionalDate(v: V) {
  return z
    .union([z.literal(""), z.coerce.date({ error: v.invalidDate })])
    .transform((value) => (value === "" ? null : (value as Date)))
    .nullable();
}

/**
 * A birth date: optional, but never in the future and never absurdly far back.
 * Both bounds are data-entry guards, not policy — staff of any age are allowed.
 */
export function birthDateField(v: V) {
  return optionalDate(v).refine(
    (value) =>
      value === null ||
      (value <= new Date() && value >= new Date("1900-01-01")),
    { error: v.invalidDate },
  );
}

export function enumField<T extends readonly [string, ...string[]]>(
  values: T,
  v: V,
) {
  return z.enum(values, { error: v.invalidChoice });
}

export function password(v: V) {
  return z.string().min(PASSWORD_MIN_LENGTH, {
    error: interpolate(v.passwordTooShort, { min: PASSWORD_MIN_LENGTH }),
  });
}

/**
 * Flattens a ZodError into the `{ field: message }` shape the form components
 * render. Only the first message per field is kept — that is all the UI shows.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
