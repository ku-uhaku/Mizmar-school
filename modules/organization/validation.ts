import * as z from "zod";

import { LOCALES } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import {
  countryField,
  enumField,
  optionalEmail,
  optionalText,
  optionalUrl,
  requiredText,
  optionalImage,
} from "@/lib/validation";

/**
 * Schemas are built per-request from the active dictionary so error messages
 * come back in the user's language — hence a factory rather than a constant.
 */
export function organizationSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    name: requiredText(v, { max: 120 }),
    legalName: optionalText(160),
    ice: optionalText(32),
    taxId: optionalText(32),
    email: optionalEmail(v),
    phone: optionalText(32),
    website: optionalUrl(v),
    addressLine: optionalText(200),
    city: optionalText(80),
    region: optionalText(80),
    postalCode: optionalText(16),
    country: countryField(v),
    logoUrl: optionalImage(v),
    defaultLocale: enumField(LOCALES, v),
  });
}
