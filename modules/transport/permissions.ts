import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * `TRANSPORT_SUBSCRIBE` is separate from `TRANSPORT_MANAGE` because the two are
 * different jobs: a secretary puts a child on a line all day, and only whoever
 * runs the logistics redraws the lines or retires a bus. It is also the one that
 * moves money — subscribing reprices the family's transport fees — so it is
 * granted alongside the desk work rather than with the fleet.
 */
export const TRANSPORT_PERMISSIONS = definePermissions({
  TRANSPORT_VIEW: "transport.view",
  TRANSPORT_MANAGE: "transport.manage",
  TRANSPORT_SUBSCRIBE: "transport.subscribe",
  TRANSPORT_DELETE: "transport.delete",
});
