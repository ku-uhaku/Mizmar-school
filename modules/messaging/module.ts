import { defineModule } from "@/lib/module";
import { MESSAGING_PERMISSIONS } from "@/modules/messaging/permissions";

/**
 * WhatsApp reminders to the parents of families who are late paying.
 *
 * It owns the campaign and its deliveries, and the message credits that pay for
 * them. It owns no notion of "late" — that is the caisse's, and this module
 * asks it (`listReminderTargets` in treasury/queries.ts).
 *
 * Sits in the caisse section, beside the screen that says who has not paid: the
 * one produces the list this one writes to. The credits page is not in the nav
 * — it is the platform owner's, reached from the reminders screen only when the
 * viewer is that owner.
 */
export const messagingModule = defineModule({
  id: "messaging",
  schemaFolder: "messaging",
  nav: [
    {
      href: "/caisse/relances",
      icon: "chat",
      section: "finance",
      labelKey: "reminders",
      // Right after the families screen: from "who is late" to "tell them".
      order: 26,
      schoolPermission: MESSAGING_PERMISSIONS.MESSAGING_SEND,
    },
  ],
  permissions: [
    { group: "messaging", codes: Object.values(MESSAGING_PERMISSIONS) },
  ],
});
