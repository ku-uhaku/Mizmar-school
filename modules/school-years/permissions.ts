import { definePermissions } from "@/lib/module";

/** See modules/organization/permissions.ts for the contract. */
export const SCHOOL_YEAR_PERMISSIONS = definePermissions({
  SCHOOL_YEAR_VIEW: "schoolYear.view",
  SCHOOL_YEAR_CREATE: "schoolYear.create",
  SCHOOL_YEAR_UPDATE: "schoolYear.update",
  SCHOOL_YEAR_DELETE: "schoolYear.delete",
});
