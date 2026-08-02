import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField, optionalText, requiredText } from "@/lib/validation";
import { BPS_FULL } from "@/modules/billing/enums";
import {
  ENROLMENT_STATUSES,
  FEE_LINE_STATUSES,
} from "@/modules/enrolment/enums";

/** Built per-request from the dictionary so messages are localised. */
export function enrolmentSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    studentId: requiredText(v, { max: 40 }),
    levelOfferingId: requiredText(v, { max: 40 }),
    schoolClassId: optionalText(40),
    classGroupId: optionalText(40),
    status: enumField(ENROLMENT_STATUSES, v),
    enrolledOn: optionalText(40),
    isRepeating: z.boolean(),
    usesTransport: z.boolean(),
    usesCanteen: z.boolean(),
    // `YYYY-MM`, or blank for "from the start of the year". Only the shape is
    // checked here; whether the month falls inside the school year is a fact
    // about the year and is settled by `resolveOptionStart`.
    transportStartsOn: optionalText(7),
    canteenStartsOn: optionalText(7),
    notes: optionalText(1000),
  });
}

/**
 * One cell of the fee grid.
 *
 * Amounts arrive in **dirhams** because that is what a bursar types, and are
 * turned into centimes here — the one conversion point on the way in, matching
 * `centimesToDirhams` on the way out.
 */
export function feeLineSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      baseAmount: z.coerce
        .number({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(10_000_000, { error: v.invalidNumber }),
      /** Whole percent in the form; basis points in the column. */
      discountPercent: z.coerce
        .number({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(100, { error: v.invalidNumber }),
      discountAmount: z.coerce
        .number({ error: v.invalidNumber })
        .min(0, { error: v.invalidNumber })
        .max(10_000_000, { error: v.invalidNumber }),
      discountId: optionalText(40),
      status: enumField(FEE_LINE_STATUSES, v),
      notes: optionalText(500),
    })
    .transform((data) => ({
      baseAmountCentimes: Math.round(data.baseAmount * 100),
      discountBps: Math.min(BPS_FULL, Math.round(data.discountPercent * 100)),
      discountCentimes: Math.round(data.discountAmount * 100),
      discountId: data.discountId,
      status: data.status,
      notes: data.notes,
    }))
    .refine(
      (data) =>
        // A flat reduction larger than the charge is a slip, not a credit note —
        // `netAmount` would floor it at zero and the bursar would never know.
        data.discountCentimes <= data.baseAmountCentimes,
      { error: t.enrolment.discountTooLarge, path: ["discountAmount"] },
    );
}
