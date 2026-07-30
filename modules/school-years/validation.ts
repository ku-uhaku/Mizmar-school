import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { dateField, enumField, requiredText } from "@/lib/validation";
import { SCHOOL_YEAR_STATUSES } from "@/modules/school-years/enums";

/** Built per-request from the dictionary so messages are localised. */
export function schoolYearSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      name: requiredText(v, { max: 40 }),
      startDate: dateField(v),
      endDate: dateField(v),
      status: enumField(SCHOOL_YEAR_STATUSES, v),
      isDefault: z.boolean(),
    })
    .refine((data) => data.endDate > data.startDate, {
      error: t.schoolYear.endBeforeStart,
      path: ["endDate"],
    });
}
