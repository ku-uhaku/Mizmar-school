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
      /*
        The one voyage screen, and the whole of the crew's day.

        It shows the runs of the bus the signed-in person is on; whoever holds
        TRANSPORT_MANAGE gets a switch inside it to widen to every line. There
        was a second entry — "mes voyages" — listing exactly the same runs, and
        two sidebar links to one screen is how a driver ends up taking the
        register on the wrong one.
      */
      href: "/transport/voyages",
      icon: "routes",
      section: "logistique",
      labelKey: "transportVoyages",
      order: 25,
      // The board is a read of the day; starting a run is gated inside it.
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
    /*
      L'appel is deliberately not in the sidebar.

      It is reached from the voyage it belongs to — pressing "démarrer" lands on
      it, and a run under way carries a link back. A standalone entry made the
      register a place you go *before* deciding which voyage you are on, which
      is precisely the mistake it invites: the screen defaulted to the first run
      of the day, so an afternoon driver opening it marked the morning.

      The route lives on at /transport/attendance and still authorizes on its
      own — this only decides what the nav offers.
    */
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
