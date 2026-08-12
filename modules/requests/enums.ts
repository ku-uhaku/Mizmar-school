/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/requests/*.prisma`. Labels live in `i18n/*.ts` under
 * `requestOptions`.
 *
 * Pure data and pure functions. The parent's phone decides whether to offer the
 * "cancel" button with the same predicate the server uses to accept the move,
 * so a family is never shown a control the office would refuse.
 */

/**
 * Where a request has got to.
 *
 *   PENDING    the family asked; nobody at the school has looked yet
 *   ACCEPTED   the office agreed and named a day to come — see `readyAt`
 *   READY      the paper is written and waiting at the desk
 *   COLLECTED  handed over. Closed
 *   REJECTED   refused, with a reason. Closed
 *   CANCELLED  the family withdrew it. Closed
 *
 * ── Why ACCEPTED and READY are both here ────────────────────────────────────
 * They answer the two different questions a parent actually asks. ACCEPTED says
 * *when to come*: the office has taken the request and named a day, and a
 * parent who turns up before it gets nothing. READY says *come now*: the paper
 * exists and is on the counter. A school that writes an attestation while the
 * parent waits goes straight to READY and never uses the appointment; one that
 * needs the director's signature accepts first and marks it ready when it is
 * signed. Collapsing the two would force every school into whichever half was
 * kept.
 *
 * ── Why nothing is deleted ──────────────────────────────────────────────────
 * A refused request stays, saying it was refused and why. A family that is told
 * nothing assumes the request was lost and files it again, which is how an
 * office ends up with the same demande three times and no record of having
 * answered it once.
 */
export const REQUEST_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "READY",
  "COLLECTED",
  "REJECTED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Statuses that are still the school's to deal with — the office's queue, and
 * the count on the vie scolaire dashboard.
 *
 * READY is open: the paper is written but the family has not come for it, and
 * a pile of uncollected papers is exactly what a school wants to see.
 */
export const OPEN_STATUSES: readonly RequestStatus[] = [
  "PENDING",
  "ACCEPTED",
  "READY",
];

/** Statuses nothing further happens to. */
export const CLOSED_STATUSES: readonly RequestStatus[] = [
  "COLLECTED",
  "REJECTED",
  "CANCELLED",
];

export function isOpen(status: string): boolean {
  return OPEN_STATUSES.includes(status as RequestStatus);
}

export function isClosed(status: string): boolean {
  return CLOSED_STATUSES.includes(status as RequestStatus);
}

/**
 * The moves the office may make, keyed by where the request is now.
 *
 * A table rather than a chain of `if`s because it is the whole workflow in one
 * readable place, and because both sides need it: the server refuses anything
 * not listed here, and the screen offers exactly these buttons. One source, so
 * a button can never appear for a move the server will reject.
 *
 * The rules it encodes, in words:
 *
 *   * a paper can be marked ready without an appointment ever being made —
 *     "or just deal with it", which is what a school writing an attestation on
 *     the spot actually does;
 *   * only a paper that exists can be handed over, so COLLECTED is reachable
 *     from READY and from ACCEPTED (the parent who turns up on the day and the
 *     secretary who writes it there and then);
 *   * a refusal is available right up until the paper is handed over, because
 *     the reason to refuse — the family owes fees, the child left — is often
 *     found while writing it;
 *   * nothing leaves a closed status. Re-opening a refused request would lose
 *     the refusal, and the family should file a new one, which is also what
 *     gives the office a fresh date.
 */
export const OFFICE_MOVES: Record<RequestStatus, readonly RequestStatus[]> = {
  PENDING: ["ACCEPTED", "READY", "REJECTED"],
  ACCEPTED: ["READY", "COLLECTED", "REJECTED"],
  READY: ["COLLECTED", "REJECTED"],
  COLLECTED: [],
  REJECTED: [],
  CANCELLED: [],
};

/** Whether the office may move a request from `from` to `to`. */
export function canMove(from: string, to: string): boolean {
  const moves = OFFICE_MOVES[from as RequestStatus];
  return moves !== undefined && moves.includes(to as RequestStatus);
}

/**
 * Whether the family may still withdraw it.
 *
 * Only before the office has done any work. Once a paper is being written —
 * let alone written — withdrawing it wastes what has already been done and
 * leaves a signed attestation in a drawer, so from ACCEPTED onward the family
 * talks to the school instead of pressing a button.
 */
export function isCancellable(status: string): boolean {
  return status === "PENDING";
}

/** Most copies of one paper a family may ask for in a single request. */
export const MAX_COPIES = 10;

/** Longest a family's reason, or the office's answer, may run. */
export const REASON_MAX = 500;
export const OFFICE_NOTE_MAX = 500;

/**
 * The day a request of this kind would ordinarily be ready, counted from now.
 *
 * A *suggestion* for the date box when the office accepts — the secretary
 * always names the day themselves. Null when the type makes no promise, which
 * leaves the box empty rather than inventing a date the school never committed
 * to.
 */
export function suggestedReadyDate(
  usualDelayDays: number | null,
  from: Date = new Date(),
): Date | null {
  if (usualDelayDays === null || usualDelayDays < 0) return null;
  const date = new Date(from);
  date.setDate(date.getDate() + usualDelayDays);
  // Midday rather than midnight: a request "ready on the 12th" that is stored
  // at 00:00 reads as the 11th in any timezone west of here, and the date is
  // the whole message.
  date.setHours(12, 0, 0, 0);
  return date;
}

/**
 * Whether a request the office promised for a given day is now late.
 *
 * Only ACCEPTED can be late. A READY paper is written — nobody is waiting on
 * the school — and a closed one is done.
 */
export function isOverdue(
  request: { status: string; readyAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (request.status !== "ACCEPTED" || request.readyAt === null) return false;
  return request.readyAt < now;
}
