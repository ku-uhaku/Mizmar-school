import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Writing a list and releasing it are two codes, not one, and that split is the
 * whole feature: a teacher says what the class needs, and somebody answerable
 * for the school decides whether parents will be asked to buy it. Granting both
 * to one role is a school's choice; the codes exist so it can also not.
 */
export const SUPPLY_PERMISSIONS = definePermissions({
  SUPPLY_VIEW: "supply.view",
  /** Writing and submitting a list — the teacher's half. */
  SUPPLY_WRITE: "supply.write",
  /** Approving, refusing or withdrawing one — the office's half. */
  SUPPLY_REVIEW: "supply.review",
  SUPPLY_DELETE: "supply.delete",
});
