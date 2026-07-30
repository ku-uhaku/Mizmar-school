import { defineModule } from "@/lib/module";
import { ROLE_PERMISSIONS } from "@/modules/access/permissions";

/**
 * Roles, the permission catalogue and school memberships — everything that
 * decides who may do what. The `/roles` screens are its only UI; membership
 * rows are edited inside the user form, which lives in the `users` module.
 */
export const accessModule = defineModule({
  id: "access",
  schemaFolder: "access",
  nav: [
    {
      href: "/roles",
      icon: "roles",
      section: "administration",
      labelKey: "roles",
      order: 30,
      // Org-wide only: editing roles changes what every school can do, so a
      // school-scoped grant must never open this screen.
      orgPermission: ROLE_PERMISSIONS.ROLE_VIEW,
    },
  ],
  permissions: [{ group: "role", codes: Object.values(ROLE_PERMISSIONS) }],
});
