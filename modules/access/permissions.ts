import { definePermissions } from "@/lib/module";

/** See modules/organization/permissions.ts for the contract. */
export const ROLE_PERMISSIONS = definePermissions({
  ROLE_VIEW: "role.view",
  ROLE_CREATE: "role.create",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",
});
