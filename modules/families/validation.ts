import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  countryField,
  enumField,
  optionalEmail,
  optionalText,
  password,
  requiredText,
} from "@/lib/validation";
import {
  FAMILY_SITUATIONS,
  GUARDIAN_RELATIONSHIPS,
} from "@/modules/families/enums";

/**
 * A dossier is always filed under "Famille <nom>", in Arabic "أسرة <nom>".
 *
 * The school addresses the household, not the surname — every list, receipt and
 * envelope reads that way, and the seeded files already do. Left to the form it
 * held only when whoever opened the file remembered, so half the dossiers sorted
 * under B and half under F. Applied here rather than at the screen because the
 * wizard and the import open files too, and they must all agree.
 *
 * Idempotent: re-saving a dossier does not give it a second "Famille", and a
 * secretary who types the word herself gets it back exactly once. `عائلة` is
 * recognised as well as `أسرة` so the two Arabic words do not stack.
 */
const FAMILY_PREFIX = "Famille";
const FAMILY_PREFIX_AR = "أسرة";
const FAMILY_PREFIXES_AR = [FAMILY_PREFIX_AR, "عائلة"];

function prefixed(
  value: string,
  canonical: string,
  aliases: readonly string[],
): string {
  const name = value.trim();

  for (const alias of aliases) {
    if (!name.toLocaleLowerCase().startsWith(alias.toLocaleLowerCase())) {
      continue;
    }
    // A word boundary, so a surname that merely begins with those letters is
    // not mistaken for the word itself.
    const rest = name.slice(alias.length);
    if (rest !== "" && !/^\s/.test(rest)) continue;
    return rest.trim() === "" ? canonical : `${canonical} ${rest.trim()}`;
  }

  return name === "" ? canonical : `${canonical} ${name}`;
}

/** "Bennis" → "Famille Bennis"; "famille bennis" → "Famille Bennis". */
export function withFamilyPrefix(name: string): string {
  return prefixed(name, FAMILY_PREFIX, [FAMILY_PREFIX]);
}

/** The same for the Arabic name, which stays blank when it was blank. */
export function withFamilyPrefixAr(name: string | null): string | null {
  return name === null ? null : prefixed(name, FAMILY_PREFIX_AR, FAMILY_PREFIXES_AR);
}

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
    // The prefix is added after the length check, so a name that only just
    // fits is not rejected for the eight characters the app itself supplies.
    name: requiredText(v, { max: 120 }).transform(withFamilyPrefix),
    nameAr: optionalText(120).transform(withFamilyPrefixAr),
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

/**
 * The password a secretary types for a family's access, rather than the one the
 * app generates.
 *
 * Same rule as every other password in the app — a school that chooses "the
 * dossier number" for every family should be stopped by the same floor a member
 * of staff is. It is deliberately only a length: what a parent can be told over
 * a counter and remember is not what a complexity rule optimises for, and the
 * defence that matters here is that the parent changes it in the app.
 */
export function portalPasswordSchema(t: Dictionary) {
  return z.object({ password: password(t.validation) });
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
    /**
     * A row of the school's own list — see ParentJob.
     *
     * The Radix Select's "none" is normalised here, as it is for a user's
     * fonction: the sentinel is a rendering detail and nothing past this line
     * should have to know it.
     */
    parentJobId: z
      .string()
      .max(40)
      .transform((value) => (value === "" || value === "none" ? null : value))
      .nullable(),
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
