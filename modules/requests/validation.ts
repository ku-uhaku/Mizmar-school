import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  enumField,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  MAX_COPIES,
  OFFICE_NOTE_MAX,
  REASON_MAX,
  REQUEST_STATUSES,
} from "@/modules/requests/enums";

/** Built per-request from the dictionary so messages come back localised. */

/**
 * A family filing a request, from the phone.
 *
 * Shape only. Whether the pupil is theirs and whether the type belongs to that
 * pupil's school are questions a form can never answer, so
 * `modules/requests/service.ts` re-derives both against the household before
 * writing anything. `requiresReason` is likewise enforced there, where the type
 * row is actually in hand.
 */
export function requestSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    studentId: requiredText(v, { max: 40 }),
    typeId: requiredText(v, { max: 40 }),
    copies: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(MAX_COPIES, { error: v.invalidNumber }),
    reason: optionalText(REASON_MAX),
  });
}

/**
 * The office answering one.
 *
 * `readyAt` is optional at this level because only one move requires it —
 * accepting. The service refuses an ACCEPTED without a date rather than the
 * schema doing it, so the rule lives next to the workflow table that says which
 * moves exist at all.
 */
export function handleSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    status: enumField(REQUEST_STATUSES, v),
    readyAt: optionalDate(v),
    officeNote: optionalText(OFFICE_NOTE_MAX),
  });
}
