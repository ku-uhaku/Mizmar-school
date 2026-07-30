import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * `ENROLMENT_FEES` is separate from `ENROLMENT_UPDATE` because the two are done
 * by different people: a secretary seats a child in a class, and only the
 * bursar changes what a family is charged.
 */
export const ENROLMENT_PERMISSIONS = definePermissions({
  ENROLMENT_VIEW: "enrolment.view",
  ENROLMENT_CREATE: "enrolment.create",
  ENROLMENT_UPDATE: "enrolment.update",
  ENROLMENT_DELETE: "enrolment.delete",
  ENROLMENT_FEES: "enrolment.fees",
});
