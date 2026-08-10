import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  isValidUsername,
  normalizeUsername,
} from "@/modules/users/enums";
import {
  birthDateField,
  optionalText,
  password,
  requiredText,
  optionalImage,
} from "@/lib/validation";

/** Membership rows arrive as `schoolId:roleId` pairs from the user form. */
export const membershipPairSchema = z
  .string()
  .regex(/^[^:]+:[^:]+$/)
  .transform((value) => {
    const [schoolId, roleId] = value.split(":");
    return { schoolId, roleId };
  });

/** Built per-request from the dictionary so messages are localised. */
export function userSchema(
  t: Dictionary,
  { requirePassword }: { requirePassword: boolean },
) {
  const v = t.validation;
  return z.object({
    firstName: requiredText(v, { max: 80 }),
    lastName: requiredText(v, { max: 80 }),
    email: z.email({ error: v.email }).transform((value) => value.toLowerCase()),
    /*
      What this account signs in with. Optional, because not every account is
      staff — a guardian has none and signs in on the phone with their email.

      Lowercased before it is checked, so the pattern only ever has one spelling
      to accept and the unique index only ever one to store. See
      modules/users/enums.ts.
    */
    username: z
      .string()
      .trim()
      .transform(normalizeUsername)
      .refine((value) => value === "" || isValidUsername(value), {
        error: v.invalidUsername,
      })
      .transform((value) => (value === "" ? null : value)),
    // Blank on edit means "keep the existing password".
    password: requirePassword
      ? password(v)
      : z.union([z.literal(""), password(v)]).transform((value) => value || null),
    phone: optionalText(32),
    jobTitle: optionalText(80),
    birthDate: birthDateField(v),
    avatarUrl: optionalImage(v),
    orgRoleId: z
      .string()
      .transform((value) => (value === "" || value === "none" ? null : value))
      .nullable(),
    isActive: z.boolean(),
    isSuperAdmin: z.boolean(),
    memberships: z.array(membershipPairSchema),
  });
}
