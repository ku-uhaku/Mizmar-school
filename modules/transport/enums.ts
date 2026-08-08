import { nullableKey } from "@/lib/db-keys";

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
 * Which way one scheduled run goes.
 *
 * Deliberately narrower than TRANSPORT_DIRECTIONS, which also has BOTH: a
 * departure happens once and goes one way. BOTH belongs to an *abonnement* —
 * the child who rides morning and evening — and a run claiming it would be two
 * buses wearing one row. See prisma/schema/transport/transport-schedule.prisma.
 */
export const SCHEDULE_DIRECTIONS = ["MORNING", "AFTERNOON"] as const;
export type ScheduleDirection = (typeof SCHEDULE_DIRECTIONS)[number];

/**
 * Mirror for the nullable `scheduleId`, so a pupil may hold one abonnement per
 * *run* rather than one per half of the day.
 *
 * A school that sends children home for lunch commonly runs two departures in
 * the same half — a midday return and a separate afternoon pickup, both
 * AFTERNOON — and a full-day rider is expected on both. Keying the unique
 * index on `direction` alone could not tell those two runs apart; keying it on
 * the named run does. A line with no horaire declared has no run to name, so
 * it falls back to `direction` — the single-departure case `scheduleId` is
 * null for, where one abonnement per half of the day is still the right limit.
 * See lib/db-keys.ts, and `busRegisterScopeKey` below, which mirrors the same
 * column for the same reason.
 */
export function subscriptionScopeKey(
  direction: string,
  scheduleId: string | null | undefined,
): string {
  return scheduleId ? `run:${scheduleId}` : `direction:${direction}`;
}

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

/*
 * There is deliberately no pricing helper here.
 *
 * Transport is charged once, at enrolment, from the price list — one flat fee
 * per rider, whatever quartier they live in and whichever way they travel. The
 * module used to carry pricing zones and halve the fee for a one-way rider;
 * both were a second answer to a question the échéancier had already settled,
 * and the two answers disagreed. What a family owes lives on EnrollmentFee and
 * nowhere else.
 */

/** `HH:MM`, or null. Guards the times the stop list is ordered and printed by. */
export function isTimeOfDay(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * How to name one run in a picker: its code and when it leaves.
 *
 * "M1 · 07:00" rather than the code alone, because a secretary asked to put a
 * child on "M1" has to remember what M1 means and a parent on the phone never
 * knew. Decided here so the enrolment cascade, the circuit screen and the
 * pupil's file cannot label the same run three ways.
 */
export function scheduleLabel(code: string, departureTime: string): string {
  return `${code} · ${departureTime}`;
}

// ── L'appel du bus ───────────────────────────────────────────────────────────

/**
 * Whether a pupil got on the bus.
 *
 *   PRESENT  boarded
 *   LATE     kept the bus waiting — `minutesLate` says how long
 *   ABSENT   never turned up, and nobody had said
 *   EXCUSED  not travelling today, and the family had said so
 *
 * The same four words the classroom register uses, deliberately: a driver and a
 * teacher describing the same child should not have to learn two vocabularies.
 * What they mean here is narrower — this is the kerb, not the classroom, and a
 * child absent from the bus is not thereby absent from school. See the note on
 * TransportAttendance.
 *
 * ABSENT and EXCUSED are apart because at half past seven in the morning they
 * are completely different problems: one is a child unaccounted for and the
 * other is a seat nobody is waiting on.
 */
export const RIDER_ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
] as const;
export type RiderAttendanceStatus =
  (typeof RIDER_ATTENDANCE_STATUSES)[number];

/** Statuses meaning the child was not on the bus. */
export const OFF_BUS_STATUSES: readonly RiderAttendanceStatus[] = [
  "ABSENT",
  "EXCUSED",
];

/** Did they ride at all? LATE counts — they got on. */
export function boarded(status: string): boolean {
  return status === "PRESENT" || status === "LATE";
}

/** Most minutes a bus can sensibly be held before the child has simply missed it. */
export const MAX_MINUTES_WAITED = 30;

/**
 * Mirror for the nullable `scheduleId`, so the unique index on
 * TransportAttendance actually fires.
 *
 * SQLite treats NULLs as distinct, so without this a rider could be marked
 * twice for the same departure and counted absent twice. See lib/db-keys.ts,
 * and `attendanceScopeKey` in modules/classroom/enums.ts, which does the same
 * job for the nullable time slot.
 */
export function busRegisterScopeKey(
  scheduleId: string | null | undefined,
): string {
  return nullableKey(scheduleId);
}

/** What one run's register adds up to — the counts the sheet shows live. */
export type BusRegisterTally = {
  marked: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
};

export function tallyBusRegister(
  entries: readonly { status: string | null }[],
): BusRegisterTally {
  const count = (status: string) =>
    entries.filter((entry) => entry.status === status).length;

  return {
    marked: entries.filter((entry) => entry.status !== null).length,
    present: count("PRESENT"),
    late: count("LATE"),
    absent: count("ABSENT"),
    excused: count("EXCUSED"),
    unmarked: entries.filter((entry) => entry.status === null).length,
  };
}

// ── Consommation ─────────────────────────────────────────────────────────────

/**
 * Where a fuel request has got to.
 *
 *   PENDING   the driver has asked; nobody has decided
 *   APPROVED  agreed, and the décaissement has been posted
 *   REJECTED  refused; kept, never deleted, so a second ask is visibly a second
 *   PAID      the money has actually left the drawer
 *
 * APPROVED and PAID are apart for the same reason SALARY_STATUSES keeps them
 * apart: agreeing to a spend and handing over the notes are two acts, often on
 * two different days, and a school that reconciles a till needs to know which
 * of the two has happened.
 */
export const FUEL_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
] as const;
export type FuelRequestStatus = (typeof FUEL_REQUEST_STATUSES)[number];

/** Statuses that have a décaissement behind them — see `decideFuelRequest`. */
export const SETTLED_FUEL_STATUSES: readonly FuelRequestStatus[] = [
  "APPROVED",
  "PAID",
];

/** Requests that still count as spending on a bus. A refusal never does. */
export const COUNTED_FUEL_STATUSES: readonly FuelRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "PAID",
];

/**
 * Litres are stored as **tenths of a litre** — see the note on
 * `FuelRequest.litresTenths`. These two are the only places the factor appears,
 * so no screen divides by ten on its own and the form and the server cannot
 * disagree about what "45,5" meant.
 */
export const LITRE_TENTHS = 10;

export function litresToTenths(litres: number): number {
  return Math.round(litres * LITRE_TENTHS);
}

export function tenthsToLitres(tenths: number): number {
  return tenths / LITRE_TENTHS;
}

/**
 * Consumption in **tenths of a litre per 100 km**, or null when it cannot be
 * worked out.
 *
 * Null rather than zero for a missing or non-advancing odometer: "we do not
 * know" and "this bus used nothing" are different answers, and a fleet screen
 * showing 0,0 L/100km beside a bus somebody forgot to read the meter on is
 * worse than a blank. Kept in tenths, like the litres it comes from, so the
 * figure is an integer everywhere until it is rendered.
 */
export function consumptionPer100km(
  litresTenths: number,
  distanceKm: number,
): number | null {
  if (distanceKm <= 0 || litresTenths <= 0) return null;
  return Math.round((litresTenths * 100) / distanceKm);
}

// ── Le voyage ────────────────────────────────────────────────────────────────

/**
 * Where a run has got to on the day. See prisma/schema/transport/trip-run.prisma.
 *
 * PLANNED is what generation writes: the horaire says this circuit goes out this
 * morning, and nobody has touched it yet. It is deliberately a real row rather
 * than an absence, because "the 07:00 never left" is the thing an office needs
 * to see, and a missing row looks exactly like a screen nobody opened.
 */
export const TRIP_RUN_STATUSES = [
  "PLANNED",
  "EN_ROUTE",
  "ARRIVED",
  "CANCELLED",
] as const;
export type TripRunStatus = (typeof TRIP_RUN_STATUSES)[number];

/**
 * The moves a run may make, consulted rather than trusted.
 *
 * A voyage goes out and comes back, or it does not go. What is deliberately
 * absent is the way back from ARRIVED: a bus that has returned has returned, and
 * "un-arriving" it would leave the morning's timings meaning nothing. A run
 * closed by mistake is corrected the way a receipt is — by cancelling it with a
 * reason, which is a record rather than an erasure.
 *
 * A run already under way may still be cancelled: a breakdown halfway round is
 * exactly the case, and it is the only honest thing to call it.
 */
export const TRIP_RUN_TRANSITIONS: Record<string, readonly TripRunStatus[]> = {
  PLANNED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: [],
  CANCELLED: [],
};

/**
 * Whether a run may move to `next` from where it is now.
 *
 * `Object.hasOwn` rather than a bare lookup: `TRIP_RUN_TRANSITIONS` is a plain
 * object, so `canMoveTripRun("constructor", …)` resolved to a function, the
 * `?? []` never fired, and calling `.includes` on it threw rather than
 * answering false. Nothing reaches it with such a value — `from` is the run's
 * stored status — and a transition table should still say no rather than
 * explode when asked about a state it has never heard of.
 */
export function canMoveTripRun(from: string, next: string): boolean {
  const allowed = Object.hasOwn(TRIP_RUN_TRANSITIONS, from)
    ? TRIP_RUN_TRANSITIONS[from]
    : undefined;
  return (allowed ?? []).includes(next as TripRunStatus);
}

/** Runs a bus is out on right now — what the board shows at the top. */
export const ACTIVE_TRIP_RUN_STATUSES: readonly TripRunStatus[] = ["EN_ROUTE"];

/**
 * The states in which a voyage shows its passenger list on a phone.
 *
 * A run that has not left shows nothing, which is the point: the départ is what
 * declares which voyage is being made, and the names follow it. ARRIVED is
 * included so a driver can read back and correct what he took — closing the run
 * ends the journey, not the right to fix the register of it.
 *
 * CANCELLED is absent. A voyage that did not happen has no register, and
 * offering one would invite marks against a bus nobody rode.
 */
export const REGISTER_OPEN_STATUSES: readonly string[] = [
  "EN_ROUTE",
  "ARRIVED",
];

// ── La fenêtre du voyage ─────────────────────────────────────────────────────

/**
 * Whether a voyage is at its hour, on the phone in the driver's hand.
 *
 * The board in the office shows the whole day at once and should: somebody
 * planning the afternoon has to see the afternoon. A driver has the opposite
 * need — at 07:00 there is exactly one voyage that concerns him, and a screen
 * offering him the 17:00 return as well is a screen on which the wrong register
 * gets taken. So the phone reads a run's *window* rather than only its status.
 *
 * OPEN is the only state in which a run may be started or its appel marked from
 * a phone; the other two are shown, greyed, so a driver can still see what is
 * coming and what he has already brought back.
 */
export const RUN_WINDOWS = ["UPCOMING", "OPEN", "CLOSED"] as const;
export type RunWindow = (typeof RUN_WINDOWS)[number];

/**
 * How long before the planned departure the phone unlocks a voyage.
 *
 * An hour: long enough that a driver checking his sheet over coffee finds it
 * open, short enough that the 07:00 and a 09:00 navette never both count as
 * "now".
 */
export const RUN_WINDOW_BEFORE_MINUTES = 60;

/**
 * And how long after, before it locks again.
 *
 * Three hours, measured from the *planned* departure rather than the real one,
 * so a bus that left forty minutes late still gets its full round. It is a
 * generous figure on purpose: the cost of closing too early is a driver who
 * cannot mark the child he has in the bus, and the cost of closing too late is
 * only a run staying tappable a while longer.
 */
export const RUN_WINDOW_AFTER_MINUTES = 180;

/**
 * `"07:30"` → `[7, 30]`, and anything else → `[0, 0]`.
 *
 * Written out because the obvious spelling does not fail the way it reads.
 * `"nonsense".split(":").map(Number)` gives `[NaN]`, so the *minutes* come back
 * `undefined` — and `Number.isNaN(undefined)` is false, so a guard written
 * against NaN lets it through to `setHours`, which turns the whole date
 * Invalid. Every comparison against an Invalid Date is false, so the window
 * that was supposed to fail CLOSED failed **OPEN**: a run with an unreadable or
 * empty departure was tappable on a driver's phone at any hour of any day,
 * including yesterday's and next week's.
 *
 * So the shape is checked before it is read rather than patched afterwards.
 * `"0700"` is the case that shows why: it parses as the finite number 700, and
 * `setHours(700)` rolls the date a month forward instead of failing.
 */
function wallClock(time: string): [hours: number, minutes: number] {
  if (!isTimeOfDay(time)) return [0, 0];

  const [hours, minutes] = time.split(":");
  return [Number(hours), Number(minutes)];
}

/**
 * Where a run stands against the clock.
 *
 * `date` is the run's own day at midnight and `plannedDepartureTime` its
 * wall-clock "HH:MM" — the two are combined here rather than stored together,
 * for the reason given on RouteStop.pickupTime. A run belonging to another day
 * is CLOSED whatever the hour says, which is what keeps yesterday's 07:00 from
 * reopening at seven this morning.
 *
 * Pure, and takes `now` rather than reading the clock, so the server can hand
 * the answer to the phone in the DTO and the same function can be tested.
 */
export function tripRunWindow(
  date: Date,
  plannedDepartureTime: string,
  now: Date,
): RunWindow {
  const planned = new Date(date);
  // An unreadable time leaves the run at its day's midnight, which puts the
  // window over the small hours and reads CLOSED for the rest of the day — the
  // safe way round for a column no form should have been able to corrupt.
  const [hours, minutes] = wallClock(plannedDepartureTime);
  planned.setHours(hours, minutes, 0, 0);

  const offsetMinutes = (now.getTime() - planned.getTime()) / 60_000;

  if (offsetMinutes < -RUN_WINDOW_BEFORE_MINUTES) return "UPCOMING";
  if (offsetMinutes > RUN_WINDOW_AFTER_MINUTES) return "CLOSED";
  return "OPEN";
}

/**
 * How late the bus pulled out, in minutes, or null when it has not.
 *
 * Measured against `plannedDepartureTime` as copied onto the run, never against
 * the horaire as it reads today — see the note on that column. Negative means
 * early, and is kept rather than clamped: a circuit that habitually leaves four
 * minutes early is a finding, not a rounding error.
 */
export function departureDelayMinutes(
  plannedDepartureTime: string,
  startedAt: Date | null,
): number | null {
  if (!startedAt) return null;
  // The same `undefined`-not-NaN trap as `tripRunWindow`: a time with no colon
  // used to reach `setHours` and give back a delay of NaN, which renders as
  // "NaN min late" rather than as no answer.
  if (!isTimeOfDay(plannedDepartureTime)) return null;

  const [hours, minutes] = wallClock(plannedDepartureTime);

  // Compared in the run's own local day: the planned time is wall-clock text
  // and the stamp is an instant, so the two only line up on the same date.
  const planned = new Date(startedAt);
  planned.setHours(hours, minutes, 0, 0);

  return Math.round((startedAt.getTime() - planned.getTime()) / 60_000);
}
