import { defineModule } from "@/lib/module";
import { TRANSPORT_PERMISSIONS } from "@/modules/transport/permissions";

/**
 * Logistique: the fleet, the lines it runs, and who rides on them.
 *
 * It owns the vehicles, the routes, the runs they make and who rides on them.
 * It owns **nothing** about money: what a family pays for the bus is one flat
 * fee on the price list, raised on the échéancier at enrolment like every other
 * charge. Seating a child at a stop is an operational act and never touches what
 * they owe.
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
      href: "/transport/voyages",
      icon: "routes",
      section: "logistique",
      labelKey: "transportVoyages",
      order: 25,
      // The board is a read of the day; starting a run is gated inside it.
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_VIEW,
    },
    {
      href: "/transport/mon-voyage",
      icon: "fleet",
      section: "logistique",
      labelKey: "transportMyVoyages",
      order: 26,
      // The driver's own code, so a chauffeur's role shows this and nothing
      // else of the logistics section — see modules/transport/permissions.ts.
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_ATTENDANCE,
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
      href: "/transport/attendance",
      icon: "attendance",
      section: "logistique",
      labelKey: "transportAttendance",
      order: 50,
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_ATTENDANCE,
    },
    {
      href: "/transport/consumption",
      icon: "decaissement",
      section: "logistique",
      labelKey: "transportConsumption",
      order: 60,
      // The driver's own permission, not the fleet manager's: raising a request
      // is the job of whoever is at the pump. Approving one is gated separately
      // inside the screen — see modules/transport/permissions.ts.
      schoolPermission: TRANSPORT_PERMISSIONS.TRANSPORT_FUEL,
    },
  ],
  permissions: [
    { group: "transport", codes: Object.values(TRANSPORT_PERMISSIONS) },
  ],
});
