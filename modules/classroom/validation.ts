import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  dateField,
  enumField,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  MAX_QUESTIONS,
  QUESTION_MAX_LENGTH,
} from "@/modules/assessments/enums";
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

/**
 * One question of the paper.
 *
 * Points come off a number input, so they arrive as text and may be blank. A
 * question worth nothing is refused rather than defaulted: the teacher either
 * meant a number or meant to put the line in the wording.
 */
export function questionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    text: requiredText(v, { min: 1, max: QUESTION_MAX_LENGTH }),
    points: z.coerce
      .number({ error: v.invalidNumber })
      .gt(0, { error: v.invalidNumber })
      .max(100, { error: v.invalidNumber }),
  });
}

/** The devoir a teacher sets for their own class. */
export function devoirSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    /*
      The paper. Optional, and empty is the ordinary case: a teacher who sets
      "exercices p.42" has no questions to type, and one writing a controlled
      test types all of them.

      The barème is deliberately *not* forced to equal `maxScore`. A bonus
      question worth more than the paper is a real thing a teacher does, and
      refusing it here would be the schema overruling them. The editor keeps the
      two in step by moving `maxScore` with the total as questions are typed, and
      shows the sum either way — so a mismatch is a choice rather than a
      surprise found at the bottom of a pile of copies.
    */
    questions: z.array(questionSchema(t)).max(MAX_QUESTIONS).default([]),
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
