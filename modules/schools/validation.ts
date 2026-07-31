import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  countryField,
  enumField,
  optionalEmail,
  optionalPositiveInt,
  optionalText,
  optionalImage,
  optionalUrl,
  requiredText,
} from "@/lib/validation";
import { SCHOOL_LEVELS } from "@/modules/schools/enums";

/** Built per-request from the dictionary so messages are localised. */
export function schoolSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    code: requiredText(v, { max: 32 }).regex(/^[A-Za-z0-9-]+$/, {
      error: v.codeFormat,
    }),
    name: requiredText(v, { max: 120 }),
    level: enumField(SCHOOL_LEVELS, v),
    directorName: optionalText(120),
    capacity: optionalPositiveInt(v),
    email: optionalEmail(v),
    phone: optionalText(32),
    website: optionalUrl(v),
    logoUrl: optionalImage(v),
    addressLine: optionalText(200),
    city: optionalText(80),
    region: optionalText(80),
    postalCode: optionalText(16),
    country: countryField(v),
    isActive: z.boolean(),
  });
}
