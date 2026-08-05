/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/treasury/*.prisma` — plus the money arithmetic the
 * caisse is balanced with.
 *
 * Pure data and pure functions: this file crosses to the client, where the
 * encaissement screen previews a receipt's total with the very same functions
 * the server posts it with. A form that added up its lines differently from the
 * action that saves them would hand a parent a receipt for the wrong amount.
 *
 * Every amount here is an integer number of **centimes of dirham**, exactly as
 * in `modules/billing/enums.ts`. Nothing is a float: these numbers are summed,
 * split across children and reconciled against a drawer at the end of the day.
 */

import { nullableKey } from "@/lib/db-keys";

/**
 * Which way the money went.
 *
 *   ENCAISSEMENT  money in — a family paying fees, or any other receipt
 *   DECAISSEMENT  money out — a salary, a supplier, an expense
 *   TRANSFERT     money moved without being earned or spent: between two tills,
 *                 or from a till to the bank
 *
 * A transfer is deliberately not two half-operations of the other two kinds. It
 * changes no total the school reports on, and counting it as income at one end
 * and expenditure at the other would overstate both.
 */
export const OPERATION_KINDS = [
  "ENCAISSEMENT",
  "DECAISSEMENT",
  "TRANSFERT",
] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

/**
 * Which side of the ledger a rubrique may be posted on — see
 * OperationCategory.kind.
 *
 * Three values rather than a boolean because "Régularisation" and "Transfert
 * interne" genuinely belong on both sides, and forcing a school to declare two
 * rubriques with the same name to say so is how charts of accounts rot.
 */
export const CATEGORY_KINDS = ["IN", "OUT", "BOTH"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/**
 * The rubrique kinds a given screen may offer. BOTH is always among them.
 *
 * Returns the set rather than testing one row, because every caller is building
 * a `where` clause and not filtering in memory — the encaissement and the
 * décaissement narrow their pickers with it, and the actions re-derive the
 * submitted rubrique against the same list. Written as a predicate, it was
 * called by nobody and both sides hardcoded `[side, "BOTH"]` instead.
 */
export function categoryKindsFor(
  side: "IN" | "OUT",
): readonly CategoryKind[] {
  return [side, "BOTH"];
}

/**
 * How money changed hands.
 *
 *   CASH           espèces
 *   CHEQUE         chèque — not money until it clears, see the Cheque table
 *   BANK_TRANSFER  virement bancaire
 *   MIXED          several of the above on one receipt, itemised in its tenders
 *
 * MIXED is a summary for the ledger, never a tender in its own right — see
 * `TENDER_METHODS`.
 */
export const PAYMENT_METHODS = [
  "CASH",
  "CHEQUE",
  "BANK_TRANSFER",
  "MIXED",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * The methods a single tender may use. MIXED is excluded by construction: a
 * receipt is mixed by *having several tenders*, so a tender that called itself
 * mixed would be a row that failed to say what it actually was.
 */
export const TENDER_METHODS = ["CASH", "CHEQUE", "BANK_TRANSFER"] as const;
export type TenderMethod = (typeof TENDER_METHODS)[number];

/** Whether a till is open for business. */
export const SESSION_STATUSES = ["OPEN", "CLOSED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * Midnight at the start of the day a moment falls in, in the server's zone.
 *
 * A shift is bounded by the *calendar day*, not by twenty-four hours. A drawer
 * opened at 08h00 and still open at 09h00 the next morning has been open for
 * twenty-five hours, but that is not what makes it wrong — what makes it wrong
 * is that it belongs to yesterday, and yesterday has been counted, banked and
 * reported on.
 */
export function startOfDay(moment: Date): Date {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
}

/**
 * Whether a session belongs to a day that has ended.
 *
 * The one rule that makes a caisse's daily figures mean anything. A session
 * left open overnight cannot simply carry on: every movement posted into it
 * would be dated today and counted against yesterday's drawer, so the day's
 * takings would be wrong at both ends and no count would ever reconcile.
 *
 * The remedy is not to refuse the *session* — it is already open and it holds
 * real money — but to refuse to post into it, close it as uncounted, and make
 * whoever holds it open today's. See `resolveCashSession`.
 */
export function isStaleSession(openedAt: Date, now: Date = new Date()): boolean {
  return startOfDay(openedAt).getTime() < startOfDay(now).getTime();
}

/**
 * Whether a movement still counts.
 *
 * CANCELLED rows stay in the ledger and are excluded from every total. Nothing
 * is ever deleted: the correcting entry points back at what it reversed, so the
 * history reads as what happened rather than as what somebody wishes had.
 */
export const OPERATION_STATUSES = ["POSTED", "CANCELLED"] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

/** Same two states, for a receipt. */
export const PAYMENT_STATUSES = ["POSTED", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * What kind of thing the school buys from a supplier.
 *
 * The only reason it exists is to split the pickers: a UTILITY is billed for a
 * *period* and belongs on the factures screen, a VENDOR is bought from on a
 * *day* and belongs on the achats one. Everything else is a supplier like any
 * other and appears on whichever screen fits.
 */
export const SUPPLIER_KINDS = [
  /** Lydec, Amendis, Maroc Telecom — billed monthly against a contract. */
  "UTILITY",
  /** The papeterie, the computer shop — bought from on the day. */
  "VENDOR",
  /** The landlord. Billed for a period, like a utility. */
  "LANDLORD",
  /** Cleaning, security, the accountant — a service billed for a period. */
  "SERVICE",
  "OTHER",
] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];

/** A cheque the school holds, or one it has written — see Cheque.direction. */
export const CHEQUE_DIRECTIONS = ["INCOMING", "OUTGOING"] as const;
export type ChequeDirection = (typeof CHEQUE_DIRECTIONS)[number];

/**
 * The life of a cheque.
 *
 *   PENDING    held, not yet banked — the pile in the safe
 *   DEPOSITED  remis en banque, waiting to clear
 *   CASHED     cleared; this is the moment it became money
 *   BOUNCED    came back unpaid — the fees it settled are owed again
 *   RETURNED   handed back to the family, usually against cash instead
 *   CANCELLED  entered in error
 *
 * Only CASHED and DEPOSITED are anything a bank would recognise; the rest exist
 * because the bursar has to answer for the drawer between those moments.
 */
export const CHEQUE_STATUSES = [
  "PENDING",
  "DEPOSITED",
  "CASHED",
  "BOUNCED",
  "RETURNED",
  "CANCELLED",
] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

/**
 * Where a cheque may go from where it is.
 *
 * ── Why this is a table and not a chain of `if`s ────────────────────────────
 * The menu on the suivi des chèques and the guard in `setChequeStatus` are
 * generated from this one declaration, so a screen cannot offer a move the
 * service refuses — nor, which was the real problem, quietly hide moves the
 * service would happily have made. Same pattern as `REVIEW_TRANSITIONS` in
 * modules/supplies/enums.ts.
 *
 * ── The moves a school actually makes ──────────────────────────────────────
 * A cheque in the drawer can be banked, cashed over the counter, handed back to
 * the family, or struck out if it was typed in error. A banked one clears or
 * comes back. **A bounced one is very often re-presented** — the family says
 * "représentez-le le 5", and until now the screen had no way to say that, which
 * left the cheque stranded in a terminal state it had not really reached.
 *
 * CASHED, RETURNED and CANCELLED are the genuine ends: the money arrived, the
 * paper went back, or the row should never have existed. Reversing any of those
 * is a correction of the *receipt*, not of the cheque — see `cancelPayment`.
 */
export const CHEQUE_TRANSITIONS = {
  PENDING: ["DEPOSITED", "CASHED", "RETURNED", "CANCELLED"],
  DEPOSITED: ["CASHED", "BOUNCED", "RETURNED"],
  // Re-presented, given back, or written off.
  BOUNCED: ["DEPOSITED", "RETURNED", "CANCELLED"],
  CASHED: [],
  RETURNED: [],
  CANCELLED: [],
  // `satisfies` rather than an annotation, and this is load-bearing twice over:
  // it makes a status added to CHEQUE_STATUSES without a row here a compile
  // error, *and* it keeps the literal types, which is what lets `ChequeMove`
  // below name the reachable targets. Annotating it `Record<string, …>` — which
  // is what it said — gave neither, so the menu that claims to be generated
  // from this table would have crashed on a status nobody had drawn.
} as const satisfies Record<ChequeStatus, readonly ChequeStatus[]>;

/**
 * A status a cheque can actually be moved *to*.
 *
 * Derived from the table rather than restated, so it excludes PENDING — nothing
 * ever returns to the pile — and any screen drawing the moves has to cover
 * exactly these and no more.
 */
export type ChequeMove = (typeof CHEQUE_TRANSITIONS)[ChequeStatus][number];

/** Whether `value` is one of the declared statuses. */
export function isChequeStatus(value: string): value is ChequeStatus {
  return (CHEQUE_STATUSES as readonly string[]).includes(value);
}

/**
 * The moves offerable from where a cheque is now.
 *
 * Takes the column's `string` and narrows it here, so neither the screen nor
 * the service has to cast: a status the code does not know offers nothing
 * rather than being asserted into the union and indexing off the end.
 */
export function chequeMovesFrom(status: string): readonly ChequeMove[] {
  return isChequeStatus(status) ? CHEQUE_TRANSITIONS[status] : [];
}

/** Whether a cheque may move to `next` from where it is now. */
export function canMoveCheque(from: string, next: string): boolean {
  return (chequeMovesFrom(from) as readonly string[]).includes(next);
}

/** Cheques still expected to turn into money — what "en attente" counts. */
export const OPEN_CHEQUE_STATUSES: readonly ChequeStatus[] = [
  "PENDING",
  "DEPOSITED",
];

/**
 * Cheques that will not: the ones the follow-up screen flags in red.
 *
 * Deliberately one short of `UNPAID_CHEQUE_ENDINGS`. All three of those undo the
 * receipt, but CANCELLED is a cashier striking out their own typing, and drawing
 * every corrected keystroke in red is how a screen teaches people to ignore red.
 * What is flagged here is a cheque the school expected money from and did not
 * get.
 */
export const FAILED_CHEQUE_STATUSES: readonly ChequeStatus[] = [
  "BOUNCED",
  "RETURNED",
];

/**
 * The three ends a cheque can come to without ever having been money.
 *
 * Read from the receipt's side they are one fact — *the paper is not going to
 * pay* — so all three undo it, through the same unwind. Only BOUNCED used to,
 * which is the bug this list closes: a cheque handed back or struck out left
 * the receipt it settled standing, so the family still read as having paid, the
 * charges never came back onto the schedule, and the day's takings still
 * counted money the school was never going to see.
 *
 * CASHED is the one ending that is not here, because it is the one where the
 * money actually arrived.
 */
export const UNPAID_CHEQUE_ENDINGS: readonly ChequeStatus[] = [
  "BOUNCED",
  "RETURNED",
  "CANCELLED",
];

/**
 * Whether moving a cheque to `status` undoes the receipt it settled.
 *
 * Only ever true of an incoming cheque that actually settled one — the caller
 * still has to establish that. Outgoing cheques and cheques tracked on their
 * own settle nothing, so ending them is bookkeeping and nothing more.
 */
export function chequeUndoesReceipt(status: string): boolean {
  return UNPAID_CHEQUE_ENDINGS.includes(status as ChequeStatus);
}

/**
 * Where a transfer's money is going. Not a column — the destination is either a
 * till (`counterpartRegisterId`) or the bank (`bankAccountLabel`) — but the form
 * needs a name for the choice.
 */
export const TRANSFER_TARGETS = ["REGISTER", "BANK"] as const;
export type TransferTarget = (typeof TRANSFER_TARGETS)[number];

// ── Money ────────────────────────────────────────────────────────────────────

export function centimesToDirhams(centimes: number): number {
  return centimes / 100;
}

export function dirhamsToCentimes(dirhams: number): number {
  return Math.round(dirhams * 100);
}

/**
 * How much cash an operation moves in the drawer, signed — positive in,
 * negative out.
 *
 * The one place this rule is written down, because it is the rule the whole
 * caisse balances on. Anything that is not cash moves nothing: a cheque sits in
 * the safe and a virement never comes near the desk, so neither may shift the
 * figure the cashier will be asked to count.
 */
export function cashImpactOf(
  kind: OperationKind,
  method: PaymentMethod,
  cashPortionCentimes: number,
): number {
  if (method !== "CASH" && method !== "MIXED") return 0;
  return kind === "ENCAISSEMENT" ? cashPortionCentimes : -cashPortionCentimes;
}

/**
 * The method to record for a receipt, given the forms of money it was paid in.
 *
 * One tender keeps its own name so the ordinary case reads plainly in the
 * ledger; two or more become MIXED, and the detail stays in the tenders.
 */
export function summariseMethod(
  methods: readonly TenderMethod[],
): PaymentMethod {
  const distinct = Array.from(new Set(methods));
  if (distinct.length === 1) return distinct[0];
  return "MIXED";
}

/** Adds up a set of amounts. Named so the intent reads at the call site. */
export function sumCentimes(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/**
 * What a schedule line still owes: what it costs, less what has been paid
 * against it. Never negative — an over-allocation is a bug the service layer
 * refuses, and flooring here keeps one from poisoning a whole family's total.
 */
export function outstandingOf(
  amountCentimes: number,
  paidCentimes: number,
): number {
  return Math.max(0, amountCentimes - paidCentimes);
}

/**
 * What a drawer should hold: the float it opened with, plus every posted cash
 * movement since.
 *
 * Cancelled operations are the caller's business to exclude — this takes the
 * impacts it is given, so the same function serves the live figure on screen
 * and the frozen one written at closing time.
 */
export function expectedDrawerTotal(
  openingFloatCentimes: number,
  cashImpacts: readonly number[],
): number {
  return openingFloatCentimes + sumCentimes(cashImpacts);
}

/**
 * Builds `CashSession.openKey`, which is what stops one till being open twice.
 *
 * The register's id while the session is open, null once it closes — so SQLite's
 * "NULLs are distinct" behaviour exempts every closed session from the unique
 * index while admitting only one open one. See lib/db-keys.ts for the general
 * pattern and why a partial index is not an option here.
 */
export function openSessionKey(
  cashRegisterId: string,
  status: SessionStatus,
): string | null {
  return status === "OPEN" ? nullableKey(cashRegisterId) : null;
}

/**
 * Formats a document number: `R-2025-0187` for receipts, `OP-2025-0043` for
 * operations. Sequence is allocated per school and per year by the service.
 */
export function documentCode(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}
