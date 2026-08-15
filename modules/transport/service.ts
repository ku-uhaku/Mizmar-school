import "server-only";

import { db } from "@/lib/db";
import { generateFeeSchedule } from "@/modules/enrolment/service";
import { dedupeKeyFor } from "@/modules/notifications/enums";
import {
  dispatch,
  guardiansOfStudent,
  notify,
} from "@/modules/notifications/service";
import {
  recordDisbursement,
  type TxClient,
} from "@/modules/treasury/service";
import {
  OFF_BUS_STATUSES,
  REGISTER_OPEN_STATUSES,
  SEAT_HOLDING_STATUSES,
  driverLabel,
  seatsOnRoute,
  seatsRemaining,
  busRegisterScopeKey,
  canMoveTripRun,
  tripRunWindow,
  subscriptionScopeKey,
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
// transport subscription the enrolment form already writes.

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

  const resolvedScheduleId = await resolveSchedule(
    stop.routeId,
    input.scheduleId,
  );
  const scopeKey = subscriptionScopeKey(input.direction, resolvedScheduleId);

  const existing = await db.transportSubscription.findUnique({
    where: {
      enrollmentId_scopeKey: {
        enrollmentId: input.enrollmentId,
        scopeKey,
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
      scheduleId: resolvedScheduleId,
      scopeKey,
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

export type SubscribeRunsResult = {
  created: number;
  repricedLines: number;
  /**
   * The runs that could not be taken, and why. Reported rather than thrown: a
   * family asking for the morning and the evening, where only the evening bus
   * has a seat left, should be put on the evening bus and *told* about the
   * morning — not refused both.
   */
  refused: SubscribeFailure[];
};

/**
 * Puts a pupil on several runs of one line in a single act.
 *
 * A child collected in the morning and taken home in the evening is the normal
 * arrangement, and each run they board is its own abonnement — see
 * `subscriptionScopeKey`. Asking the secretary to fill the same form once per
 * run was the whole friction. It is also what a school with a lunch break
 * needs: a child home at midday and back for the afternoon rides two runs
 * tagged AFTERNOON, and both are taken, not just the first.
 *
 * The direction is read off each run rather than asked for: a TransportSchedule
 * is MORNING or AFTERNOON and cannot be both (see its note), so the run the
 * family boards already answers the question. That also makes the two
 * impossible to contradict, which a separate direction select could.
 *
 * Only an exact repeat of the same run is refused, by the unique index and by
 * `subscribeRider` before it — a child cannot board the same departure twice.
 */
export async function subscribeRiderToRuns(
  base: Omit<SubscribeInput, "direction" | "scheduleId">,
  scheduleIds: string[],
): Promise<SubscribeRunsResult> {
  const runs = await db.transportSchedule.findMany({
    where: { id: { in: scheduleIds } },
    // Morning before afternoon, so a partial success is the start of the day
    // rather than an arbitrary half of it.
    orderBy: [{ direction: "asc" }, { position: "asc" }],
    select: { id: true, direction: true },
  });

  let created = 0;
  let repricedLines = 0;
  const refused: SubscribeFailure[] = [];

  // Sequential rather than in parallel: each one checks the seats left on the
  // line, and two concurrent checks would both see the last seat.
  for (const run of runs) {
    const result = await subscribeRider({
      ...base,
      direction: run.direction as TransportDirection,
      scheduleId: run.id,
    });

    if (result.ok) {
      created += 1;
      repricedLines += result.repricedLines;
    } else {
      refused.push(result.reason);
    }
  }

  return { created, repricedLines, refused };
}

/**
 * Keeps the transport subscription in step with whether the pupil is on a bus,
 * and raises the transport lines the first time they are.
 *
 * Billing is decided at enrolment: ticking "Transport" on the enrolment form is
 * what puts the flat fee on the échéancier. Seating a child at a stop must
 * therefore change nothing in the ordinary case — the lines are already there
 * and `generateFeeSchedule` is idempotent on (enrolment, fee type, instalment),
 * so it adds nothing.
 *
 * It matters in the one case that is not ordinary: a secretary who assigns a
 * circuit without having ticked the box. Without this the child would ride all
 * year unbilled, which is the sort of thing discovered in June. Returns how many
 * lines were raised — zero whenever transport was already on the schedule.
 *
 * ── Which charge, now that there is no flag ─────────────────────────────────
 * The school's own optional charge of kind TRANSPORT, found through the
 * enrolment's year. A school that has not declared one is telling us it does
 * not bill for the bus: there is nothing to subscribe to and nothing to raise,
 * so the seat is given and no charge appears. That is the same answer the old
 * boolean produced — it set a flag that priced nothing — except that now the
 * absence is visible in the catalogue rather than hidden in a column.
 */
async function syncTransportOption(
  enrollmentId: string,
  usesTransport: boolean,
): Promise<number> {
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { schoolYear: { select: { schoolId: true } } },
  });
  if (!enrolment) return 0;

  const charge = await db.feeType.findFirst({
    where: {
      schoolId: enrolment.schoolYear.schoolId,
      kind: "TRANSPORT",
      isActive: true,
      isMandatory: false,
    },
    orderBy: [{ position: "asc" }, { code: "asc" }],
    select: { id: true },
  });
  if (!charge) return 0;

  if (!usesTransport) {
    await db.enrollmentOption.deleteMany({
      where: { enrollmentId, feeTypeId: charge.id },
    });
    return 0;
  }

  await db.enrollmentOption.upsert({
    where: {
      enrollmentId_feeTypeId: { enrollmentId, feeTypeId: charge.id },
    },
    // Left alone when it is already there: the family may have set a start
    // month at the desk, and seating them at a stop is not a reason to move it.
    create: { enrollmentId, feeTypeId: charge.id, startsOn: null },
    update: {},
  });

  const existing = await db.enrollmentFee.count({
    where: { enrollmentId, feeTypeId: charge.id },
  });
  if (existing > 0) return 0;

  return generateFeeSchedule(enrollmentId);
}

/**
 * Moves a rider to another stop, changes their direction, or suspends them.
 *
 * None of the three changes what they pay: the bus is one flat fee. All that is
 * kept in step is the transport subscription, so suspending the last abonnement
 * takes the charge off next year's schedule.
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

  const resolvedScheduleId = await resolveSchedule(
    stop.routeId,
    input.scheduleId,
  );
  const scopeKey = subscriptionScopeKey(input.direction, resolvedScheduleId);

  // Moving this abonnement onto a run another one of the pupil's already holds
  // would collide on the unique index — checked here, rather than left to
  // throw, for the same reason `subscribeRider` checks it up front.
  const conflict = await db.transportSubscription.findFirst({
    where: {
      enrollmentId: subscription.enrollmentId,
      scopeKey,
      NOT: { id: subscriptionId },
    },
    select: { id: true },
  });
  if (conflict) return { ok: false, reason: "ALREADY_ON_BOARD" };

  await db.transportSubscription.update({
    where: { id: subscriptionId },
    data: {
      routeId: stop.routeId,
      stopId: stop.id,
      direction: input.direction,
      scheduleId: resolvedScheduleId,
      scopeKey,
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
 * Thrown when a second decision beat this one to the request.
 *
 * Thrown rather than returned, because a returned failure would commit the
 * décaissement written a few lines above it. The same device, and the same
 * reason, as `PayoutRaceLost` in modules/hr/service.ts.
 */
class FuelDecisionRaceLost extends Error {
  constructor() {
    super("Fuel request already decided");
    this.name = "FuelDecisionRaceLost";
  }
}

function isFuelRaceLost(error: unknown): boolean {
  return (
    error instanceof FuelDecisionRaceLost ||
    (error as Error)?.name === "FuelDecisionRaceLost"
  );
}

/**
 * Decides a driver's fuel request, and — when it is agreed — posts the money.
 *
 * ── Why the two are one transaction ─────────────────────────────────────────
 * An approved request with no décaissement behind it is a promise the ledger
 * has never heard of, and a décaissement with no request behind it is a spend
 * nobody signed for. Neither is a state worth being able to reach, so the
 * approval and the movement are written together.
 *
 * ── Why the unique index is not the guard ───────────────────────────────────
 * This used to read the request, check it was pending, post the money, and then
 * write the link — three statements, each its own transaction — on the stated
 * reasoning that the unique index on `cashOperationId` would stop a double
 * click paying twice. It could not: that index stops two *requests* claiming
 * one movement, which is the opposite direction. Two approvals of one request
 * each created their own operation and violated nothing, so a double-clicked
 * Approve posted a tank of diesel twice and left the first movement orphaned
 * with nothing pointing at it.
 *
 * `payStaffSalary` hit exactly this and closed it the same way: the state the
 * decision was made against is restated as a `where` on a conditional update
 * inside the transaction, so whichever call gets there second matches no rows
 * and rolls its own movement back. See the note on `recordDisbursement`, which
 * takes the transaction for this purpose.
 *
 * A rejection writes no movement, for the obvious reason. It is still recorded
 * rather than deleted, so a second ask for the same tank reads as a second ask.
 */
export async function decideFuelRequest(
  input: FuelDecisionInput,
): Promise<FuelDecisionResult> {
  try {
    return await decideFuelRequestInTransaction(input);
  } catch (error) {
    if (isFuelRaceLost(error)) {
      return { ok: false, reason: "ALREADY_DECIDED" };
    }
    throw error;
  }
}

function decideFuelRequestInTransaction(
  input: FuelDecisionInput,
): Promise<FuelDecisionResult> {
  return db.$transaction(async (tx) => {
    const request = await tx.fuelRequest.findFirst({
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
    if (!request) return { ok: false, reason: "NOT_FOUND" } as const;

    // Deciding is once. Re-deciding a settled request would either orphan the
    // first movement or post a second one for the same tank.
    if (request.status !== "PENDING" || request.cashOperationId) {
      return { ok: false, reason: "ALREADY_DECIDED" } as const;
    }

    /** The state this decision was made against, restated as a condition. */
    const stillPending = {
      id: request.id,
      schoolId: input.schoolId,
      status: "PENDING",
      cashOperationId: null,
    };

    if (input.status === "REJECTED") {
      const rejected = await tx.fuelRequest.updateMany({
        where: stillPending,
        data: {
          status: "REJECTED",
          decidedById: input.decidedById,
          decidedAt: new Date(),
          notes: input.notes ?? undefined,
        },
      });
      if (rejected.count === 0) {
        return { ok: false, reason: "ALREADY_DECIDED" } as const;
      }
      return { ok: true, operationId: null } as const;
    }

    if (request.amountCentimes <= 0) {
      return { ok: false, reason: "NOTHING_TO_PAY" } as const;
    }

    const beneficiaryName =
      driverLabel(
        request.requestedBy
          ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`
          : null,
        request.requestedByName,
      ) ?? request.vehicle.registration;

    const operation = await recordDisbursement(
      {
        schoolId: input.schoolId,
        createdById: input.decidedById,
        cashSessionId: input.cashSessionId,
        categoryId: input.categoryId,
        subcategoryId: null,
        motifId: null,
        notes: null,
        bankId: null,
        bankName: null,
        beneficiaryStaffId: request.requestedById,
        beneficiaryName,
        // The bus is in the label because that is what makes the line
        // answerable three months later: "Carburant — 12345-A-6, 45,0 L".
        label: `Carburant — ${request.vehicle.registration}, ${tenthsToLitres(
          request.litresTenths,
        ).toFixed(1)} L`,
        method: "CASH",
        amountCentimes: request.amountCentimes,
        reference: null,
        chequeNumber: null,
        occurredAt: request.occurredOn,
      },
      tx,
    );

    const claimed = await tx.fuelRequest.updateMany({
      where: stillPending,
      data: {
        status: input.status,
        decidedById: input.decidedById,
        decidedAt: new Date(),
        cashOperationId: operation.id,
        notes: input.notes ?? undefined,
      },
    });
    // Thrown, not returned: a returned failure would commit the décaissement
    // written a few lines up. See `FuelDecisionRaceLost`.
    if (claimed.count === 0) throw new FuelDecisionRaceLost();

    return { ok: true, operationId: operation.id } as const;
  });
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

// ── Drawing a line in one sitting ────────────────────────────────────────────

/**
 * A stop on the line being drawn.
 *
 * The wizard does not ask for these — it derives one per quartier served, in
 * the order they were ticked, and that is what `neighbourhoodId` carries. The
 * shape stays general so the line's own page, which does let a school name a
 * kerb and time it, writes through the same door.
 */
export type OpenRouteStop = {
  name: string;
  landmark: string | null;
  neighbourhoodId: string | null;
  pickupTime: string | null;
  dropoffTime: string | null;
};

export type OpenRouteRider = {
  enrollmentId: string;
  /**
   * Which stop they board, by its place in `stops` — the line does not exist
   * yet, so there is no stop id for the form to send back. The action derives
   * it from the quartier the child lives in, never from the request.
   */
  stopIndex: number;
  /**
   * The runs they board, among those the line was just given. Empty means the
   * line declares no horaire, and `direction` answers instead — the same split
   * `subscribeRiderAction` makes.
   */
  scheduleIds: string[];
  direction: TransportDirection;
};

export type OpenRouteInput = {
  schoolId: string;
  schoolYearId: string;
  route: {
    code: string;
    name: string;
    nameAr: string | null;
    direction: TransportDirection;
    vehicleId: string | null;
    capacity: number | null;
    isActive: boolean;
    notes: string | null;
  };
  scheduleIds: string[];
  neighbourhoodIds: string[];
  stops: OpenRouteStop[];
  riders: OpenRouteRider[];
};

export type OpenRouteResult = {
  routeId: string;
  stops: number;
  schedules: number;
  neighbourhoods: number;
  ridersSeated: number;
  /**
   * Riders the line would not take — a full bus, or a pupil already holding
   * that seat. Reported rather than thrown, for the reason
   * `subscribeRiderToRuns` gives: a line that seats nineteen of twenty should be
   * drawn, and the twentieth named, not refused whole.
   */
  ridersRefused: number;
};

/**
 * Draws a line, its runs, its catchment, its stops and its first passengers in
 * one act — what the création wizard posts.
 *
 * Every piece of this was already reachable one screen at a time: create the
 * line, reopen it to tick its horaires, tick its quartiers, add the stops one
 * dialog at a time, then add the riders. Five visits to build one bus route,
 * and a line was live and pickable from the pupil's file after the first of
 * them, with no stops on it for anybody to board at.
 *
 * The order is the dependency order and not a preference: the runs must be on
 * the line before a rider can be put on one of them, and the stops must exist
 * before anybody boards. Nothing here re-checks scope — the action has already
 * re-derived the school, the year, the bus and every enrolment against the
 * session, and the two seat-taking calls check their own invariants.
 */
export async function openRoute(
  input: OpenRouteInput,
): Promise<OpenRouteResult> {
  const route = await db.transportRoute.create({
    data: { schoolYearId: input.schoolYearId, ...input.route },
    select: { id: true },
  });

  const schedules = await setRouteSchedules(
    route.id,
    input.schoolYearId,
    input.scheduleIds,
  );
  const neighbourhoods = await setRouteNeighbourhoods(
    route.id,
    input.schoolId,
    input.neighbourhoodIds,
  );

  /*
    One transaction, and the ids come back in the order they went in — which is
    what maps a rider's `stopIndex` onto the stop they board. `createMany` would
    be one round trip fewer and gives no ids back on MySQL, which has no
    `RETURNING`, so the mapping would have to be re-read by name.
  */
  const stops = await db.$transaction(
    input.stops.map((stop, index) =>
      db.routeStop.create({
        data: {
          routeId: route.id,
          name: stop.name,
          landmark: stop.landmark,
          neighbourhoodId: stop.neighbourhoodId,
          pickupTime: stop.pickupTime,
          dropoffTime: stop.dropoffTime,
          // The order they were typed in is the order the bus reaches them.
          position: index,
        },
        select: { id: true },
      }),
    ),
  );

  let ridersSeated = 0;
  let ridersRefused = 0;

  for (const rider of input.riders) {
    const stopId = stops[rider.stopIndex]?.id;
    // A rider pointing at a stop that was removed from the list before submit.
    if (!stopId) {
      ridersRefused += 1;
      continue;
    }

    const base = {
      enrollmentId: rider.enrollmentId,
      stopId,
      status: "ACTIVE" as SubscriptionStatus,
      startsOn: new Date(),
      endsOn: null,
      notes: null,
    };

    if (rider.scheduleIds.length > 0) {
      const runs = await subscribeRiderToRuns(base, rider.scheduleIds);
      // One pupil counts once however many runs they were put on: the wizard
      // asked for a passenger, not for a number of abonnements.
      if (runs.created > 0) ridersSeated += 1;
      else ridersRefused += 1;
    } else {
      const seated = await subscribeRider({
        ...base,
        direction: rider.direction,
        scheduleId: null,
      });
      if (seated.ok) ridersSeated += 1;
      else ridersRefused += 1;
    }
  }

  return {
    routeId: route.id,
    stops: stops.length,
    schedules,
    neighbourhoods,
    ridersSeated,
    ridersRefused,
  };
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

  const row = await db.transportAttendance.upsert({
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

  await dispatch("TRANSPORT_MISSED", () =>
    tellTheHousehold(input, scopeKey),
  );

  return row;
}

/**
 * Tells a household their child was not on the bus.
 *
 * ── The most urgent line in the app ─────────────────────────────────────────
 * Everything else here can wait until the evening. A child who is not on the
 * bus home is a parent standing at a stop, and the difference between hearing
 * at 16h05 and hearing at 18h00 is the whole value of the feature. It is also
 * the one where a *wrong* line is most costly, which is why the correction path
 * below matters as much as the notification.
 *
 * Withdrawn on correction while still unread, exactly as the classroom register
 * does it and for the same reason — a driver who taps the wrong name and fixes
 * it must not leave a parent believing their child was left behind. Once read,
 * it stands: the repair for that is a telephone call, not a silent deletion.
 */
async function tellTheHousehold(
  input: MarkRiderInput,
  scopeKey: string,
): Promise<void> {
  const discriminator = `${input.date.toISOString()}:${scopeKey}`;
  const key = dedupeKeyFor(
    "TRANSPORT_MISSED",
    input.subscriptionId,
    discriminator,
  );

  if (!OFF_BUS_STATUSES.includes(input.status) && input.status !== "LATE") {
    if (key) {
      await db.notification.deleteMany({ where: { dedupeKey: key, readAt: null } });
    }
    return;
  }

  const subscription = await db.transportSubscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      enrollment: {
        select: {
          studentId: true,
          student: {
            select: { schoolId: true, school: { select: { organizationId: true } } },
          },
        },
      },
    },
  });
  if (!subscription) return;

  const student = subscription.enrollment.student;

  await notify({
    organizationId: student.school.organizationId,
    schoolId: student.schoolId,
    kind: "TRANSPORT_MISSED",
    subjectId: input.subscriptionId,
    dedupeOn: discriminator,
    params: { status: input.status, date: input.date.toISOString() },
    targets: await guardiansOfStudent(subscription.enrollment.studentId),
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

// ── Carrying the lines into a new year ───────────────────────────────────────

/**
 * Copies the year's transport arrangement onto another year: the runs, the
 * circuits, their stops, and which quartiers and horaires each line serves.
 *
 * ── What is not carried ─────────────────────────────────────────────────────
 * No abonnement. Who rides the bus is a year-shaped fact decided at
 * inscription, and a copied rider would be a child the school has not yet
 * enrolled. The fleet needs no copying either — a vehicle belongs to the
 * school, not to a year — but the *assignment* of a bus to a line does come
 * across, because it is the line's own arrangement.
 *
 * Idempotent throughout: runs and circuits upsert on their year-scoped codes,
 * stops on `(routeId, name)`, and the two join tables on their pairings. An
 * existing row is never overwritten.
 */
export async function copyTransportConfiguration(
  sourceYearId: string,
  targetYearId: string,
): Promise<{ schedules: number; routes: number; stops: number }> {
  const [schedules, routes] = await Promise.all([
    db.transportSchedule.findMany({ where: { schoolYearId: sourceYearId } }),
    db.transportRoute.findMany({
      where: { schoolYearId: sourceYearId },
      include: {
        stops: true,
        neighbourhoods: { select: { neighbourhoodId: true } },
        schedules: { select: { schedule: { select: { code: true } } } },
      },
    }),
  ]);

  // The runs first: a circuit's horaires are matched back by code, so they have
  // to exist in the target year before the lines that point at them.
  // Before/after deltas throughout — see the note in copyClassStructure.
  const routeScope = { route: { schoolYearId: targetYearId } };
  const [schedulesBefore, routesBefore, stopsBefore] = await Promise.all([
    db.transportSchedule.count({ where: { schoolYearId: targetYearId } }),
    db.transportRoute.count({ where: { schoolYearId: targetYearId } }),
    db.routeStop.count({ where: routeScope }),
  ]);

  const scheduleIdByCode = new Map<string, string>();
  for (const schedule of schedules) {
    const target = await db.transportSchedule.upsert({
      where: {
        schoolYearId_code: {
          schoolYearId: targetYearId,
          code: schedule.code,
        },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        code: schedule.code,
        name: schedule.name,
        nameAr: schedule.nameAr,
        direction: schedule.direction,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        position: schedule.position,
        isActive: schedule.isActive,
      },
      select: { id: true },
    });
    scheduleIdByCode.set(schedule.code, target.id);
  }

  for (const route of routes) {
    const target = await db.transportRoute.upsert({
      where: {
        schoolYearId_code: { schoolYearId: targetYearId, code: route.code },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        code: route.code,
        name: route.name,
        nameAr: route.nameAr,
        direction: route.direction,
        vehicleId: route.vehicleId,
        capacity: route.capacity,
        isActive: route.isActive,
        notes: route.notes,
      },
      select: { id: true },
    });

    for (const stop of route.stops) {
      await db.routeStop.upsert({
        where: { routeId_name: { routeId: target.id, name: stop.name } },
        update: {},
        create: {
          routeId: target.id,
          name: stop.name,
          nameAr: stop.nameAr,
          landmark: stop.landmark,
          // The quartier is school-scoped, not year-scoped: a place does not
          // expire with the calendar, so the id carries straight across.
          neighbourhoodId: stop.neighbourhoodId,
          position: stop.position,
          pickupTime: stop.pickupTime,
          dropoffTime: stop.dropoffTime,
        },
        select: { id: true },
      });
    }

    for (const link of route.neighbourhoods) {
      await db.routeNeighbourhood.upsert({
        where: {
          routeId_neighbourhoodId: {
            routeId: target.id,
            neighbourhoodId: link.neighbourhoodId,
          },
        },
        update: {},
        create: {
          routeId: target.id,
          neighbourhoodId: link.neighbourhoodId,
        },
      });
    }

    for (const link of route.schedules) {
      // Matched by code, not by id: the target year has its own run rows.
      const scheduleId = scheduleIdByCode.get(link.schedule.code);
      if (!scheduleId) continue;
      await db.routeSchedule.upsert({
        where: { routeId_scheduleId: { routeId: target.id, scheduleId } },
        update: {},
        create: { routeId: target.id, scheduleId },
      });
    }
  }

  const [schedulesAfter, routesAfter, stopsAfter] = await Promise.all([
    db.transportSchedule.count({ where: { schoolYearId: targetYearId } }),
    db.transportRoute.count({ where: { schoolYearId: targetYearId } }),
    db.routeStop.count({ where: routeScope }),
  ]);

  return {
    schedules: schedulesAfter - schedulesBefore,
    routes: routesAfter - routesBefore,
    stops: stopsAfter - stopsBefore,
  };
}

// ── Le voyage ────────────────────────────────────────────────────────────────

/**
 * Makes sure the day's board exists, and returns nothing.
 *
 * Every (circuit, horaire) pair the school has declared gets a `PLANNED` row for
 * the date, so the board opens already showing what is *meant* to happen. That
 * is the whole reason generation exists rather than creating runs on first
 * press: a morning that never left the yard has to be visible, and a missing row
 * is indistinguishable from a screen nobody opened.
 *
 * Called on the way into the board rather than from a cron. A school opens the
 * screen every morning by definition, there is no scheduler in this deployment,
 * and the unique index makes a second call on the same day write nothing.
 *
 * Retired circuits and horaires are skipped: `isActive` is how a school stops
 * running a line, and generating for it would put a run on the board that
 * nobody is expected to make.
 */
export async function ensureDayRuns(
  schoolYearId: string,
  date: Date,
): Promise<number> {
  const pairs = await db.routeSchedule.findMany({
    where: {
      route: { schoolYearId, isActive: true },
      schedule: { schoolYearId, isActive: true },
    },
    select: {
      routeId: true,
      scheduleId: true,
      schedule: { select: { departureTime: true } },
    },
  });
  if (pairs.length === 0) return 0;

  const existing = await db.tripRun.findMany({
    where: { date, routeId: { in: pairs.map((pair) => pair.routeId) } },
    select: { routeId: true, scheduleId: true },
  });
  const taken = new Set(
    existing.map((run) => `${run.routeId}:${run.scheduleId}`),
  );

  const missing = pairs.filter(
    (pair) => !taken.has(`${pair.routeId}:${pair.scheduleId}`),
  );
  if (missing.length === 0) return 0;

  /*
    `createMany` without `skipDuplicates` — so a second caller racing this one
    would collide on the unique index. Swallowed rather than surfaced: both
    callers wanted the same rows to exist, and they now do.

    Not `skipDuplicates: true`, which MySQL does support: it compiles to
    `INSERT IGNORE`, and that would silence a bad foreign key or a truncated
    value just as readily as the collision this is here to absorb.
  */
  try {
    const created = await db.tripRun.createMany({
      data: missing.map((pair) => ({
        routeId: pair.routeId,
        scheduleId: pair.scheduleId,
        date,
        // Copied, not joined — see the note on the column.
        plannedDepartureTime: pair.schedule.departureTime,
        status: "PLANNED",
      })),
    });
    return created.count;
  } catch {
    return 0;
  }
}

/**
 * Moves a run along, if the move is one the table allows.
 *
 * The status is re-read inside the write rather than taken from the caller, so
 * two people pressing "démarrer" at the same moment — the driver on the yard and
 * the office on the board — produce one departure and one refusal rather than
 * two stamps, the second overwriting the first.
 *
 * `withinWindow` is what a phone passes and the office does not. A driver may
 * only start or close a voyage around its hour — see `tripRunWindow` — and the
 * hour is re-derived here, inside the transaction, rather than trusted from the
 * request: the endpoint is reachable by direct POST, so a client that lies about
 * the clock must reach nothing. The office keeps the unrestricted move, because
 * a secrétaire recording at four o'clock that this morning's bus went out is a
 * correction, not a departure.
 *
 * Returns false when the move is not allowed from where the run actually is,
 * which the action turns into a message rather than an error.
 */
export async function moveTripRun(
  runId: string,
  next: "EN_ROUTE" | "ARRIVED" | "CANCELLED",
  actedById: string,
  options: {
    cancelReason?: string;
    vehicleId?: string | null;
    withinWindow?: boolean;
  } = {},
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const run = await tx.tripRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        date: true,
        plannedDepartureTime: true,
        route: { select: { vehicleId: true } },
      },
    });
    if (!run) return false;

    if (!canMoveTripRun(run.status, next)) return false;

    if (
      options.withinWindow &&
      tripRunWindow(run.date, run.plannedDepartureTime, new Date()) !== "OPEN"
    ) {
      return false;
    }

    const now = new Date();

    await tx.tripRun.update({
      where: { id: runId },
      data: {
        status: next,
        ...(next === "EN_ROUTE"
          ? {
              startedAt: now,
              startedById: actedById,
              // The bus that actually went. Falls back to the circuit's usual
              // one, which is right on any morning nobody swapped it.
              vehicleId: options.vehicleId ?? run.route.vehicleId ?? null,
            }
          : {}),
        ...(next === "ARRIVED"
          ? { arrivedAt: now, arrivedById: actedById }
          : {}),
        ...(next === "CANCELLED"
          ? { cancelReason: options.cancelReason ?? null }
          : {}),
      },
    });

    return true;
  });
}

/**
 * L'appel au trottoir: one rider marked from the bus, keyed by the run.
 *
 * The office marks a register by route, horaire and date, because that is what
 * its screen holds; a phone holds a run id, and taking that run apart in the
 * route handler would put the run's date and horaire in the request — where a
 * client could substitute yesterday's, and mark a child absent on a day nobody
 * drove. So the run is the key, and everything else is read from it.
 *
 * Three things are re-derived here rather than trusted, all inside the write:
 *
 *   1. **The bus is out.** No mark before the départ, for the reason
 *      `loadRunRegister` withholds the names — see REGISTER_OPEN_STATUSES.
 *   2. **It is still the run's hour.** Same `withinWindow` rule as the départ,
 *      so a phone left open cannot be marking this morning's voyage at
 *      midnight.
 *   3. **The child is on this line.** The subscription id comes from the
 *      request; combined with the run's own route, so an id from another
 *      circuit reaches nothing.
 *
 * Returns null when any of the three fails, which the route turns into a 404 —
 * the same answer as a run that was never the caller's, since telling the two
 * apart would confirm the run exists.
 */
export async function markRiderOnRun(input: {
  runId: string;
  subscriptionId: string;
  status: RiderAttendanceStatus;
  minutesLate: number | null;
  reason: string | null;
  recordedById: string;
  withinWindow?: boolean;
}): Promise<{ id: string } | null> {
  const run = await db.tripRun.findUnique({
    where: { id: input.runId },
    select: {
      routeId: true,
      scheduleId: true,
      date: true,
      status: true,
      plannedDepartureTime: true,
    },
  });
  if (!run) return null;

  if (!REGISTER_OPEN_STATUSES.includes(run.status)) return null;

  if (
    input.withinWindow &&
    tripRunWindow(run.date, run.plannedDepartureTime, new Date()) !== "OPEN"
  ) {
    return null;
  }

  const rides = await db.transportSubscription.findFirst({
    where: {
      id: input.subscriptionId,
      routeId: run.routeId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!rides) return null;

  return markRiderAttendance({
    subscriptionId: rides.id,
    scheduleId: run.scheduleId,
    date: run.date,
    status: input.status,
    minutesLate: input.minutesLate,
    // A driver at the kerb knows the child is not there; whether the family
    // warned the office is not his to say, and defaulting it true would quietly
    // excuse every absence the bus reports.
    isJustified: false,
    reason: input.reason,
    recordedById: input.recordedById,
  });
}

/**
 * Puts a fuel request back to pending when the caisse reverses the movement
 * that paid for it.
 *
 * Run inside `cancelOperation`'s transaction — the same arrangement as
 * `detachPayrollFromOperations` in modules/hr/service.ts, and for the same
 * reason: the request justifies the movement and the movement is the record of
 * it, so a request left APPROVED against a reversed entry claims a tank of
 * diesel the ledger says was never paid for.
 *
 * Back to PENDING rather than REJECTED: the decision is being undone, not
 * refused, and whoever asked for the fuel still has.
 */
export async function detachFuelFromOperations(
  tx: TxClient,
  operationIds: string[],
): Promise<void> {
  if (operationIds.length === 0) return;

  await tx.fuelRequest.updateMany({
    where: { cashOperationId: { in: operationIds } },
    data: {
      status: "PENDING",
      cashOperationId: null,
      decidedById: null,
      decidedAt: null,
    },
  });
}
