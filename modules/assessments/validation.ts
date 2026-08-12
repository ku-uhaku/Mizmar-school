import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  enumField,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  APPRECIATION_LABEL_MAX,
  ASSESSMENT_STATUSES,
  GENERATE_SCOPES,
  MAX_SEQUENCE,
  NOTES_MAX,
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
    /** "CLASS" | "LEVEL" | "YEAR" — see modules/assessments/enums.ts. */
    scope: enumField(GENERATE_SCOPES, v),
    /** Required for CLASS, ignored otherwise — the action decides which. */
    schoolClassId: optionalText(40),
    /** Required for LEVEL, ignored otherwise. */
    levelOfferingId: optionalText(40),
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
    notes: optionalText(NOTES_MAX),
  });
}

export function statusSchema(t: Dictionary) {
  return z.object({ status: enumField(ASSESSMENT_STATUSES, t.validation) });
}

/**
 * One rung of the appréciation scale, as the editing screen posts it.
 *
 * The floor is typed as a percentage because that is how a school talks about
 * it — "à partir de 90%" — and stored in basis points, which is the same trick
 * `percent` fields use elsewhere. Halves are accepted (87,5%) since a scale of
 * five rungs over 20 marks does not divide into whole percents.
 */
export function appreciationBandSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    minPercent: z.coerce
      .number({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(100, { error: v.invalidNumber }),
    label: requiredText(v, { max: APPRECIATION_LABEL_MAX }),
    labelAr: optionalText(APPRECIATION_LABEL_MAX),
    colorHex: optionalText(9),
    isActive: z.boolean(),
  });
}
