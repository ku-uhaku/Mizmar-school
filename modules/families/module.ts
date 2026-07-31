import { defineModule } from "@/lib/module";
import { FAMILY_PERMISSIONS } from "@/modules/families/permissions";

export const familiesModule = defineModule({
  id: "families",
  schemaFolder: "families",
  nav: [
    {
      href: "/families",
      icon: "families",
      section: "vieScolaire",
      labelKey: "families",
      order: 20,
      // School-scoped: a dossier belongs to one school, and the working context
      // is what confines a director to their own.
      schoolPermission: FAMILY_PERMISSIONS.FAMILY_VIEW,
    },
  ],
  permissions: [{ group: "family", codes: Object.values(FAMILY_PERMISSIONS) }],
});
