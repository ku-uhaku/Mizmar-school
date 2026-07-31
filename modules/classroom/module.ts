import { defineModule } from "@/lib/module";
import { CLASSROOM_PERMISSIONS } from "@/modules/classroom/permissions";

/**
 * L'espace enseignant, and what happens in the room.
 *
 * It owns two tables — who was there, and what was noticed about them — and
 * hosts the workspace a teacher actually works out of. Those belong together
 * because they are the same act: a teacher stands in front of a class, takes the
 * register, sets a devoir, and writes down that Yasmine has stopped bringing her
 * book. Splitting the register from the carnet would put one job across two
 * modules.
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
    {
      href: "/teacher",
      icon: "teacher",
      section: "enseignant",
      labelKey: "overview",
      order: 10,
      schoolPermission: CLASSROOM_PERMISSIONS.CLASSROOM_WORKSPACE,
    },
    {
      href: "/teacher/attendance",
      icon: "attendance",
      section: "enseignant",
      labelKey: "classroomAttendance",
      order: 20,
      schoolPermission: CLASSROOM_PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW,
    },
    {
      href: "/teacher/timetable",
      icon: "timetable",
      section: "enseignant",
      labelKey: "classroomTimetable",
      // Right after the register: both answer "where am I meant to be".
      order: 25,
      schoolPermission: CLASSROOM_PERMISSIONS.CLASSROOM_WORKSPACE,
    },
    {
      href: "/teacher/devoirs",
      icon: "homework",
      section: "enseignant",
      labelKey: "classroomDevoirs",
      order: 30,
      schoolPermission: CLASSROOM_PERMISSIONS.CLASSROOM_WORKSPACE,
    },
    {
      href: "/teacher/remarks",
      icon: "remarks",
      section: "enseignant",
      labelKey: "classroomRemarks",
      order: 40,
      schoolPermission: CLASSROOM_PERMISSIONS.CLASSROOM_REMARK_VIEW,
    },
  ],
  permissions: [
    { group: "classroom", codes: Object.values(CLASSROOM_PERMISSIONS) },
  ],
});
