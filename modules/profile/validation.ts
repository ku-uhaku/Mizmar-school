import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  birthDateField,
  optionalText,
  optionalUrl,
  password,
  requiredText,
} from "@/lib/validation";

/** Built per-request from the dictionary so messages are localised. */
export function profileSchema(t: Dictionary) {
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

export function passwordChangeSchema(t: Dictionary) {
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
