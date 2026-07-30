import { definePermissions } from "@/lib/module";

/** See modules/organization/permissions.ts for the contract. */
export const STUDENT_PERMISSIONS = definePermissions({
  STUDENT_VIEW: "student.view",
  STUDENT_CREATE: "student.create",
  STUDENT_UPDATE: "student.update",
  STUDENT_DELETE: "student.delete",
});
