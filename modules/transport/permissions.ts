import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * `TRANSPORT_SUBSCRIBE` is separate from `TRANSPORT_MANAGE` because the two are
 * different jobs: a secretary puts a child on a line all day, and only whoever
 * runs the logistics redraws the lines or retires a bus. It is also the one that
 * moves money — subscribing reprices the family's transport fees — so it is
 * granted alongside the desk work rather than with the fleet.
 *
 * `TRANSPORT_FUEL` and `TRANSPORT_FUEL_APPROVE` are separate for the reason a
 * caisse exists: the person at the pump is not the person who agrees to the
 * spend. A driver holds the first and raises requests; whoever runs the
 * logistics holds the second, and only that decision posts a décaissement.
 * Granting both to one account is a school's choice, but it has to be a choice.
 *
 * `TRANSPORT_ATTENDANCE` is the driver's and the accompagnateur's: marking who
 * boarded is the one thing they do in the app, and it deliberately carries no
 * right to read what a family pays or to redraw a line.
 */
export const TRANSPORT_PERMISSIONS = definePermissions({
  TRANSPORT_VIEW: "transport.view",
  TRANSPORT_MANAGE: "transport.manage",
  TRANSPORT_SUBSCRIBE: "transport.subscribe",
  TRANSPORT_DELETE: "transport.delete",
  TRANSPORT_ATTENDANCE: "transport.attendance",
  TRANSPORT_FUEL: "transport.fuel",
  TRANSPORT_FUEL_APPROVE: "transport.fuelApprove",
});
