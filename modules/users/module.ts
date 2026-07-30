import { defineModule } from "@/lib/module";
import { USER_PERMISSIONS } from "@/modules/users/permissions";

export const usersModule = defineModule({
  id: "users",
  // Owns both User and Profile. The `profile` and `appearance` modules write to
  // Profile too, but only ever the signed-in user's own row.
  schemaFolder: "users",
  nav: [
    {
      href: "/users",
      icon: "users",
      section: "administration",
      labelKey: "users",
      order: 20,
      schoolPermission: USER_PERMISSIONS.USER_VIEW,
    },
  ],
  permissions: [{ group: "user", codes: Object.values(USER_PERMISSIONS) }],
});
