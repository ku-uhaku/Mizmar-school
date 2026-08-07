import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Publishing is its own code and deliberately not folded into EVENT_MANAGE.
 * Drafting an announcement and putting it in front of every family in the
 * school are different acts with different consequences — a secretary may
 * prepare the réunion de parents, and somebody answerable decides it goes out.
 * Un-publishing is the same decision in reverse, so cancelling sits behind the
 * same code.
 */
export const EVENT_PERMISSIONS = definePermissions({
  EVENT_VIEW: "event.view",
  EVENT_MANAGE: "event.manage",
  EVENT_PUBLISH: "event.publish",
  EVENT_DELETE: "event.delete",
});
