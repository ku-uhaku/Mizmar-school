import { defineModule } from "@/lib/module";

/**
 * Theme, accent, typography and language. Like `profile`, it is self-service
 * and needs no permissions. Writes the appearance columns on the user's own
 * Profile row plus the `ui-prefs` cookie.
 */
export const appearanceModule = defineModule({
  id: "appearance",
  nav: [
    {
      href: "/appearance",
      icon: "appearance",
      section: "account",
      labelKey: "appearance",
      order: 20,
    },
  ],
});
