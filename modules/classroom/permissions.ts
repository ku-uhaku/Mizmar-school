import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * `CLASSROOM_WORKSPACE` is the gate on the espace enseignant itself. It is
 * separate from the marking and register codes because the workspace is a
 * *surface*: what a teacher may actually do inside it is decided by the codes
 * below and by ASSESSMENT_GRADE, and every screen re-checks. Granting the
 * workspace alone gets somebody a read-only view of their own classes.
 *
 * Everything a teacher sees there is confined to their own teaching
 * assignments — that confinement is in the queries, not in a permission, since
 * no code could express "only their own classes" for somebody else to grant.
 */
export const CLASSROOM_PERMISSIONS = definePermissions({
  CLASSROOM_WORKSPACE: "classroom.workspace",
  CLASSROOM_ATTENDANCE_VIEW: "classroom.attendanceView",
  CLASSROOM_ATTENDANCE_MARK: "classroom.attendanceMark",
  /** Turning an absence into a justified one — an office decision, not a teacher's. */
  CLASSROOM_ATTENDANCE_JUSTIFY: "classroom.attendanceJustify",
  CLASSROOM_REMARK_VIEW: "classroom.remarkView",
  CLASSROOM_REMARK_WRITE: "classroom.remarkWrite",
  /** Releasing a remark to the family, which is a second, conscious act. */
  CLASSROOM_REMARK_PUBLISH: "classroom.remarkPublish",
});
