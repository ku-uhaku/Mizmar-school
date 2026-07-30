import { definePermissions } from "@/lib/module";

/** See modules/organization/permissions.ts for the contract. */
export const SCHOOL_PERMISSIONS = definePermissions({
  SCHOOL_VIEW: "school.view",
  SCHOOL_CREATE: "school.create",
  SCHOOL_UPDATE: "school.update",
  SCHOOL_DELETE: "school.delete",
});
