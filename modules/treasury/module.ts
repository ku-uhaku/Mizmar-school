import { defineModule } from "@/lib/module";
import { TREASURY_PERMISSIONS } from "@/modules/treasury/permissions";

/**
 * The caisse: the tills, the shifts they are held for, and every movement of
 * money in or out of them.
 *
 * It owns the collection half of billing too — a receipt and its allocation to
 * a pupil's schedule lines — because a payment *is* a movement of money, and
 * splitting the two would put the receipt in one module and the cash it arrived
 * as in another. Billing decides what is owed; this module decides what has
 * actually been paid.
 *
 * Its five screens are the five questions a bursar asks, so they are five nav
 * entries rather than tabs on one: money in, money out, money moved, cheques
 * outstanding, and everything at once.
 */
export const treasuryModule = defineModule({
  id: "treasury",
  schemaFolder: "treasury",
  nav: [
    {
      href: "/caisse",
      icon: "cashRegister",
      section: "finance",
      labelKey: "overview",
      order: 10,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_VIEW,
    },
    {
      href: "/caisse/encaissement",
      icon: "encaissement",
      section: "finance",
      labelKey: "encaissement",
      order: 20,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_COLLECT,
    },
    {
      href: "/caisse/decaissement",
      icon: "decaissement",
      section: "finance",
      labelKey: "decaissement",
      order: 30,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_DISBURSE,
    },
    {
      href: "/caisse/familles",
      icon: "encaissement",
      section: "finance",
      labelKey: "familyPayments",
      // Beside the encaissement screen: one takes the money, the other says
      // who has not brought it.
      order: 25,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_VIEW,
    },
    {
      href: "/caisse/transfert",
      icon: "transfert",
      section: "finance",
      labelKey: "transfert",
      order: 40,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_TRANSFER,
    },
    {
      href: "/caisse/registers",
      icon: "registers",
      section: "finance",
      labelKey: "registers",
      // Last: a bursar sets the tills up once and then lives on the four
      // screens above it.
      order: 60,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_VIEW,
    },
    {
      href: "/caisse/cheques",
      icon: "cheques",
      section: "finance",
      labelKey: "cheques",
      order: 50,
      schoolPermission: TREASURY_PERMISSIONS.TREASURY_CHEQUES,
    },
  ],
  permissions: [
    { group: "treasury", codes: Object.values(TREASURY_PERMISSIONS) },
  ],
});
