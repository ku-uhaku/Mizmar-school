import { definePermissions } from "@/lib/module";

/**
 * Sending is a school-scoped permission: a director may message the families of
 * their own school only. Buying credits has no code on purpose — it is the
 * platform owner's, not something a role can be granted; see `isCreditOwner` in
 * service.ts.
 */
export const MESSAGING_PERMISSIONS = definePermissions({
  MESSAGING_SEND: "messaging.send",
});
