import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * The split here follows who actually does the job, not what the tables are.
 * A secretary at the front desk takes money all day (`TREASURY_COLLECT`) and
 * must never be able to pay it out (`TREASURY_DISBURSE`) or cancel a receipt
 * once written (`TREASURY_CANCEL`) — those are the bursar's, and keeping them
 * apart is the whole of a small school's internal control.
 *
 * `TREASURY_SESSION` is separate again: holding the drawer is a shift, and the
 * person who counts it closed is answerable for the variance.
 */
export const TREASURY_PERMISSIONS = definePermissions({
  TREASURY_VIEW: "treasury.view",
  TREASURY_SESSION: "treasury.session",
  TREASURY_COLLECT: "treasury.collect",
  TREASURY_DISBURSE: "treasury.disburse",
  TREASURY_TRANSFER: "treasury.transfer",
  TREASURY_CHEQUES: "treasury.cheques",
  TREASURY_CANCEL: "treasury.cancel",
});
