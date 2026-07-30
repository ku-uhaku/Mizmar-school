import { defineModule } from "@/lib/module";
import { SCHOOL_PERMISSIONS } from "@/modules/schools/permissions";

export const schoolsModule = defineModule({
  id: "schools",
  schemaFolder: "schools",
  nav: [
    {
      href: "/schools",
      icon: "schools",
      section: "main",
      labelKey: "schools",
      order: 10,
      schoolPermission: SCHOOL_PERMISSIONS.SCHOOL_VIEW,
    },
  ],
  permissions: [{ group: "school", codes: Object.values(SCHOOL_PERMISSIONS) }],
});
