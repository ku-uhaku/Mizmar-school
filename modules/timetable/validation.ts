import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField, optionalText, requiredText } from "@/lib/validation";
import {
  EXCEPTION_KINDS,
  MAX_LESSON_SPAN,
  WEEK_PARITIES,
} from "@/modules/timetable/enums";

/**
 * Built per-request from the dictionary so messages are localised.
 *
 * `days` is deliberately absent: the action reads it separately and always
 * folds the anchor's own day in, so a request that omitted it could not place
 * a lesson nowhere.
 */
export function timetableEntrySchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    timeSlotId: requiredText(v, { max: 40 }),
    subjectId: requiredText(v, { max: 40 }),
    teacherId: optionalText(40),
    roomId: optionalText(40),
    classGroupId: optionalText(40),
    termId: optionalText(40),
    /** "ALL" | "A" | "B" — which weeks of the rotation the lesson runs in. */
    weekParity: enumField(WEEK_PARITIES, t.validation),
    /** Consecutive periods the lesson runs for — 2 is a double period. */
    spanSlots: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(MAX_LESSON_SPAN, { error: v.invalidNumber }),
  });
}

/**
 * A one-off change to one period of one week.
 *
 * `weekStart` arrives as `YYYY-MM-DD` and is re-derived to the Monday of its
 * week by the action, so a mid-week date typed into a URL cannot open a second
 * override keyed on a Wednesday.
 */
export function timetableExceptionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    timeSlotId: requiredText(v, { max: 40 }),
    weekStart: requiredText(v, { max: 10 }),
    kind: enumField(EXCEPTION_KINDS, v),
    subjectId: optionalText(40),
    teacherId: optionalText(40),
    roomId: optionalText(40),
    classGroupId: optionalText(40),
    note: optionalText(200),
  });
}
