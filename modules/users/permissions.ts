import { definePermissions } from "@/lib/module";

/** See modules/organization/permissions.ts for the contract. */
export const USER_PERMISSIONS = definePermissions({
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  /** Assign / revoke a user's school-scoped roles. */
  USER_ASSIGN_ROLE: "user.assignRole",
});
