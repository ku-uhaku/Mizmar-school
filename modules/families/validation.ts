import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  countryField,
  enumField,
  optionalEmail,
  optionalText,
  requiredText,
} from "@/lib/validation";
import {
  FAMILY_SITUATIONS,
  GUARDIAN_RELATIONSHIPS,
} from "@/modules/families/enums";

/** Built per-request from the dictionary so messages are localised. */
export function familySchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    // Optional: the service layer allocates the next dossier number when a
    // secretary opens a file without one.
    code: optionalText(32).refine(
      (value) => value === null || /^[A-Za-z0-9-]+$/.test(value),
      { error: v.codeFormat },
    ),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    situation: enumField(FAMILY_SITUATIONS, v),
    addressLine: optionalText(200),
    city: optionalText(80),
    postalCode: optionalText(16),
    country: countryField(v),
    phone: optionalText(32),
    email: optionalEmail(v),
    notes: optionalText(1000),
    isActive: z.boolean(),
  });
}

export function guardianSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    relationship: enumField(GUARDIAN_RELATIONSHIPS, v),
    firstName: requiredText(v, { max: 80 }),
    lastName: requiredText(v, { max: 80 }),
    nameAr: optionalText(120),
    nationalId: optionalText(32),
    phone: optionalText(32),
    phoneAlt: optionalText(32),
    email: optionalEmail(v),
    profession: optionalText(120),
    employer: optionalText(120),
    addressLine: optionalText(200),
    city: optionalText(80),
    isPrimaryContact: z.boolean(),
    isEmergencyContact: z.boolean(),
    canPickUp: z.boolean(),
    notes: optionalText(1000),
    isActive: z.boolean(),
  });
}
