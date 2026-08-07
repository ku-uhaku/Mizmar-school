/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/events/*.prisma`. Labels live in `i18n/*.ts` under
 * `eventOptions`.
 *
 * Pure data and pure functions: this crosses to the client, where the form
 * decides whether to offer a time field using the very same predicate the
 * portal uses to decide whether to print one.
 */

/**
 * What kind of thing is being announced.
 *
 * Short on purpose. The list exists so a parent's screen can put an icon
 * against a line and a school can filter its own calendar — not to classify
 * every occasion a school might hold. Anything else is OTHER with a title.
 */
export const EVENT_KINDS = [
  "MEETING",
  "OUTING",
  "CEREMONY",
  "EXAM",
  "HOLIDAY_INFO",
  "OTHER",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * Where an announcement has got to.
 *
 *   DRAFT      being prepared; no family can see it
 *   PUBLISHED  announced — this is the only status the portal reads
 *   CANCELLED  called off after it was announced
 *
 * CANCELLED is kept and shown rather than deleted: a réunion called off after
 * families were told has to stay visible saying so, or a parent turns up to a
 * locked gate. See the note on the column.
 */
export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The statuses a family may ever see. The portal filters on exactly this. */
export const VISIBLE_EVENT_STATUSES: readonly EventStatus[] = [
  "PUBLISHED",
  "CANCELLED",
];

/** Whether a family may see an event in this status. */
export function isVisibleToFamilies(status: string): boolean {
  return VISIBLE_EVENT_STATUSES.includes(status as EventStatus);
}

/** Whether publishing is a move this event can still make. */
export function isPublishable(status: string): boolean {
  return status === "DRAFT";
}

/** Whether it can still be called off — only something already announced can. */
export function isCancellable(status: string): boolean {
  return status === "PUBLISHED";
}

// ── Dates ────────────────────────────────────────────────────────────────────

/**
 * Midnight of the day a moment falls in, in local time.
 *
 * An all-day event is normalised through this on write, so "le 12 mars" is
 * stored as the 12th at 00:00 and not as whatever o'clock the secretary
 * happened to save at. Local rather than UTC for the same reason the register
 * is — see `startOfDay` in modules/hr/enums.ts.
 */
export function startOfDay(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** The last instant of that day, for an all-day event's end. */
export function endOfDay(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Whether an event is still to come, as of `now`.
 *
 * Reads `endsAt` when there is one, so a three-day sortie stays "upcoming" on
 * its second morning instead of dropping off a parent's screen the moment it
 * begins.
 */
export function isUpcoming(
  event: { startsAt: Date; endsAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (event.endsAt ?? event.startsAt) >= now;
}

/** Whether the event spans more than the one day. */
export function spansDays(event: {
  startsAt: Date;
  endsAt: Date | null;
}): boolean {
  if (!event.endsAt) return false;
  return startOfDay(event.startsAt).getTime() !== startOfDay(event.endsAt).getTime();
}
