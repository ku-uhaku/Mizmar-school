/**
 * Allowed values for the enum-like columns of `ActivityLog`.
 *
 * Pure data: imported by the capture layer in `lib/audit.ts`, by the queries and
 * by the client components, so it may not reach for the database or React.
 */

/**
 * What kind of thing happened.
 *
 * The first six are written by the client extension and mirror Prisma's own
 * operations; the last four are recorded by hand, because nothing lands in a
 * table when a login fails or a permission is refused and those are exactly the
 * events a trail is read for.
 */
export const ACTIVITY_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "CREATE_MANY",
  "UPDATE_MANY",
  "DELETE_MANY",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGIN_BLOCKED",
  "LOGOUT",
  "DENIED",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/**
 * The actions that say nothing was written — a refused permission, a rejected
 * password. Gated behind `audit.security` rather than `audit.view`: knowing who
 * tried to reach what is a different thing from knowing who changed what, and a
 * school may well want a secretary to read the second without the first.
 */
export const SECURITY_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGIN_BLOCKED",
  "LOGOUT",
  "DENIED",
] as const satisfies readonly ActivityAction[];

export function isSecurityAction(action: string): boolean {
  return (SECURITY_ACTIONS as readonly string[]).includes(action);
}

/**
 * The broad area of the app an entry belongs to.
 *
 * The filter offers these rather than the eighty-odd table names: a bursar
 * looking for "what happened to the money yesterday" should not have to know
 * that a receipt is a `Payment`, a `PaymentAllocation` and a `PaymentTender`.
 * The table name is still shown on the row, and still filterable.
 */
export const ACTIVITY_DOMAINS = [
  "access",
  "organization",
  "vieScolaire",
  "timetable",
  "finance",
  "rh",
  "transport",
  "configuration",
  "security",
] as const;

export type ActivityDomain = (typeof ACTIVITY_DOMAINS)[number];

/** Pseudo-entities: events that changed no row of their own. */
export const SESSION_ENTITY = "Session";
export const ACCESS_ENTITY = "Access";
