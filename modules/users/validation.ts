import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  isValidUsername,
  normalizeUsername,
} from "@/modules/users/enums";
import {
  birthDateField,
  optionalEmail,
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
    /*
      A mailbox, not a credential. Optional because plenty of accounts have no
      address the school knows of — a parent handed a portal login at the
      counter, a caretaker who needs the staff chat — and nothing signs in with
      it either way. See User.email.
    */
    email: optionalEmail(v),
    /*
      What this account signs in with, and therefore required: an account with no
      username is one nobody can reach. See User.username.

      Lowercased before it is checked, so the pattern only ever has one spelling
      to accept and the unique index only ever one to store. See
      modules/users/enums.ts.
    */
    username: z
      .string()
      .trim()
      .transform(normalizeUsername)
      .refine((value) => value !== "", { error: v.required })
      .refine((value) => value === "" || isValidUsername(value), {
        error: v.invalidUsername,
      }),
    // Blank on edit means "keep the existing password".
    password: requirePassword
      ? password(v)
      : z.union([z.literal(""), password(v)]).transform((value) => value || null),
    phone: optionalText(32),
    /**
     * A row of the school's own list — see StaffFunction.
     *
     * The picker's "none" is normalised here rather than at the action, the
     * same way `orgRoleId` is: the sentinel is a rendering detail of a Radix
     * Select, which cannot hold an empty value, and nothing past this line
     * should have to know it.
     */
    jobFunctionId: z
      .string()
      .max(40)
      .transform((value) => (value === "" || value === "none" ? null : value))
      .nullable(),
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
