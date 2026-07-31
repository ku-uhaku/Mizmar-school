import { defineModule } from "@/lib/module";
import { SCHOOL_YEAR_PERMISSIONS } from "@/modules/school-years/permissions";

export const schoolYearsModule = defineModule({
  id: "school-years",
  schemaFolder: "school-years",
  nav: [
    {
      href: "/school-years",
      icon: "schoolYears",
      section: "administration",
      labelKey: "schoolYears",
      order: 14,
      schoolPermission: SCHOOL_YEAR_PERMISSIONS.SCHOOL_YEAR_VIEW,
    },
  ],
  permissions: [
    { group: "schoolYear", codes: Object.values(SCHOOL_YEAR_PERMISSIONS) },
  ],
});
