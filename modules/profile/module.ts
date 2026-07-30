import { defineModule } from "@/lib/module";

/**
 * The signed-in user's own account page. Needs no permissions: everyone may
 * edit their own profile, and every action resolves the user id from the
 * session rather than the request.
 */
export const profileModule = defineModule({
  id: "profile",
  nav: [
    {
      href: "/profile",
      icon: "profile",
      section: "account",
      labelKey: "profile",
      order: 10,
    },
  ],
});
