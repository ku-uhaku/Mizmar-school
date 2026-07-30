import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { optionalText, requiredText } from "@/lib/validation";
import { MAX_LESSON_SPAN } from "@/modules/timetable/enums";

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
    /** Consecutive periods the lesson runs for — 2 is a double period. */
    spanSlots: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(MAX_LESSON_SPAN, { error: v.invalidNumber }),
  });
}
