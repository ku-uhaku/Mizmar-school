import "server-only";

import { db } from "@/lib/db";
import { splitIntoInstalments } from "@/modules/billing/enums";
import { netAmount } from "@/modules/enrolment/enums";
import {
  SEAT_HOLDING_STATUSES,
  priceForDirection,
  seatsOnRoute,
  seatsRemaining,
  type SubscriptionStatus,
  type TransportDirection,
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

// ── The bill ─────────────────────────────────────────────────────────────────

/**
 * Writes the zone's price onto a pupil's TRANSPORT fee lines.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The échéancier is generated from the price list, which prices a charge by
 * *level*. Transport is priced by *distance*, and there is no level in that
 * sentence — so the schedule raises transport lines at whatever flat rate the
 * fee list carries, and this corrects them to what the family actually agreed
 * to when they picked a stop.
 *
 * The annual figure is split across the lines that already exist, rather than
 * new lines being raised: how many instalments transport is collected in is the
 * bursar's decision, recorded in the price list, and this must not quietly
 * re-plan it. `splitIntoInstalments` is the same helper the schedule itself
 * uses, so the parts sum back exactly with no centime lost.
 *
 * Reductions on each line are preserved. A sibling discount granted on the bus
 * in October is not undone by the family moving zone in January — only the base
 * amount moves, and `netAmount` recomputes the total from it, exactly as
 * `repriceFeeLine` does.
 *
 * Returns how many lines were repriced.
 */
export async function applyTransportPricing(
  enrollmentId: string,
): Promise<number> {
  const subscriptions = await db.transportSubscription.findMany({
    where: {
      enrollmentId,
      status: { in: [...SEAT_HOLDING_STATUSES] },
    },
    select: {
      direction: true,
      zone: { select: { amountCentimes: true } },
    },
  });

  // What the pupil pays for the year: each live subscription priced by its own
  // zone and direction. Two one-way subscriptions on different lines therefore
  // add up, which is exactly what such a family is charged.
  const annualCentimes = subscriptions.reduce(
    (total, subscription) =>
      total +
      priceForDirection(
        subscription.zone?.amountCentimes ?? 0,
        subscription.direction as TransportDirection,
      ),
    0,
  );

  const lines = await db.enrollmentFee.findMany({
    where: {
      enrollmentId,
      feeType: { kind: "TRANSPORT" },
      // Waived and cancelled lines are out of the reckoning already; repricing
      // them would quietly bring them back into what is owed.
      status: "DUE",
    },
    orderBy: [{ periodIndex: "asc" }],
    select: {
      id: true,
      discountBps: true,
      discountCentimes: true,
    },
  });

  if (lines.length === 0) return 0;

  const parts = splitIntoInstalments(annualCentimes, lines.length);

  await db.$transaction(
    lines.map((line, index) => {
      const base = parts[index] ?? 0;
      return db.enrollmentFee.update({
        where: { id: line.id },
        data: {
          baseAmountCentimes: base,
          // The stored total is always recomputed from its parts — the same
          // rule repriceFeeLine enforces, so the two cannot drift.
          amountCentimes: netAmount(
            base,
            line.discountBps,
            line.discountCentimes,
          ),
        },
      });
    }),
  );

  return lines.length;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export type SubscribeInput = {
  enrollmentId: string;
  stopId: string;
  direction: TransportDirection;
  status: SubscriptionStatus;
  startsOn: Date;
  endsOn: Date | null;
  notes: string | null;
};

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
      zoneId: true,
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
      // Copied from the stop at subscription time — see the note on the column.
      zoneId: stop.zoneId,
      direction: input.direction,
      status: input.status,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      notes: input.notes,
    },
    select: { id: true },
  });

  // Riding and being billed for it are one act. See the note at the top.
  await db.enrollment.update({
    where: { id: input.enrollmentId },
    data: { usesTransport: true },
  });
  const repricedLines = await applyTransportPricing(input.enrollmentId);

  return { ok: true, id: created.id, repricedLines };
}

/**
 * Moves a rider to another stop, changes their direction, or suspends them.
 *
 * Any of the three changes what they pay, so the bill is rewritten every time
 * rather than only when the zone visibly moves — a stop reassigned to another
 * zone in March would otherwise leave the price behind.
 */
export async function updateRider(
  subscriptionId: string,
  input: {
    stopId: string;
    direction: TransportDirection;
    status: SubscriptionStatus;
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
    select: { id: true, routeId: true, zoneId: true },
  });
  if (!stop) return { ok: false, reason: "STOP_UNREACHABLE" };

  await db.transportSubscription.update({
    where: { id: subscriptionId },
    data: {
      routeId: stop.routeId,
      stopId: stop.id,
      zoneId: stop.zoneId,
      direction: input.direction,
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
  await db.enrollment.update({
    where: { id: subscription.enrollmentId },
    data: { usesTransport: stillRiding > 0 },
  });

  const repricedLines = await applyTransportPricing(subscription.enrollmentId);
  return { ok: true, id: subscriptionId, repricedLines };
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

  if (stillRiding > 0) {
    // Still on another line — reprice rather than cancel.
    await applyTransportPricing(subscription.enrollmentId);
    return { cancelledLines: 0 };
  }

  await db.enrollment.update({
    where: { id: subscription.enrollmentId },
    data: { usesTransport: false },
  });

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

/**
 * Reprices every rider on a zone after its rate changes.
 *
 * A school putting its bus prices up in September changes one number and expects
 * every échéancier to follow; doing it rider by rider is a hundred edits and an
 * eventual mistake. Returns how many pupils were repriced.
 */
export async function repriceZone(zoneId: string): Promise<number> {
  const subscriptions = await db.transportSubscription.findMany({
    where: { zoneId, status: { in: [...SEAT_HOLDING_STATUSES] } },
    select: { enrollmentId: true },
  });

  const enrollmentIds = Array.from(
    new Set(subscriptions.map((subscription) => subscription.enrollmentId)),
  );

  for (const enrollmentId of enrollmentIds) {
    await applyTransportPricing(enrollmentId);
  }

  return enrollmentIds.length;
}
