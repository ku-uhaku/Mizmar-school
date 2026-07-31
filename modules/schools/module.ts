import { defineModule } from "@/lib/module";
import { SCHOOL_PERMISSIONS } from "@/modules/schools/permissions";

export const schoolsModule = defineModule({
  id: "schools",
  schemaFolder: "schools",
  nav: [
    {
      href: "/schools",
      icon: "schools",
      section: "administration",
      labelKey: "schools",
      order: 12,
      schoolPermission: SCHOOL_PERMISSIONS.SCHOOL_VIEW,
    },
  ],
  permissions: [{ group: "school", codes: Object.values(SCHOOL_PERMISSIONS) }],
});
