import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { interpolate } from "@/lib/i18n/format";
import type { FieldDef, ResourceDef } from "@/modules/configuration/types";

/**
 * Builds a zod schema from a resource's field descriptors.
 *
 * The same descriptors drive the form, so the client and the server can never
 * disagree about what a field accepts — but the server still validates from
 * scratch, because the form is only a suggestion to anyone posting directly.
 *
 * Built per request from the dictionary, like every other schema in the app, so
 * messages come back in the user's language.
 */

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();
}

function fieldSchema(field: FieldDef, t: Dictionary): z.ZodTypeAny {
  const v = t.validation;
  const max = field.maxLength ?? 200;

  switch (field.type) {
    case "text":
    case "textarea":
      return field.required
        ? z
            .string({ error: v.required })
            .trim()
            .min(1, { error: v.required })
            .max(max, { error: interpolate(v.tooLong, { max }) })
        : optionalText(max);

    case "color":
      return z
        .union([
          z.literal(""),
          z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: v.invalidChoice }),
        ])
        .transform((value) => (value === "" ? null : value))
        .nullable();

    case "time":
      return field.required
        ? z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { error: v.invalidChoice })
        : z
            .union([
              z.literal(""),
              z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { error: v.invalidChoice }),
            ])
            .transform((value) => (value === "" ? null : value))
            .nullable();

    case "date":
      return field.required
        ? z.coerce.date({ error: v.invalidDate })
        : z
            .union([z.literal(""), z.coerce.date({ error: v.invalidDate })])
            .transform((value) => (value === "" ? null : (value as Date)))
            .nullable();

    case "number":
    case "money": {
      // Money arrives in dirhams and is stored in centimes — the conversion
      // happens here so no caller can forget it.
      const toStored = (value: number) =>
        field.type === "money" ? Math.round(value * 100) : value;

      const bounded = (value: number) => {
        if (field.min !== undefined && value < toStored(field.min)) return false;
        if (field.max !== undefined && value > toStored(field.max)) return false;
        return true;
      };

      const base = z.coerce
        .number({ error: v.invalidNumber })
        .transform(toStored)
        .refine((value) => Number.isFinite(value) && bounded(value), {
          error: v.invalidNumber,
        });

      return field.required
        ? base
        : z
            .union([z.literal(""), base])
            .transform((value) => (value === "" ? null : (value as number)))
            .nullable();
    }

    case "boolean":
      return z.boolean();

    case "select": {
      const options = (field.options ?? []) as string[];
      const base = z.string().refine((value) => options.includes(value), {
        error: v.invalidChoice,
      });
      return field.required
        ? base
        : z
            .union([z.literal(""), base])
            .transform((value) => (value === "" ? null : value))
            .nullable();
    }

    case "reference":
      // Existence and reachability are checked separately, against the current
      // context — see findUnreachableReference in queries.ts.
      return field.required
        ? z.string({ error: v.required }).min(1, { error: v.required })
        : z
            .string()
            .transform((value) =>
              value === "" || value === "none" ? null : value,
            )
            .nullable();
  }
}

export function resourceSchemaFor(resource: ResourceDef, t: Dictionary) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of resource.fields) {
    shape[field.name] = fieldSchema(field, t);
  }
  return z.object(shape);
}

/**
 * Reads a resource's fields out of FormData, in the shape its zod schema wants.
 * Checkboxes are absent when unchecked, which is why booleans are read by
 * presence rather than by value.
 */
export function readResourceForm(
  resource: ResourceDef,
  formData: FormData,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of resource.fields) {
    if (field.type === "boolean") {
      const raw = formData.get(field.name);
      values[field.name] = raw === "on" || raw === "true" || raw === "1";
      continue;
    }

    const raw = formData.get(field.name);
    values[field.name] = typeof raw === "string" ? raw.trim() : "";
  }

  return values;
}

/**
 * Columns that are integers in the database but arrive as strings from a
 * `<select>` — `TimeSlot.dayOfWeek` is the only one today.
 */
export function coerceIntegerSelects(
  resource: ResourceDef,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (resource.id !== "time-slots") return values;
  return { ...values, dayOfWeek: Number(values.dayOfWeek) };
}
