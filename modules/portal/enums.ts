/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/portal/*.prisma`.
 *
 * Pure data: the phone mirrors these in `mobile/src/api/types.ts`.
 */

/**
 * The parts of the parent space that can have something new in them.
 *
 *   EVENTS   announcements the school published
 *   CHAT     messages in a channel this household may read
 *   MARKS    marks on a validated paper
 *   REMARKS  carnet lines a teacher released to the family
 *
 * Four, and each one is a screen. A topic that did not map to somewhere a
 * parent can be sent would be a badge with nowhere to go.
 */
export const SEEN_TOPICS = ["EVENTS", "CHAT", "MARKS", "REMARKS"] as const;
export type SeenTopic = (typeof SEEN_TOPICS)[number];

export function isSeenTopic(value: string): value is SeenTopic {
  return (SEEN_TOPICS as readonly string[]).includes(value);
}

/**
 * What a badge shows when nobody has ever looked.
 *
 * A brand-new account has no watermark, and treating that as "everything since
 * the beginning of time is new" would open the app on a badge of four hundred.
 * Counting only the last fortnight is what a person means by "new" anyway.
 */
export const FIRST_LOOK_WINDOW_DAYS = 14;

export function firstLookSince(now: Date = new Date()): Date {
  const since = new Date(now);
  since.setDate(since.getDate() - FIRST_LOOK_WINDOW_DAYS);
  return since;
}
