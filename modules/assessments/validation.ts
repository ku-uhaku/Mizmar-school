import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  enumField,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  ASSESSMENT_STATUSES,
  MAX_SEQUENCE,
} from "@/modules/assessments/enums";

/** Built per-request from the dictionary so messages come back localised. */

/** Which paper of its kind within the term — 1-based, and bounded. */
function sequenceField(t: Dictionary) {
  const v = t.validation;
  return z.coerce
    .number({ error: v.invalidNumber })
    .int({ error: v.invalidNumber })
    .min(1, { error: v.invalidNumber })
    .max(MAX_SEQUENCE, { error: v.invalidNumber });
}

/** What a whole batch of contrôles is generated from. */
export function generateSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    termId: requiredText(v, { max: 40 }),
    assessmentTypeId: requiredText(v, { max: 40 }),
    sequence: sequenceField(t),
    scheduledOn: optionalDate(v),
  });
}

/** One paper, edited by hand rather than generated. */
export function assessmentSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    title: requiredText(v, { max: 160 }),
    sequence: sequenceField(t),
    scheduledOn: optionalDate(v),
    maxScore: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      // A paper marked out of nothing cannot be scored, and one out of more
      // than 100 is a data-entry slip rather than a grading scale.
      .min(1, { error: v.invalidNumber })
      .max(100, { error: v.invalidNumber }),
    coefficient: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(20, { error: v.invalidNumber }),
    notes: optionalText(500),
  });
}

export function statusSchema(t: Dictionary) {
  return z.object({ status: enumField(ASSESSMENT_STATUSES, t.validation) });
}
