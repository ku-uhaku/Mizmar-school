import { defineModule } from "@/lib/module";
import { CLASSROOM_PERMISSIONS } from "@/modules/classroom/permissions";

/**
 * What happens in the room.
 *
 * It owns two tables — who was there, and what was noticed about them. Those
 * belong together because they are the same act: a teacher stands in front of a
 * class, takes the register, sets a devoir, and writes down that Yasmine has
 * stopped bringing her book. Splitting the register from the carnet would put
 * one job across two modules.
 *
 * ── The espace enseignant is the phone, and only the phone ──────────────────
 * The workspace this module used to host on the web is gone: a teacher takes
 * the register, sets a devoir and writes a remark from `mobile/`, against
 * `app/api/mobile/v1/teacher/**`, which reads these same queries. Nothing of
 * the teacher's own work is on the dashboard any more, and a teacher's account
 * cannot open the dashboard at all — see modules/access/web-access.ts. What is
 * left here is the direction's side of the carnet.
 *
 * What it deliberately does not own is the devoir itself. A devoir is an
 * `Assessment` like a contrôle — same table, same mark sheet, same average —
 * and the only difference is who may create one, which is
 * `AssessmentType.allowTeacherCreate`. Giving teachers a parallel table would
 * mean two things to average at the end of term.
 *
 * Every read here is confined to the signed-in teacher's own
 * `TeachingAssignment` rows. That confinement lives in `queries.ts` rather than
 * in a permission, because no permission could express "only their own classes"
 * for an administrator to grant.
 */
export const classroomModule = defineModule({
  id: "classroom",
  schemaFolder: "classroom",
  nav: [
    /*
      The direction's view of the carnet, and now the only screen this module
      puts on the web at all.

      It sits under Vie scolaire because that is whose question it answers —
      "what is being written about our pupils, and what is waiting on us".
      Behind the publish code rather than the view one: releasing an observation
      to a family is the whole purpose of the screen, and it is the one decision
      the teacher who wrote the remark does not get.
    */
    {
      href: "/school-life/remarks",
      icon: "remarks",
      section: "vieScolaire",
      labelKey: "remarksReview",
      order: 75,
      schoolPermission: CLASSROOM_PERMISSIONS.CLASSROOM_REMARK_PUBLISH,
    },
  ],
  permissions: [
    { group: "classroom", codes: Object.values(CLASSROOM_PERMISSIONS) },
  ],
});
