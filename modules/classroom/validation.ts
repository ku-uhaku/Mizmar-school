import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  dateField,
  enumField,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  REMARK_KINDS,
  REMARK_MAX_LENGTH,
  REMARK_TONES,
} from "@/modules/classroom/enums";

/** Built per-request from the dictionary so messages come back localised. */

export function remarkSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    enrollmentId: requiredText(v, { max: 40 }),
    subjectId: optionalText(40),
    kind: enumField(REMARK_KINDS, v),
    tone: enumField(REMARK_TONES, v),
    body: requiredText(v, { min: 3, max: REMARK_MAX_LENGTH }),
    occurredOn: dateField(v),
  });
}

/** The devoir a teacher sets for their own class. */
export function devoirSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    subjectId: requiredText(v, { max: 40 }),
    termId: requiredText(v, { max: 40 }),
    assessmentTypeId: requiredText(v, { max: 40 }),
    title: requiredText(v, { max: 160 }),
    scheduledOn: dateField(v),
    maxScore: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(100, { error: v.invalidNumber }),
    coefficient: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(20, { error: v.invalidNumber }),
  });
}
