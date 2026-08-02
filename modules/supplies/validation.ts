import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField, optionalText, requiredText } from "@/lib/validation";
import { SUPPLY_STATUSES } from "@/modules/supplies/enums";

/** Built per-request from the dictionary so messages come back localised. */

/**
 * A list's own details. The items travel separately — see `supplyItemsSchema`.
 *
 * `status` is deliberately absent: it is moved by the review action under its
 * own permission, and accepting it here would let a teacher approve their own
 * list with a crafted POST.
 */
export function supplyListSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    subjectId: optionalText(40),
    title: requiredText(v, { max: 160 }),
    notes: optionalText(1000),
  });
}

/**
 * One line. Parsed per row rather than as a whole list, so a single bad
 * quantity names its own line instead of rejecting twenty good ones.
 *
 * The wording is deliberately not here: a line names a catalogue article and
 * the label is resolved from it server-side — see `replaceItems`. Accepting a
 * label from the form would let a crafted POST put any text on a list under
 * cover of the catalogue.
 */
export function supplyItemSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    articleId: requiredText(v, { max: 40 }),
    quantity: z
      .union([z.literal(""), z.coerce.number({ error: v.invalidNumber })])
      .transform((value) => (value === "" ? null : Number(value)))
      .nullable()
      // A hundred of anything is a typo, and nought of something is not a line.
      .refine(
        (value) =>
          value === null || (Number.isInteger(value) && value >= 1 && value <= 100),
        { error: v.invalidNumber },
      ),
    notes: optionalText(200),
    isRequired: z.boolean(),
  });
}

/** The office's decision. */
export function supplyReviewSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    id: requiredText(v, { max: 40 }),
    status: enumField(SUPPLY_STATUSES, v),
    reviewNote: optionalText(500),
  });
}
