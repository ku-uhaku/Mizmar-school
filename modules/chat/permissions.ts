import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * ── Only two, and neither is "post" ─────────────────────────────────────────
 * A parent holds no permission at all — they are not staff, and their right to
 * read and write a channel comes from the household scope, exactly as it does
 * for their child's marks. See modules/portal/queries.ts.
 *
 * So these are the staff codes: reading the conversation, and removing from it.
 * `CHAT_MODERATE` is what makes the feature safe to switch on — a school that
 * cannot delete a message on a parents' group will ask for the whole thing to
 * be turned off the first time somebody posts something they should not.
 */
export const CHAT_PERMISSIONS = definePermissions({
  CHAT_VIEW: "chat.view",
  CHAT_MODERATE: "chat.moderate",
});
