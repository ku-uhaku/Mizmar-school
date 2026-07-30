import { defineModule } from "@/lib/module";
import { ORGANIZATION_PERMISSIONS } from "@/modules/organization/permissions";

export const organizationModule = defineModule({
  id: "organization",
  schemaFolder: "organization",
  nav: [
    {
      href: "/organization",
      icon: "organization",
      section: "administration",
      labelKey: "organization",
      order: 10,
      schoolPermission: ORGANIZATION_PERMISSIONS.ORGANIZATION_VIEW,
    },
  ],
  permissions: [
    { group: "organization", codes: Object.values(ORGANIZATION_PERMISSIONS) },
  ],
});
