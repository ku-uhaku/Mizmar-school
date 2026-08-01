/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/supplies/*.prisma`. Labels live in `i18n/*.ts` under
 * `supplyOptions`.
 */

/**
 * Where a liste de fournitures has got to.
 *
 *   DRAFT      the teacher is still writing it; nobody else need look
 *   SUBMITTED  handed to the office, waiting on a decision
 *   APPROVED   released — the only status a family may ever see
 *   REJECTED   refused, with a reason the teacher can read and act on
 *
 * REJECTED is a status rather than a deletion on purpose: a list that simply
 * vanished would be rewritten identically the following week, and the reason it
 * was refused is the only thing that stops that.
 */
export const SUPPLY_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;
export type SupplyStatus = (typeof SUPPLY_STATUSES)[number];

/** The only status whose contents reach a family. */
export function isVisibleToFamilies(status: string): boolean {
  return status === "APPROVED";
}

/**
 * Whether the author may still edit the list.
 *
 * An approved list is closed to its author: it has been agreed and families may
 * already have bought against it, so changing it is a new decision and a new
 * review. A rejected one stays editable, because acting on the reason is the
 * whole point of sending it back.
 */
export function isEditableByAuthor(status: string): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

/**
 * The statuses the office can move a list *to*, from where it is now.
 *
 * Expressed as a table rather than scattered `if`s so the action and the UI
 * cannot disagree about what buttons should exist — a screen offering a
 * transition the service refuses is worse than no button at all.
 */
export const REVIEW_TRANSITIONS: Record<string, readonly SupplyStatus[]> = {
  DRAFT: [],
  // Approving or refusing is the decision the office was asked for.
  SUBMITTED: ["APPROVED", "REJECTED"],
  // An approved list can still be withdrawn — a price rise, a change of mind —
  // which takes it back to the office's own queue rather than to the teacher.
  APPROVED: ["SUBMITTED"],
  REJECTED: ["APPROVED"],
};
