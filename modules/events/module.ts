import { defineModule } from "@/lib/module";
import { EVENT_PERMISSIONS } from "@/modules/events/permissions";

/**
 * Les événements: what the school announces to its families.
 *
 * Under Vie scolaire because that is what it is about — the year as a family
 * experiences it — and not under Configuration, because an event is a fact of
 * one year rather than a policy the school sets once.
 *
 * It owns the announcement and lends it to the portal: the phone reads
 * published events through `modules/portal/queries.ts`, scoped on the
 * household, and never touches this module's tables directly.
 */
export const eventsModule = defineModule({
  id: "events",
  schemaFolder: "events",
  nav: [
    {
      href: "/events",
      icon: "events",
      section: "vieScolaire",
      labelKey: "events",
      order: 60,
      schoolPermission: EVENT_PERMISSIONS.EVENT_VIEW,
    },
  ],
  permissions: [{ group: "event", codes: Object.values(EVENT_PERMISSIONS) }],
});
