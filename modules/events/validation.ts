import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  dateField,
  enumField,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validation";
import { EVENT_KINDS } from "@/modules/events/enums";

/**
 * Built per-request from the dictionary so messages are localised.
 *
 * The audience is validated here as far as shape goes — that the two id lists
 * are strings — and no further. Whether those ids belong to this school is a
 * question only the database can answer, so `modules/events/service.ts` filters
 * them against the school before writing. A form is never the authority on what
 * a request may reach.
 */
export function eventSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      title: requiredText(v, { max: 160 }),
      titleAr: optionalText(160),
      description: optionalText(2000),
      kind: enumField(EVENT_KINDS, v),
      startsAt: dateField(v),
      endsAt: optionalDate(v),
      isAllDay: z.boolean(),
      location: optionalText(200),
      isSchoolWide: z.boolean(),
      levelIds: z.array(z.string()).default([]),
      classIds: z.array(z.string()).default([]),
    })
    .refine(
      (value) => !value.endsAt || value.endsAt >= value.startsAt,
      { error: t.event.startAfterEnd, path: ["endsAt"] },
    )
    /*
      An event aimed at nobody is the one shape that cannot be published, and
      catching it here means the form says so under the field rather than the
      action returning a bare failure after a round trip. The service refuses it
      again on publish, because a draft saved school-wide can be narrowed later.
    */
    .refine(
      (value) =>
        value.isSchoolWide ||
        value.levelIds.length > 0 ||
        value.classIds.length > 0,
      { error: t.event.audienceEmpty, path: ["levelIds"] },
    );
}
