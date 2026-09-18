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
  NOTES_MAX,
  QUESTION_MAX_LENGTH,
} from "@/modules/assessments/enums";
import {
  REMARK_KINDS,
  REMARK_MAX_LENGTH,
  REMARK_TONES,
  SESSION_TEXT_MAX,
} from "@/modules/classroom/enums";

/** Built per-request from the dictionary so messages come back localised. */

/**
 * The cahier de textes for one séance.
 *
 * Both fields are optional: a register taken in a hurry is still a register,
 * and refusing to record who was in the room because nobody typed the theme
 * would cost the school the half that matters most. Empty comes back as null,
 * so clearing a theme clears the column rather than storing "".
 *
 * Takes no dictionary, unlike its neighbours: nothing here can fail in a way a
 * sentence would explain — the only rule is a length the textarea also caps.
 */
export function sessionSchema() {
  return z.object({
    theme: optionalText(SESSION_TEXT_MAX),
    homework: optionalText(SESSION_TEXT_MAX),
  });
}

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
    /** What it covers — "leçon 3, p.42". Optional: a title often says it all. */
    notes: optionalText(NOTES_MAX),
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
    /**
     * Whether the marks move the subject's average.
     *
     * Optional, and undefined is not the same as false: the mobile route offers
     * no such box, and a missing value has to mean "whatever the kind says"
     * rather than "does not count". See `createDevoir`.
     */
    countsTowardAverage: z.boolean().optional(),
  });
}
