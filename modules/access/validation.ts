import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField, optionalText, requiredText } from "@/lib/validation";
import { ROLE_SCOPES } from "@/modules/access/enums";

/**
 * Built per-request from the dictionary so messages are localised.
 *
 * `permissions` is a bare string array on purpose: the action maps codes to ids
 * against the catalogue and drops anything unknown, so validating the codes
 * here would duplicate that check in a place that can silently fall behind.
 */
export function roleSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    name: requiredText(v, { max: 80 }),
    description: optionalText(300),
    scope: enumField(ROLE_SCOPES, v),
    permissions: z.array(z.string()),
  });
}
