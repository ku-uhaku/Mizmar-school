import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Creating and deleting classes is not here — that is configuration, under
 * `configuration.manage`. What this module grants is the running of a class
 * that already exists: who sits in it, and who teaches it. The two are held by
 * different people, which is why they are two codes.
 *
 * Seating a pupil also needs `enrolment.update`, since it writes the pupil's
 * enrolment row. `CLASS_ROSTER` is what gets you the screen.
 */
export const CLASS_PERMISSIONS = definePermissions({
  CLASS_VIEW: "class.view",
  CLASS_ROSTER: "class.roster",
  CLASS_ASSIGN_TEACHER: "class.assignTeacher",
});
