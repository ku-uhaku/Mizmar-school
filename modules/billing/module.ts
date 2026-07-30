import { defineModule } from "@/lib/module";

/**
 * What the school charges and what it takes off: the fee catalogue, the price
 * list for each year, and the reductions offered against it.
 *
 * Scope boundary — this module currently owns **pricing configuration only**.
 * Invoices, receipts, instalment plans and outstanding balances are per-student
 * records; they arrive with enrolment and will live here too, but none of them
 * can exist before there is a Student table.
 *
 * No nav or permissions yet — tables and enums only.
 */
export const billingModule = defineModule({
  id: "billing",
  schemaFolder: "billing",
});
