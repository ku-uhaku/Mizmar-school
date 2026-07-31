import { defineModule } from "@/lib/module";
import { TRANSPORT_PERMISSIONS } from "@/modules/transport/permissions";

/**
 * Logistique: the fleet, the lines it runs, and who rides on them.
 *
 * It owns the vehicles and the routes outright. It does **not** own what a
 * family is charged — that stays on the échéancier, where every other charge
 * lives. What this module decides is the *price*: a stop sits in a zone, the
 * zone has a rate, and subscribing writes that rate onto the pupil's transport
 * fee lines. Billing declares what is owed, the caisse collects it, and the bus
 * only says how much.
 */
export const transportModule = defineModule({
  id: "transport",
  schemaFolder: "transport",
  nav: [
    {
      href: "/transport",
      icon: "transport",
      section: "logistique",
      labelKey: "overview",
      order: 10,
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_VIEW,
    },
    {
      href: "/transport/routes",
      icon: "routes",
      section: "logistique",
      labelKey: "transportRoutes",
      order: 20,
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_VIEW,
    },
    {
      href: "/transport/fleet",
      icon: "fleet",
      section: "logistique",
      labelKey: "transportFleet",
      order: 30,
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_VIEW,
    },
    {
      href: "/transport/zones",
      icon: "zones",
      section: "logistique",
      labelKey: "transportZones",
      // Pricing, not operations: a zone's rate is what a family is charged, so
      // reading the line list is not enough to open it.
      order: 40,
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_MANAGE,
    },
  ],
  permissions: [
    { group: "transport", codes: Object.values(TRANSPORT_PERMISSIONS) },
  ],
});
