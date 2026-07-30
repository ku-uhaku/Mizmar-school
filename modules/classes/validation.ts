import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { optionalPositiveInt, optionalText, requiredText } from "@/lib/validation";

/** Built per-request from the dictionary so messages are localised. */
export function teachingAssignmentSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    subjectId: requiredText(v, { max: 40 }),
    teacherId: requiredText(v, { max: 40 }),
    classGroupId: optionalText(40),
    weeklyMinutes: optionalPositiveInt(v),
    isPrimary: z.boolean(),
  });
}
