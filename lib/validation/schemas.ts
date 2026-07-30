import * as z from "zod";

import {
  ACCENTS,
  FONT_FAMILIES,
  FONT_SIZES,
  RADII,
  ROLE_SCOPES,
  SCHOOL_LEVELS,
  SCHOOL_YEAR_STATUSES,
  THEME_MODES,
} from "@/lib/enums";
import { LOCALES } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import {
  birthDateField,
  countryField,
  dateField,
  enumField,
  optionalEmail,
  optionalPositiveInt,
  optionalText,
  optionalUrl,
  password,
  requiredText,
} from "@/lib/validation/common";

/**
 * Schemas are built per-request from the active dictionary so error messages
 * come back in the user's language.
 */
type T = Dictionary;

export function organizationSchema(t: T) {
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
    logoUrl: optionalUrl(v),
    defaultLocale: enumField(LOCALES, v),
  });
}

export function schoolSchema(t: T) {
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
    addressLine: optionalText(200),
    city: optionalText(80),
    region: optionalText(80),
    postalCode: optionalText(16),
    country: countryField(v),
    isActive: z.boolean(),
  });
}

export function schoolYearSchema(t: T) {
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

export function roleSchema(t: T) {
  const v = t.validation;
  return z.object({
    name: requiredText(v, { max: 80 }),
    description: optionalText(300),
    scope: enumField(ROLE_SCOPES, v),
    permissions: z.array(z.string()),
  });
}

/** Membership rows arrive as `schoolId:roleId` pairs from the user form. */
export const membershipPairSchema = z
  .string()
  .regex(/^[^:]+:[^:]+$/)
  .transform((value) => {
    const [schoolId, roleId] = value.split(":");
    return { schoolId, roleId };
  });

export function userSchema(t: T, { requirePassword }: { requirePassword: boolean }) {
  const v = t.validation;
  return z.object({
    firstName: requiredText(v, { max: 80 }),
    lastName: requiredText(v, { max: 80 }),
    email: z.email({ error: v.email }).transform((value) => value.toLowerCase()),
    // Blank on edit means "keep the existing password".
    password: requirePassword
      ? password(v)
      : z.union([z.literal(""), password(v)]).transform((value) => value || null),
    phone: optionalText(32),
    jobTitle: optionalText(80),
    birthDate: birthDateField(v),
    avatarUrl: optionalUrl(v),
    orgRoleId: z
      .string()
      .transform((value) => (value === "" || value === "none" ? null : value))
      .nullable(),
    isActive: z.boolean(),
    isSuperAdmin: z.boolean(),
    memberships: z.array(membershipPairSchema),
  });
}

export function profileSchema(t: T) {
  const v = t.validation;
  return z.object({
    firstName: requiredText(v, { max: 80 }),
    lastName: requiredText(v, { max: 80 }),
    phone: optionalText(32),
    jobTitle: optionalText(80),
    bio: optionalText(500),
    avatarUrl: optionalUrl(v),
    birthDate: birthDateField(v),
  });
}

export function passwordChangeSchema(t: T) {
  const v = t.validation;
  return z
    .object({
      currentPassword: z.string().min(1, { error: v.required }),
      newPassword: password(v),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      error: t.profile.passwordMismatch,
      path: ["confirmPassword"],
    });
}

export function appearanceSchema(t: T) {
  const v = t.validation;
  return z.object({
    mode: enumField(THEME_MODES, v),
    accent: enumField(ACCENTS, v),
    fontFamily: enumField(FONT_FAMILIES, v),
    fontSize: enumField(FONT_SIZES, v),
    radius: enumField(RADII, v),
  });
}
