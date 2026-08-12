import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Two codes, and the split is the one a guichet actually makes. Reading the
 * queue is what anybody at the desk does to answer a parent on the phone —
 * "yes, it is ready" — while `REQUEST_HANDLE` is agreeing to write a paper, or
 * refusing to, and naming the day the family should come. A school hands the
 * first to whoever answers the telephone and the second to whoever signs.
 *
 * There is deliberately no REQUEST_CREATE. A request is filed by a *parent*,
 * who holds no permission at all — see modules/portal, which scopes on the
 * household instead. Staff filing one on a family's behalf is a different
 * feature and would need its own code.
 */
export const REQUEST_PERMISSIONS = definePermissions({
  REQUEST_VIEW: "request.view",
  REQUEST_HANDLE: "request.handle",
});
