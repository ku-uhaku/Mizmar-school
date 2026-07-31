import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * The split is the one a school actually makes. `ASSESSMENT_GRADE` is a
 * teacher's daily job — entering marks on a paper somebody else planned — while
 * `ASSESSMENT_MANAGE` decides what gets set at all, and generating a whole
 * term's contrôles across every subject is a head of studies' decision, not a
 * teacher's. Granting mark entry must not hand over the calendar.
 *
 * `ASSESSMENT_PUBLISH` is separate again because publishing is what opens a
 * paper to mark entry and, later, to the family — and a mark that appears before
 * the class council has seen it is exactly the thing schools ask to control.
 */
export const ASSESSMENT_PERMISSIONS = definePermissions({
  ASSESSMENT_VIEW: "assessment.view",
  ASSESSMENT_MANAGE: "assessment.manage",
  ASSESSMENT_GRADE: "assessment.grade",
  ASSESSMENT_PUBLISH: "assessment.publish",
  ASSESSMENT_DELETE: "assessment.delete",
});
