/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/transport/*.prisma` — plus the small amount of
 * arithmetic the bus needs.
 *
 * Pure data and pure functions: this crosses to the client, where the line
 * screen shows the same seats-remaining figure the server enforces. A form that
 * counted a full bus differently from the action refusing the seat would be
 * worse than no count at all.
 */

/** Whether a vehicle may carry children today. */
export const VEHICLE_STATUSES = ["ACTIVE", "MAINTENANCE", "RETIRED"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/** Statuses that mean the bus can actually run. */
export const ROADWORTHY_STATUSES: readonly VehicleStatus[] = ["ACTIVE"];

/**
 * Which way a line runs, or which way a pupil rides.
 *
 *   MORNING    ramassage — homes to school
 *   AFTERNOON  the return
 *   BOTH       the ordinary case
 *
 * Charged differently by most schools, which is why a pupil dropped off by the
 * bus and collected by a parent is a first-class case rather than a note.
 */
export const TRANSPORT_DIRECTIONS = ["MORNING", "AFTERNOON", "BOTH"] as const;
export type TransportDirection = (typeof TRANSPORT_DIRECTIONS)[number];

/**
 * Where an abonnement stands.
 *
 *   ACTIVE     riding
 *   SUSPENDED  stopped for a while, keeps its seat
 *   CANCELLED  off the bus, seat freed
 */
export const SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Subscriptions that occupy a seat. SUSPENDED still does — see the note above. */
export const SEAT_HOLDING_STATUSES: readonly SubscriptionStatus[] = [
  "ACTIVE",
  "SUSPENDED",
];

/**
 * Who to name as the driver of a bus.
 *
 * A vehicle carries both an employee link and a free-text name — see the note on
 * `Vehicle.driverId`. The employee wins when there is one, because that name is
 * maintained in one place and the text is a note somebody typed once. Decided
 * here rather than in each screen so the fleet list, the line card and the route
 * page cannot show three different answers for the same bus.
 */
export function driverLabel(
  staffName: string | null,
  driverName: string | null,
): string | null {
  return staffName ?? driverName;
}

/**
 * How soon a paper is treated as expiring, in days.
 *
 * Thirty days is roughly the notice a school needs to book a visite technique
 * and still have the bus on the road on Monday.
 */
export const EXPIRY_WARNING_DAYS = 30;

/**
 * Whether a compliance date needs attention: already past, or close enough to
 * matter. Null dates are not warnings — an unknown date is a gap in the record,
 * which the screen says separately.
 */
export function expiryState(
  date: Date | string | null,
  now: Date = new Date(),
): "EXPIRED" | "SOON" | "OK" | "UNKNOWN" {
  if (!date) return "UNKNOWN";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "UNKNOWN";

  const days = Math.floor((value.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRY_WARNING_DAYS) return "SOON";
  return "OK";
}

/**
 * How many seats a line offers: its own cap when it declares one, otherwise the
 * vehicle's.
 *
 * A line with no bus yet offers none — not "unlimited". Planning a route before
 * allocating a vehicle is ordinary, but letting families onto it would be
 * selling seats that do not exist.
 */
export function seatsOnRoute(
  routeCapacity: number | null,
  vehicleSeatCount: number | null,
): number {
  if (routeCapacity !== null) return routeCapacity;
  return vehicleSeatCount ?? 0;
}

/** Seats left, floored at zero — an over-full bus is a data problem, not a negative. */
export function seatsRemaining(seats: number, taken: number): number {
  return Math.max(0, seats - taken);
}

/**
 * What one pupil pays for the bus over the year.
 *
 * A one-way rider pays half. Rounded once, here, so the échéancier and the
 * screen quoting the family cannot arrive at figures a centime apart — the same
 * rule `applyPercentBps` follows on the discount side.
 */
export function priceForDirection(
  zoneAmountCentimes: number,
  direction: TransportDirection,
): number {
  if (direction === "BOTH") return zoneAmountCentimes;
  return Math.round(zoneAmountCentimes / 2);
}

/** `HH:MM`, or null. Guards the times the stop list is ordered and printed by. */
export function isTimeOfDay(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
