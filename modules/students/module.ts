import { defineModule } from "@/lib/module";
import { STUDENT_PERMISSIONS } from "@/modules/students/permissions";

export const studentsModule = defineModule({
  id: "students",
  schemaFolder: "students",
  nav: [
    {
      href: "/students",
      icon: "students",
      section: "vieScolaire",
      labelKey: "students",
      order: 30,
      schoolPermission: STUDENT_PERMISSIONS.STUDENT_VIEW,
    },
  ],
  permissions: [{ group: "student", codes: Object.values(STUDENT_PERMISSIONS) }],
});
