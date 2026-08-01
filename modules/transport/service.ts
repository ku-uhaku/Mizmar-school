import "server-only";

import { db } from "@/lib/db";
import { generateFeeSchedule } from "@/modules/enrolment/service";
import { recordDisbursement } from "@/modules/treasury/service";
import {
  SEAT_HOLDING_STATUSES,
  driverLabel,
  seatsOnRoute,
  seatsRemaining,
  busRegisterScopeKey,
  type TransportDirection,
  tenthsToLitres,
  type FuelRequestStatus,
  type RiderAttendanceStatus,
  type SubscriptionStatus,
} from "@/modules/transport/enums";

/**
 * Writes and data invariants for the transport module.
 *
 * Two of them matter, and both are things the database cannot say:
 *
 *   1. **A line cannot carry more children than it has seats.** Checked here,
 *      inside the transaction that takes the seat, because two secretaries
 *      subscribing at once would otherwise both see one seat free.
 *   2. **A subscription and the transport bill move together.** Putting a child
 *      on the bus without pricing it, or pricing it without seating them, are
 *      both states somebody has to discover by hand later.
 */

// ── Seats ────────────────────────────────────────────────────────────────────

export type SeatCheck = {
  seats: number;
  taken: number;
  remaining: number;
};

/** How full a line is right now. Read inside the write that depends on it. */
export async function seatCheck(routeId: string): Promise<SeatCheck | null> {
  const route = await db.transportRoute.findUnique({
    where: { id: routeId },
    select: {
      capacity: true,
      vehicle: { select: { seatCount: true } },
      _count: {
        select: {
          subscriptions: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } } },
        },
      },
    },
  });
  if (!route) return null;

  const seats = seatsOnRoute(route.capacity, route.vehicle?.seatCount ?? null);
  const taken = route._count.subscriptions;
  return { seats, taken, remaining: seatsRemaining(seats, taken) };
}

// ── The bill: none of this module's business ─────────────────────────────────
//
// Transport is charged once, at enrolment, from the price list — one flat fee
// per rider. This module used to reprice a pupil's TRANSPORT lines from the
// zone their stop sat in, which meant the price list and the zone list gave two
// different answers and the stop silently won. The zones are gone; what a
// family owes for the bus lives on EnrollmentFee and is decided by the
// `usesTransport` flag the enrolment form already sets.

// ── Subscriptions ────────────────────────────────────────────────────────────

export type SubscribeInput = {
  enrollmentId: string;
  stopId: string;
  direction: TransportDirection;
  status: SubscriptionStatus;
  /** The run they board. Refused unless the line actually makes it. */
  scheduleId: string | null;
  startsOn: Date;
  endsOn: Date | null;
  notes: string | null;
};

/**
 * The run a subscription may record, or null.
 *
 * Re-derived rather than trusted, exactly as the route is derived from the stop
 * above: a schedule id from another line — or another year — would otherwise put
 * a child on a departure that does not serve them. An id that does not check out
 * becomes null rather than an error, because the arrangement is still valid
 * without a named run and refusing the whole subscription over it would be worse
 * than recording it plainly.
 */
async function resolveSchedule(
  routeId: string,
  scheduleId: string | null,
): Promise<string | null> {
  if (!scheduleId) return null;
  const link = await db.routeSchedule.findUnique({
    where: { routeId_scheduleId: { routeId, scheduleId } },
    select: { scheduleId: true },
  });
  return link?.scheduleId ?? null;
}

export type SubscribeFailure = "STOP_UNREACHABLE" | "FULL" | "ALREADY_ON_BOARD";

export type SubscribeResult =
  | { ok: true; id: string; repricedLines: number }
  | { ok: false; reason: SubscribeFailure; remaining?: number };

/**
 * Puts a pupil on a line, and prices it.
 *
 * The route comes from the stop rather than from the request: a stop belongs to
 * exactly one line, so accepting both would let a caller seat a child at a stop
 * the bus does not serve.
 */
export async function subscribeRider(
  input: SubscribeInput,
): Promise<SubscribeResult> {
  const stop = await db.routeStop.findUnique({
    where: { id: input.stopId },
    select: {
      id: true,
      routeId: true,
      route: { select: { schoolYearId: true } },
    },
  });
  if (!stop) return { ok: false, reason: "STOP_UNREACHABLE" };

  // The line must belong to the same year as the enrolment — otherwise a stop
  // id from last year would seat a child on a bus that no longer runs.
  const enrolment = await db.enrollment.findFirst({
    where: { id: input.enrollmentId, schoolYearId: stop.route.schoolYearId },
    select: { id: true },
  });
  if (!enrolment) return { ok: false, reason: "STOP_UNREACHABLE" };

  const existing = await db.transportSubscription.findUnique({
    where: {
      enrollmentId_direction: {
        enrollmentId: input.enrollmentId,
        direction: input.direction,
      },
    },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "ALREADY_ON_BOARD" };

  const seats = await seatCheck(stop.routeId);
  if (!seats) return { ok: false, reason: "STOP_UNREACHABLE" };
  if (
    SEAT_HOLDING_STATUSES.includes(input.status) &&
    seats.remaining <= 0
  ) {
    return { ok: false, reason: "FULL", remaining: 0 };
  }

  const created = await db.transportSubscription.create({
    data: {
      enrollmentId: input.enrollmentId,
      routeId: stop.routeId,
      stopId: stop.id,
      direction: input.direction,
      scheduleId: await resolveSchedule(stop.routeId, input.scheduleId),
      status: input.status,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      notes: input.notes,
    },
    select: { id: true },
  });

  // The flag, and only the flag. It is what the fee schedule is generated from,
  // so a child put on a bus by a secretary who forgot to tick the box at
  // enrolment still ends up billed — see `syncTransportOption`.
  const raisedLines = await syncTransportOption(input.enrollmentId, true);

  return { ok: true, id: created.id, repricedLines: raisedLines };
}

/**
 * Keeps `Enrollment.usesTransport` in step with whether the pupil is on a bus,
 * and raises the transport lines the first time they are.
 *
 * Billing is decided at enrolment: ticking "Transport" is what puts the flat
 * fee on the échéancier. Seating a child at a stop must therefore change
 * nothing in the ordinary case — the lines are already there and
 * `generateFeeSchedule` is idempotent on (enrolment, fee type, instalment), so
 * it adds nothing.
 *
 * It matters in the one case that is not ordinary: a secretary who assigns a
 * circuit without having ticked the box. Without this the child would ride all
 * year unbilled, which is the sort of thing discovered in June. Returns how many
 * lines were raised — zero whenever transport was already on the schedule.
 */
async function syncTransportOption(
  enrollmentId: string,
  usesTransport: boolean,
): Promise<number> {
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { usesTransport },
  });
  if (!usesTransport) return 0;

  const existing = await db.enrollmentFee.count({
    where: { enrollmentId, feeType: { kind: "TRANSPORT" } },
  });
  if (existing > 0) return 0;

  return generateFeeSchedule(enrollmentId);
}

/**
 * Moves a rider to another stop, changes their direction, or suspends them.
 *
 * None of the three changes what they pay: the bus is one flat fee. All that is
 * kept in step is `usesTransport`, so suspending the last abonnement takes the
 * charge off next year's schedule.
 */
export async function updateRider(
  subscriptionId: string,
  input: {
    stopId: string;
    direction: TransportDirection;
    status: SubscriptionStatus;
    scheduleId: string | null;
    startsOn: Date;
    endsOn: Date | null;
    notes: string | null;
  },
): Promise<SubscribeResult> {
  const subscription = await db.transportSubscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, enrollmentId: true, direction: true, status: true },
  });
  if (!subscription) return { ok: false, reason: "STOP_UNREACHABLE" };

  const stop = await db.routeStop.findUnique({
    where: { id: input.stopId },
    select: { id: true, routeId: true },
  });
  if (!stop) return { ok: false, reason: "STOP_UNREACHABLE" };

  await db.transportSubscription.update({
    where: { id: subscriptionId },
    data: {
      routeId: stop.routeId,
      stopId: stop.id,
      direction: input.direction,
      scheduleId: await resolveSchedule(stop.routeId, input.scheduleId),
      status: input.status,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      notes: input.notes,
    },
  });

  const stillRiding = await db.transportSubscription.count({
    where: {
      enrollmentId: subscription.enrollmentId,
      status: { in: [...SEAT_HOLDING_STATUSES] },
    },
  });
  const raisedLines = await syncTransportOption(
    subscription.enrollmentId,
    stillRiding > 0,
  );

  return { ok: true, id: subscriptionId, repricedLines: raisedLines };
}

/**
 * Takes a pupil off the bus.
 *
 * ── What happens to the money ───────────────────────────────────────────────
 * Instalments already paid are left exactly as they are: the family rode the
 * bus in September and October, and rewriting that would make a receipt settle a
 * charge that no longer exists. Future instalments with nothing paid against
 * them are cancelled, which is what stops the school billing for a seat nobody
 * is in. An instalment part-paid is left alone and flagged to the bursar by
 * simply remaining — deciding whether that is a refund or a credit is a
 * conversation, not a rule this code should make up.
 *
 * Returns how many future lines were cancelled.
 */
export async function unsubscribeRider(
  subscriptionId: string,
): Promise<{ cancelledLines: number } | null> {
  const subscription = await db.transportSubscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, enrollmentId: true },
  });
  if (!subscription) return null;

  await db.transportSubscription.delete({ where: { id: subscriptionId } });

  const stillRiding = await db.transportSubscription.count({
    where: {
      enrollmentId: subscription.enrollmentId,
      status: { in: [...SEAT_HOLDING_STATUSES] },
    },
  });

  // Still on another line — they are still a rider, so nothing is cancelled.
  if (stillRiding > 0) return { cancelledLines: 0 };

  await syncTransportOption(subscription.enrollmentId, false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureUnpaid = await db.enrollmentFee.findMany({
    where: {
      enrollmentId: subscription.enrollmentId,
      feeType: { kind: "TRANSPORT" },
      status: "DUE",
      dueDate: { gte: today },
      // Nothing settled against it — see the note above.
      allocations: { none: { payment: { status: "POSTED" } } },
    },
    select: { id: true },
  });

  if (futureUnpaid.length > 0) {
    await db.enrollmentFee.updateMany({
      where: { id: { in: futureUnpaid.map((line) => line.id) } },
      data: { status: "CANCELLED" },
    });
  }

  return { cancelledLines: futureUnpaid.length };
}

// ── Consommation ─────────────────────────────────────────────────────────────

export type FuelDecisionInput = {
  requestId: string;
  schoolId: string;
  /** "APPROVED" | "REJECTED" | "PAID" — PENDING is where a request starts, not
   *  somewhere it is sent back to. */
  status: FuelRequestStatus;
  decidedById: string;
  /** The till the money leaves, when there is an open one. */
  cashSessionId: string | null;
  /** The rubrique to post the décaissement under — carburant. */
  categoryId: string | null;
  notes: string | null;
};

export type FuelDecisionFailure =
  | "NOT_FOUND"
  | "ALREADY_DECIDED"
  | "NOTHING_TO_PAY";

export type FuelDecisionResult =
  | { ok: true; operationId: string | null }
  | { ok: false; reason: FuelDecisionFailure };

/**
 * Decides a driver's fuel request, and — when it is agreed — posts the money.
 *
 * ── Why the two are one call ────────────────────────────────────────────────
 * An approved request with no décaissement behind it is a promise the ledger
 * has never heard of, and a décaissement with no request behind it is a spend
 * nobody signed for. Neither is a state worth being able to reach, so the
 * approval and the movement are written together and the unique index on
 * `cashOperationId` is what stops a double-click paying twice — the same guard
 * `payStaffSalary` leans on.
 *
 * A rejection writes no movement, for the obvious reason. It is still recorded
 * rather than deleted, so a second ask for the same tank reads as a second ask.
 */
export async function decideFuelRequest(
  input: FuelDecisionInput,
): Promise<FuelDecisionResult> {
  const request = await db.fuelRequest.findFirst({
    // Scoped by the school from the working context, never by id alone.
    where: { id: input.requestId, schoolId: input.schoolId },
    select: {
      id: true,
      status: true,
      amountCentimes: true,
      litresTenths: true,
      occurredOn: true,
      cashOperationId: true,
      requestedById: true,
      requestedByName: true,
      vehicle: { select: { registration: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!request) return { ok: false, reason: "NOT_FOUND" };

  // Deciding is once. Re-deciding a settled request would either orphan the
  // first movement or post a second one for the same tank.
  if (request.status !== "PENDING" || request.cashOperationId) {
    return { ok: false, reason: "ALREADY_DECIDED" };
  }

  if (input.status === "REJECTED") {
    await db.fuelRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        decidedById: input.decidedById,
        decidedAt: new Date(),
        notes: input.notes ?? undefined,
      },
    });
    return { ok: true, operationId: null };
  }

  if (request.amountCentimes <= 0) {
    return { ok: false, reason: "NOTHING_TO_PAY" };
  }

  const beneficiaryName =
    driverLabel(
      request.requestedBy
        ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`
        : null,
      request.requestedByName,
    ) ?? request.vehicle.registration;

  const operation = await recordDisbursement({
    schoolId: input.schoolId,
    createdById: input.decidedById,
    cashSessionId: input.cashSessionId,
    categoryId: input.categoryId,
    subcategoryId: null,
    motifId: null,
    bankId: null,
    bankName: null,
    beneficiaryStaffId: request.requestedById,
    beneficiaryName,
    // The bus is in the label because that is what makes the line answerable
    // three months later: "Carburant — 12345-A-6, 45,0 L".
    label: `Carburant — ${request.vehicle.registration}, ${tenthsToLitres(
      request.litresTenths,
    ).toFixed(1)} L`,
    method: "CASH",
    amountCentimes: request.amountCentimes,
    reference: null,
    chequeNumber: null,
    occurredAt: request.occurredOn,
  });

  await db.fuelRequest.update({
    where: { id: request.id },
    data: {
      status: input.status,
      decidedById: input.decidedById,
      decidedAt: new Date(),
      cashOperationId: operation.id,
      notes: input.notes ?? undefined,
    },
  });

  return { ok: true, operationId: operation.id };
}

// ── Assignment ───────────────────────────────────────────────────────────────

/**
 * Replaces the set of quartiers a circuit serves.
 *
 * Wholesale rather than diffed, exactly as the permission matrix is: the form
 * submits the full desired state, so working out what changed would only add a
 * chance to get it wrong. The ids are re-derived against the school first, so a
 * crafted quartier from another tenant matches nothing instead of being linked.
 */
export async function setRouteNeighbourhoods(
  routeId: string,
  schoolId: string,
  neighbourhoodIds: string[],
): Promise<number> {
  const reachable = await db.neighbourhood.findMany({
    where: { id: { in: neighbourhoodIds }, schoolId },
    select: { id: true },
  });

  await db.$transaction([
    db.routeNeighbourhood.deleteMany({ where: { routeId } }),
    db.routeNeighbourhood.createMany({
      data: reachable.map((neighbourhood) => ({
        routeId,
        neighbourhoodId: neighbourhood.id,
      })),
    }),
  ]);

  return reachable.length;
}

/** The same, for the runs a circuit makes. Scoped by the year the line is in. */
export async function setRouteSchedules(
  routeId: string,
  schoolYearId: string,
  scheduleIds: string[],
): Promise<number> {
  const reachable = await db.transportSchedule.findMany({
    where: { id: { in: scheduleIds }, schoolYearId },
    select: { id: true },
  });

  await db.$transaction([
    db.routeSchedule.deleteMany({ where: { routeId } }),
    db.routeSchedule.createMany({
      data: reachable.map((schedule) => ({
        routeId,
        scheduleId: schedule.id,
      })),
    }),
  ]);

  return reachable.length;
}

// ── L'appel du bus ───────────────────────────────────────────────────────────

export type MarkRiderInput = {
  subscriptionId: string;
  scheduleId: string | null;
  date: Date;
  status: RiderAttendanceStatus;
  minutesLate: number | null;
  isJustified: boolean;
  reason: string | null;
  recordedById: string;
};

/**
 * Marks one rider on one run, or corrects an existing mark.
 *
 * Upserted on `(subscription, date, scopeKey)` rather than created: a driver
 * correcting a mis-tap must overwrite the morning's answer, not stack a second
 * one on top and have the child counted absent twice. The key is built through
 * `busRegisterScopeKey` in the same statement that sets `scheduleId`, which is
 * the rule every mirrored column in this schema follows.
 *
 * `minutesLate` is cleared for every status but LATE. Leaving a stale figure on
 * a child who turned out to have been present would put a retard in their count
 * that nobody recorded — the same correction `markAttendance` makes in the
 * classroom.
 */
export async function markRiderAttendance(
  input: MarkRiderInput,
): Promise<{ id: string }> {
  const isLate = input.status === "LATE";
  const scopeKey = busRegisterScopeKey(input.scheduleId);

  const data = {
    status: input.status,
    minutesLate: isLate ? (input.minutesLate ?? 0) : null,
    isJustified: input.isJustified,
    reason: input.reason,
    recordedById: input.recordedById,
  };

  return db.transportAttendance.upsert({
    where: {
      subscriptionId_date_scopeKey: {
        subscriptionId: input.subscriptionId,
        date: input.date,
        scopeKey,
      },
    },
    update: data,
    create: {
      subscriptionId: input.subscriptionId,
      scheduleId: input.scheduleId,
      date: input.date,
      scopeKey,
      ...data,
    },
    select: { id: true },
  });
}

/**
 * Marks a whole run at once — the "everyone else got on" button.
 *
 * The one thing a driver does forty times a morning is confirm that nothing was
 * wrong, and making them tap each name would guarantee the register stops being
 * taken by October. Only riders with no mark yet are written, so pressing it
 * after flagging two absences leaves those two alone.
 *
 * Returns how many were written.
 */
export async function markBusRunInBulk(input: {
  subscriptionIds: string[];
  scheduleId: string | null;
  date: Date;
  status: RiderAttendanceStatus;
  recordedById: string;
}): Promise<number> {
  const scopeKey = busRegisterScopeKey(input.scheduleId);

  const alreadyMarked = await db.transportAttendance.findMany({
    where: {
      subscriptionId: { in: input.subscriptionIds },
      date: input.date,
      scopeKey,
    },
    select: { subscriptionId: true },
  });
  const taken = new Set(alreadyMarked.map((row) => row.subscriptionId));

  const fresh = input.subscriptionIds.filter((id) => !taken.has(id));
  if (fresh.length === 0) return 0;

  // `createMany` rather than a loop of upserts: none of these rows exists, and
  // the unique index is what guarantees that stays true.
  const created = await db.transportAttendance.createMany({
    data: fresh.map((subscriptionId) => ({
      subscriptionId,
      scheduleId: input.scheduleId,
      date: input.date,
      scopeKey,
      status: input.status,
      minutesLate: null,
      isJustified: false,
      recordedById: input.recordedById,
    })),
  });

  return created.count;
}
