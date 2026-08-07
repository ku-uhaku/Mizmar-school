# 31 — `transport`

**Prereqs:** 14 (geography), 21 (enrolment), 26 (treasury), 32 can come after.
**Tables:** `Vehicle`, `TransportRoute`, `TransportSchedule`, `RouteSchedule`,
`RouteStop`, `RouteNeighbourhood`, `TransportSubscription`, `TripRun`,
`TransportAttendance`, `FuelRequest`.
**Routes:** `/transport`, `/transport/routes`, `/transport/routes/[routeId]`,
`/transport/voyages`, `/transport/fleet`, `/transport/attendance`,
`/transport/consumption`.

---

Ten tables. Build them in three passes: fleet & routes, then subscriptions, then
runs & fuel. Verify between passes.

## Pass 1 — fleet and routes

**`Vehicle`** — `schoolId` (Cascade), `registration`, `make?`, `model?`,
`modelYear Int?`, `seatCount Int`, `status` (`ACTIVE | MAINTENANCE | RETIRED`),
`insuranceExpiresOn?`, `inspectionExpiresOn?`, `driverId?` (→ `Staff`, SetNull),
`driverName?`, `driverPhone?`, `attendantId?` (→ `Staff`, SetNull),
`attendantName?`, `attendantPhone?`, `notes?`.
`@@unique([schoolId, registration])`.
The `*Name`/`*Phone` columns exist because a school runs buses before it has HR
records. When `driverId` is set it wins; the text is the fallback. Comment it.

**`TransportSchedule`** — a departure time, reusable across routes.
`schoolYearId` (Cascade), `code`, `name`, `direction` (`MORNING | AFTERNOON`),
`departureTime String "HH:mm"`, `arrivalTime?`, `position`, `isActive`.
`@@unique([schoolYearId, code])`.

**`TransportRoute`** — `schoolYearId` (Cascade), `code`, `name`, `nameAr?`,
`direction` (`MORNING | AFTERNOON | BOTH`), `vehicleId?` (SetNull),
`capacity Int?`, `isActive`, `notes?`. `@@unique([schoolYearId, code])`.

**`RouteSchedule`** — the many-to-many, `@@unique([routeId, scheduleId])`.
**`RouteStop`** — `routeId` (Cascade), `name`, `nameAr?`, `landmark?`,
`neighbourhoodId?` (**Restrict**), `position`, `pickupTime?`, `dropoffTime?`.
`@@unique([routeId, name])`.
**`RouteNeighbourhood`** — which quarters a route serves, for suggesting a route
when a pupil enrols. `@@unique([routeId, neighbourhoodId])`.

## Pass 2 — subscriptions

**`TransportSubscription`** — `enrollmentId` (Cascade — a bus pass is
year-specific), `routeId` (**Restrict**), `stopId` (**Restrict**),
`direction` (`MORNING | AFTERNOON | BOTH`), `scheduleId?` (SetNull),
`status` (`ACTIVE | SUSPENDED | ENDED`), `startsOn`, `endsOn?`, `notes?`,
**`scopeKey`** = `nullableKey(scheduleId)`. `@@unique([enrollmentId, scopeKey])`.

**Invariants:** the stop belongs to the route; the route and the enrolment are in
the same year; occupancy against `TransportRoute.capacity` (or the vehicle's
`seatCount`) is checked and **warned** on, not blocked. When a subscription is
created, `Enrollment.usesTransport` is set in the same transaction — one writer,
as always. The transport fee itself is a `FeeType` and belongs to `billing`;
this module never writes an `EnrollmentFee`.

## Pass 3 — runs, register, fuel

**`TripRun`** — one actual journey. `routeId` (**Restrict**), `scheduleId`
(**Restrict**), `date`, `status` (`PLANNED | DEPARTED | ARRIVED | CANCELLED`),
`plannedDepartureTime String`, `startedAt?`, `startedById?` (SetNull),
`arrivedAt?`, `arrivedById?` (SetNull), `vehicleId?` (SetNull), `cancelReason?`,
`notes?`. **`@@unique([routeId, scheduleId, date])`** — one run per route per
schedule per day, so a double tap cannot create two.

**`TransportAttendance`** — `subscriptionId` (Cascade), `date`, `scheduleId?`
(SetNull), `status` (`PRESENT | ABSENT | LATE | NOT_BOARDED`), `minutesLate Int?`,
`reason?`, `isJustified`, `recordedById?` (SetNull), **`scopeKey`** =
`nullableKey(scheduleId)`. `@@unique([subscriptionId, date, scopeKey])`.

**`FuelRequest`** — `schoolId` (Cascade), `vehicleId` (**Restrict**),
`requestedById?` (→ `Staff`, SetNull), `requestedByName?`, `occurredOn`,
**`litresTenths Int`** (tenths of a litre — same integer discipline as centimes),
`odometerKm Int?`, `amountCentimes Int`, `status` (`PENDING | APPROVED |
REJECTED | PAID`), `decidedById?` (SetNull), `decidedAt?`,
**`cashOperationId? @unique`** (→ `CashOperation`, SetNull), `notes?`.

Approving a fuel request **does not** move money. Paying it writes a
`DISBURSEMENT` `CashOperation` through `treasury`'s service — never a direct
insert — and links it. The `@unique` means one request cannot be paid twice.
Same pattern as salaries in prompt 32; build it once and reuse the shape.

**Consumption** (`/transport/consumption`) is derived: litres per 100 km from
consecutive odometer readings per vehicle, cost per km, monthly totals. No stored
aggregates.

**Permissions:** `transport.view|manage|subscribe|delete|attendance|fuel`.
School-scoped. `subscribe` is separate so a secretary can enrol a child on a bus
without editing routes.
**Nav:** section `logistique` — `/transport` (10), `/transport/routes` (20),
`/transport/voyages` (25), `/transport/fleet` (30), `/transport/consumption` (60).

**Gate:** build a route with six stops, subscribe fifteen pupils, generate
today's runs, take the register on one, and pay a fuel request. Show me: the
`CashOperation` it created and that the till balance moved; the occupancy warning
at capacity; and that requesting the same run twice returns the existing one.
