import { defineModule } from "@/lib/module";

/**
 * Les notifications: what each account is waiting to be told.
 *
 * ── Why it declares no permission ───────────────────────────────────────────
 * Every other module gates a screen on a code, and this one deliberately does
 * not. There is nothing here to be allowed to see: you read your own inbox and
 * there is no other one to read. A `notification.view` code would be granted to
 * everybody on the first day and would then only be able to go wrong — a role
 * edited a year later could silently stop someone being told their pupil's
 * bulletin was out.
 *
 * What may be *written* into an inbox is gated, but not here: each notification
 * is raised by the module whose fact it is, behind that module's own code. The
 * office cannot announce an event without EVENT_PUBLISH, so it cannot raise the
 * notification either.
 *
 * Under `account` in the sidebar, beside the profile and the theme, because
 * that is what it is about — this account, not the school.
 */
export const notificationsModule = defineModule({
  id: "notifications",
  schemaFolder: "notifications",
  nav: [
    {
      href: "/notifications",
      icon: "notifications",
      section: "account",
      labelKey: "notifications",
      order: 10,
    },
  ],
});
