import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_TRIP_RUN_STATUSES,
  COUNTED_FUEL_STATUSES,
  EXPIRY_WARNING_DAYS,
  FUEL_REQUEST_STATUSES,
  OFF_BUS_STATUSES,
  REGISTER_OPEN_STATUSES,
  RIDER_ATTENDANCE_STATUSES,
  ROADWORTHY_STATUSES,
  RUN_WINDOW_AFTER_MINUTES,
  RUN_WINDOW_BEFORE_MINUTES,
  SCHEDULE_DIRECTIONS,
  SEAT_HOLDING_STATUSES,
  SETTLED_FUEL_STATUSES,
  SUBSCRIPTION_STATUSES,
  TRANSPORT_DIRECTIONS,
  TRIP_RUN_STATUSES,
  VEHICLE_STATUSES,
  boarded,
  busRegisterScopeKey,
  canMoveTripRun,
  consumptionPer100km,
  departureDelayMinutes,
  driverLabel,
  expiryState,
  isTimeOfDay,
  litresToTenths,
  scheduleLabel,
  seatsOnRoute,
  seatsRemaining,
  subscriptionScopeKey,
  tallyBusRegister,
  tenthsToLitres,
  tripRunWindow,
} from "@/modules/transport/enums";

/**
 * Le transport scolaire: the fleet, the lines, and the money the pump costs.
 *
 * Three separations carry this module, and each one is a real job in a real
 * school:
 *
 *   * **the pump is not the ledger.** A driver raises a demande de
 *     consommation; somebody with the approving code decides it; only that
 *     decision writes a décaissement. Letting the person spending the money
 *     record it is the one separation a caisse exists to keep.
 *   * **the kerb is not the classroom.** A child absent from the bus is not
 *     thereby absent from school, and `transport.attendance` — the driver's
 *     code on a phone — carries no right to read what a family pays.
 *   * **a seat that does not exist cannot be sold.** A line with no bus offers
 *     none, not unlimited.
 *
 * The pricing is deliberately *not* here: transport is charged once, at
 * enrolment, from the price list. The module used to carry zones and halve the
 * fee for a one-way rider, and the two answers disagreed with the échéancier.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};
/** Set to fail the conditional claim, standing in for a lost race. */
let claimCount = 1;

const EMPTY: Record<string, unknown> = {
  findMany: [],
  count: 0,
  findFirst: null,
  findUnique: null,
  create: { id: "created" },
  createMany: { count: 0 },
  update: {},
  deleteMany: { count: 0 },
  aggregate: { _sum: {} },
};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      if (model === "$transaction") {
        return async (work: unknown) =>
          typeof work === "function"
            ? (work as (tx: unknown) => unknown)(db)
            : Promise.all(work as unknown[]);
      }
      return new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            if (model === "fuelRequest" && op === "updateMany") {
              return { count: claimCount };
            }
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op in EMPTY ? EMPTY[op] : null;
          },
        },
      );
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

/** The one call into the treasury, recorded rather than performed. */
const disbursements: { input: Record<string, unknown>; hadTx: boolean }[] = [];
let disbursementFails = false;

vi.mock("@/modules/treasury/service", () => ({
  recordDisbursement: async (input: Record<string, unknown>, tx?: unknown) => {
    disbursements.push({ input, hadTx: tx !== undefined });
    if (disbursementFails) throw new Error("ledger unavailable");
    return { id: `op-${disbursements.length}` };
  },
}));

vi.mock("@/modules/enrolment/service", () => ({
  generateFeeSchedule: async () => 0,
  resyncOptionalCharges: async () => ({ added: 0, removed: 0 }),
}));

const { decideFuelRequest } = await import("@/modules/transport/service");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

beforeEach(() => {
  calls.length = 0;
  disbursements.length = 0;
  answers = {};
  claimCount = 1;
  disbursementFails = false;
});

// ── The fleet ────────────────────────────────────────────────────────────────

describe("vehicle status", () => {
  it("lets only an active bus carry children", () => {
    // A bus in the workshop is not one that "probably still runs".
    expect([...ROADWORTHY_STATUSES]).toEqual(["ACTIVE"]);
    for (const status of ["MAINTENANCE", "RETIRED"]) {
      expect(ROADWORTHY_STATUSES, status).not.toContain(status);
    }
  });

  it("declares every status the column may hold", () => {
    expect([...VEHICLE_STATUSES]).toEqual(["ACTIVE", "MAINTENANCE", "RETIRED"]);
  });
});

describe("driverLabel", () => {
  it("prefers the employee, whose name is maintained in one place", () => {
    // The free-text name is a note somebody typed once. Deciding here is what
    // stops the fleet list, the line card and the route page showing three
    // different answers for the same bus.
    expect(driverLabel("Karim Alaoui", "K. Alaoui")).toBe("Karim Alaoui");
  });

  it("falls back to the text for a contractor on nobody's payroll", () => {
    expect(driverLabel(null, "Transports Atlas")).toBe("Transports Atlas");
  });

  it("answers nothing when the bus has no driver at all", () => {
    expect(driverLabel(null, null)).toBeNull();
  });
});

describe("expiryState", () => {
  const now = new Date(2026, 0, 15);

  it("flags a paper already out of date", () => {
    expect(expiryState(new Date(2026, 0, 14), now)).toBe("EXPIRED");
  });

  it("warns in time to book a visite technique", () => {
    // Thirty days is roughly the notice a school needs to have the bus back on
    // the road on Monday.
    expect(expiryState(new Date(2026, 1, 1), now)).toBe("SOON");
    expect(
      expiryState(new Date(2026, 0, 15 + EXPIRY_WARNING_DAYS), now),
    ).toBe("SOON");
  });

  it("says nothing about a paper with months left", () => {
    expect(
      expiryState(new Date(2026, 0, 15 + EXPIRY_WARNING_DAYS + 1), now),
    ).toBe("OK");
  });

  it("keeps an unknown date apart from a warning", () => {
    // A gap in the record is a different problem from a lapsed paper, and the
    // screen says so separately.
    expect(expiryState(null, now)).toBe("UNKNOWN");
    expect(expiryState("not-a-date", now)).toBe("UNKNOWN");
  });

  it("reads a date written as text", () => {
    expect(expiryState("2026-01-14T00:00:00", now)).toBe("EXPIRED");
  });
});

// ── Seats ────────────────────────────────────────────────────────────────────

describe("seats", () => {
  it("takes the line's own cap over the bus's", () => {
    // A school may run a forty-seat bus at thirty on a long circuit.
    expect(seatsOnRoute(30, 40)).toBe(30);
  });

  it("falls back to the bus when the line declares no cap", () => {
    expect(seatsOnRoute(null, 40)).toBe(40);
  });

  it("offers none at all for a line with no bus yet", () => {
    // Not "unlimited". Planning a route before allocating a vehicle is
    // ordinary; letting families onto it would be selling seats that do not
    // exist.
    expect(seatsOnRoute(null, null)).toBe(0);
  });

  it("honours a declared cap of zero", () => {
    expect(seatsOnRoute(0, 40)).toBe(0);
  });

  it("floors an over-full bus at nothing left", () => {
    // An over-full bus is a data problem, not a negative number of seats.
    expect(seatsRemaining(40, 45)).toBe(0);
    expect(seatsRemaining(40, 40)).toBe(0);
    expect(seatsRemaining(40, 39)).toBe(1);
  });

  it("counts a suspended abonnement as still holding its seat", () => {
    // Which is the point of SUSPENDED: the family has stopped for a while and
    // expects the seat back.
    expect([...SEAT_HOLDING_STATUSES]).toEqual(["ACTIVE", "SUSPENDED"]);
    expect(SEAT_HOLDING_STATUSES).not.toContain("CANCELLED");
    expect([...SUBSCRIPTION_STATUSES]).toEqual([
      "ACTIVE",
      "SUSPENDED",
      "CANCELLED",
    ]);
  });
});

describe("subscriptionScopeKey", () => {
  it("keys an abonnement on the named run when there is one", () => {
    // A school that sends children home for lunch runs two AFTERNOON
    // departures, and a full-day rider is expected on both. Keying on the
    // direction alone could not tell them apart.
    expect(subscriptionScopeKey("AFTERNOON", "run-midday")).toBe(
      "run:run-midday",
    );
    expect(subscriptionScopeKey("AFTERNOON", "run-evening")).toBe(
      "run:run-evening",
    );
    expect(subscriptionScopeKey("AFTERNOON", "run-midday")).not.toBe(
      subscriptionScopeKey("AFTERNOON", "run-evening"),
    );
  });

  it("falls back to the half of the day for a line with no runs declared", () => {
    for (const direction of TRANSPORT_DIRECTIONS) {
      expect(subscriptionScopeKey(direction, null)).toBe(
        `direction:${direction}`,
      );
    }
  });

  it("never collides a run with a bare direction", () => {
    expect(subscriptionScopeKey("MORNING", "MORNING")).not.toBe(
      subscriptionScopeKey("MORNING", null),
    );
  });

  it("offers no BOTH to a single departure", () => {
    // A run happens once and goes one way; BOTH belongs to an abonnement, and a
    // run claiming it would be two buses wearing one row.
    expect([...SCHEDULE_DIRECTIONS]).toEqual(["MORNING", "AFTERNOON"]);
    expect(SCHEDULE_DIRECTIONS).not.toContain("BOTH");
    expect(TRANSPORT_DIRECTIONS).toContain("BOTH");
  });
});

describe("scheduleLabel", () => {
  it("names a run by when it leaves, not only by its code", () => {
    // A secretary asked to put a child on "M1" has to remember what M1 means,
    // and a parent on the phone never knew.
    expect(scheduleLabel("M1", "07:00")).toBe("M1 · 07:00");
  });
});

describe("isTimeOfDay", () => {
  it("accepts a wall-clock time", () => {
    for (const value of ["00:00", "07:00", "13:45", "23:59"]) {
      expect(isTimeOfDay(value), value).toBe(true);
    }
  });

  it("refuses anything that would break the ordering", () => {
    for (const value of ["", "7:00", "24:00", "07:60", "07:00:00", "0700", "ab:cd"]) {
      expect(isTimeOfDay(value), value).toBe(false);
    }
  });
});

// ── L'appel du bus ───────────────────────────────────────────────────────────

describe("bus attendance", () => {
  it("counts a child who kept the bus waiting as having ridden", () => {
    expect(RIDER_ATTENDANCE_STATUSES.filter(boarded)).toEqual([
      "PRESENT",
      "LATE",
    ]);
  });

  it("keeps a child unaccounted for apart from one nobody is waiting on", () => {
    // At half past seven in the morning these are completely different
    // problems.
    expect([...OFF_BUS_STATUSES]).toEqual(["ABSENT", "EXCUSED"]);
    for (const status of OFF_BUS_STATUSES) {
      expect(boarded(status), status).toBe(false);
    }
  });

  it("uses the same four words as the classroom register", () => {
    // Deliberately: a driver and a teacher describing the same child should not
    // have to learn two vocabularies.
    expect([...RIDER_ATTENDANCE_STATUSES]).toEqual([
      "PRESENT",
      "LATE",
      "ABSENT",
      "EXCUSED",
    ]);
  });

  it("says nothing about a status it has never heard of", () => {
    for (const nonsense of ["", "present", "BOARDED", "__proto__"]) {
      expect(boarded(nonsense), nonsense).toBe(false);
    }
  });

  it("gives a line with no run declared a real key rather than NULL", () => {
    // SQLite treats NULLs as distinct, so without this a rider could be marked
    // twice for the same departure and counted absent twice.
    expect(busRegisterScopeKey(null)).toBe(busRegisterScopeKey(undefined));
    expect(busRegisterScopeKey("run-1")).toBe("run-1");
    expect(busRegisterScopeKey(null)).not.toBe("run-1");
  });
});

describe("tallyBusRegister", () => {
  const entry = (status: string | null) => ({ status });

  it("counts each status and what is still unmarked", () => {
    const tally = tallyBusRegister([
      entry("PRESENT"),
      entry("PRESENT"),
      entry("LATE"),
      entry("ABSENT"),
      entry("EXCUSED"),
      entry(null),
    ]);
    expect(tally).toEqual({
      marked: 5,
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
      unmarked: 1,
    });
  });

  it("keeps marked and unmarked adding up to the sheet", () => {
    const entries = [
      ...RIDER_ATTENDANCE_STATUSES.map((status) => entry(status)),
      entry(null),
      entry(null),
    ];
    const tally = tallyBusRegister(entries);
    expect(tally.marked + tally.unmarked).toBe(entries.length);
  });

  it("tallies an empty run as empty", () => {
    expect(tallyBusRegister([])).toEqual({
      marked: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      unmarked: 0,
    });
  });
});

// ── Le voyage ────────────────────────────────────────────────────────────────

describe("canMoveTripRun", () => {
  it("lets a planned run go out or be called off", () => {
    expect(canMoveTripRun("PLANNED", "EN_ROUTE")).toBe(true);
    expect(canMoveTripRun("PLANNED", "CANCELLED")).toBe(true);
  });

  it("lets a run under way come back, or break down", () => {
    // A breakdown halfway round is exactly the case, and cancelling is the only
    // honest thing to call it.
    expect(canMoveTripRun("EN_ROUTE", "ARRIVED")).toBe(true);
    expect(canMoveTripRun("EN_ROUTE", "CANCELLED")).toBe(true);
  });

  it("never un-arrives a bus that has returned", () => {
    // It would leave the morning's timings meaning nothing. A run closed by
    // mistake is corrected the way a receipt is — cancelled, with a reason.
    for (const next of TRIP_RUN_STATUSES) {
      expect(canMoveTripRun("ARRIVED", next), next).toBe(false);
    }
  });

  it("never revives a cancelled run", () => {
    for (const next of TRIP_RUN_STATUSES) {
      expect(canMoveTripRun("CANCELLED", next), next).toBe(false);
    }
  });

  it("never lets a run skip straight from planned to arrived", () => {
    // A bus that never left cannot have come back.
    expect(canMoveTripRun("PLANNED", "ARRIVED")).toBe(false);
  });

  it("never lets a run move to where it already is", () => {
    for (const status of TRIP_RUN_STATUSES) {
      expect(canMoveTripRun(status, status), status).toBe(false);
    }
  });

  it("answers false for a state it has never heard of, rather than throwing", () => {
    // `TRIP_RUN_TRANSITIONS` is a plain object, so a bare lookup of
    // "constructor" answered a function and calling `.includes` on it threw.
    for (const from of ["", "__proto__", "constructor", "toString", "en_route"]) {
      expect(canMoveTripRun(from, "ARRIVED"), from).toBe(false);
    }
    expect(canMoveTripRun("PLANNED", "__proto__")).toBe(false);
  });

  it("shows a passenger list only once the bus has actually gone", () => {
    // The départ is what declares which voyage is being made. A cancelled run
    // has no register at all — offering one would invite marks against a bus
    // nobody rode.
    expect([...REGISTER_OPEN_STATUSES]).toEqual(["EN_ROUTE", "ARRIVED"]);
    expect(REGISTER_OPEN_STATUSES).not.toContain("PLANNED");
    expect(REGISTER_OPEN_STATUSES).not.toContain("CANCELLED");
  });

  it("counts only a run under way as out on the road", () => {
    expect([...ACTIVE_TRIP_RUN_STATUSES]).toEqual(["EN_ROUTE"]);
  });
});

describe("tripRunWindow", () => {
  const day = new Date(2026, 0, 15);
  const at = (hours: number, minutes = 0) =>
    new Date(2026, 0, 15, hours, minutes);

  it("opens an hour before the bus is due out", () => {
    // Long enough that a driver checking his sheet over coffee finds it open.
    expect(tripRunWindow(day, "07:00", at(6, 0))).toBe("OPEN");
    expect(tripRunWindow(day, "07:00", at(5, 59))).toBe("UPCOMING");
  });

  it("stays open through the round", () => {
    expect(tripRunWindow(day, "07:00", at(7, 0))).toBe("OPEN");
    expect(tripRunWindow(day, "07:00", at(9, 30))).toBe("OPEN");
  });

  it("closes three hours after the planned departure", () => {
    // Measured from the *planned* time, so a bus that left forty minutes late
    // still gets its full round.
    expect(tripRunWindow(day, "07:00", at(10, 0))).toBe("OPEN");
    expect(tripRunWindow(day, "07:00", at(10, 1))).toBe("CLOSED");
  });

  it("keeps the morning run and an afternoon one from both being now", () => {
    // The whole reason the phone reads a window rather than a status: at 07:00
    // there is exactly one voyage that concerns the driver.
    expect(tripRunWindow(day, "07:00", at(7, 0))).toBe("OPEN");
    expect(tripRunWindow(day, "17:00", at(7, 0))).toBe("UPCOMING");
  });

  it("keeps yesterday's seven o'clock shut at seven this morning", () => {
    const yesterday = new Date(2026, 0, 14);
    expect(tripRunWindow(yesterday, "07:00", at(7, 0))).toBe("CLOSED");
  });

  it("keeps tomorrow's run out of reach today", () => {
    const tomorrow = new Date(2026, 0, 16);
    expect(tripRunWindow(tomorrow, "07:00", at(7, 0))).toBe("UPCOMING");
  });

  it("closes a run whose time nothing can read", () => {
    // The bug this closes, and it failed the dangerous way round. The guard was
    // written against NaN, but `"nonsense".split(":").map(Number)` gives `[NaN]`
    // — so the *minutes* came back `undefined`, `Number.isNaN(undefined)` is
    // false, and `setHours` turned the whole date Invalid. Every comparison
    // against an Invalid Date is false, so the window that was meant to fail
    // CLOSED failed OPEN, and the run was tappable on a driver's phone at any
    // hour of any day.
    for (const time of ["nonsense", "", "0700", "7"]) {
      expect(tripRunWindow(day, time, at(12, 0)), time).toBe("CLOSED");
    }
  });

  it("never reads OPEN on another day, whatever the time column says", () => {
    // The failure was not one bad hour: an Invalid Date read OPEN for
    // yesterday's run and next week's alike, which is what made it worth
    // fixing rather than tidying.
    for (const time of ["nonsense", "", "0700", "07:00"]) {
      expect(tripRunWindow(new Date(2026, 0, 14), time, at(12, 0)), time).toBe(
        "CLOSED",
      );
      expect(tripRunWindow(new Date(2026, 0, 20), time, at(12, 0)), time).toBe(
        "UPCOMING",
      );
    }
  });

  it("still opens the small hours of the run's own day", () => {
    // What "falls back to midnight" actually means, kept honest: the run is not
    // unreachable, it is reachable at the hour midnight implies.
    expect(tripRunWindow(day, "", new Date(2026, 0, 15, 0, 30))).toBe("OPEN");
  });

  it("uses the window constants it declares", () => {
    const before = new Date(
      at(7, 0).getTime() - RUN_WINDOW_BEFORE_MINUTES * 60_000,
    );
    const after = new Date(
      at(7, 0).getTime() + RUN_WINDOW_AFTER_MINUTES * 60_000,
    );
    expect(tripRunWindow(day, "07:00", before)).toBe("OPEN");
    expect(tripRunWindow(day, "07:00", after)).toBe("OPEN");
  });
});

describe("departureDelayMinutes", () => {
  it("says how late the bus pulled out", () => {
    expect(
      departureDelayMinutes("07:00", new Date(2026, 0, 15, 7, 12)),
    ).toBe(12);
  });

  it("keeps an early departure as a negative rather than clamping it", () => {
    // A circuit that habitually leaves four minutes early is a finding, not a
    // rounding error.
    expect(departureDelayMinutes("07:00", new Date(2026, 0, 15, 6, 56))).toBe(-4);
  });

  it("answers nothing for a run that has not left", () => {
    expect(departureDelayMinutes("07:00", null)).toBeNull();
  });

  it("answers nothing for a time it cannot read", () => {
    // Including the shapes that used to slip past the NaN guard and come back
    // as a delay of NaN, which renders as "NaN min late" rather than as no
    // answer at all.
    for (const time of ["nonsense", "", "0700", "7", "07", "25:00", "07:60"]) {
      expect(
        departureDelayMinutes(time, new Date(2026, 0, 15, 7, 0)),
        time,
      ).toBeNull();
    }
  });

  it("compares in the run's own day", () => {
    // The planned time is wall-clock text and the stamp is an instant; the two
    // only line up on the same date.
    expect(departureDelayMinutes("07:00", new Date(2026, 5, 30, 7, 5))).toBe(5);
  });
});

// ── Le carburant ─────────────────────────────────────────────────────────────

describe("litres", () => {
  it("stores tenths, so 45,3 litres is exact", () => {
    // A consumption figure built from drifting halves is worse than none.
    expect(litresToTenths(45.3)).toBe(453);
    expect(tenthsToLitres(453)).toBe(45.3);
  });

  it("round-trips every figure a pump prints", () => {
    for (const litres of [0, 0.1, 5.5, 45.3, 60, 99.9]) {
      expect(tenthsToLitres(litresToTenths(litres)), String(litres)).toBe(litres);
    }
  });

  it("snaps to the nearest tenth", () => {
    expect(litresToTenths(45.34)).toBe(453);
    expect(litresToTenths(45.36)).toBe(454);
  });
});

describe("consumptionPer100km", () => {
  it("works the figure out in tenths, like the litres it comes from", () => {
    // 60 litres over 500 km is 12 L/100km — 120 tenths.
    expect(consumptionPer100km(600, 500)).toBe(120);
  });

  it("answers nothing rather than zero when the odometer did not move", () => {
    // "We do not know" and "this bus used nothing" are different answers, and
    // 0,0 L/100km beside a bus somebody forgot to read the meter on is worse
    // than a blank.
    expect(consumptionPer100km(600, 0)).toBeNull();
    expect(consumptionPer100km(600, -20)).toBeNull();
  });

  it("answers nothing for a fill nobody recorded", () => {
    expect(consumptionPer100km(0, 500)).toBeNull();
  });
});

describe("fuel request statuses", () => {
  it("keeps agreeing to a spend apart from handing over the notes", () => {
    // Two acts, often on two different days, and a school reconciling a till
    // needs to know which of the two has happened.
    expect([...FUEL_REQUEST_STATUSES]).toEqual([
      "PENDING",
      "APPROVED",
      "REJECTED",
      "PAID",
    ]);
    expect([...SETTLED_FUEL_STATUSES]).toEqual(["APPROVED", "PAID"]);
  });

  it("never counts a refusal as spending on a bus", () => {
    expect(COUNTED_FUEL_STATUSES).not.toContain("REJECTED");
    expect([...COUNTED_FUEL_STATUSES]).toEqual(["PENDING", "APPROVED", "PAID"]);
  });

  it("has a décaissement behind exactly the settled statuses", () => {
    for (const status of FUEL_REQUEST_STATUSES) {
      expect(
        SETTLED_FUEL_STATUSES.includes(status),
        status,
      ).toBe(status === "APPROVED" || status === "PAID");
    }
  });
});

// ── Deciding a request, and the money it moves ───────────────────────────────

const REQUEST: {
  id: string;
  status: string;
  amountCentimes: number;
  litresTenths: number;
  occurredOn: Date;
  cashOperationId: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  vehicle: { registration: string };
  requestedBy: { firstName: string; lastName: string } | null;
} = {
  id: "req-1",
  status: "PENDING",
  amountCentimes: 45_000,
  litresTenths: 453,
  occurredOn: new Date(2026, 0, 15),
  cashOperationId: null,
  requestedById: "staff-1",
  requestedByName: "K. Alaoui",
  vehicle: { registration: "12345-A-6" },
  requestedBy: { firstName: "Karim", lastName: "Alaoui" },
};

const decision = (extra: Record<string, unknown> = {}) => ({
  requestId: "req-1",
  schoolId: "school-1",
  status: "APPROVED" as const,
  decidedById: "user-1",
  cashSessionId: "session-1",
  categoryId: "cat-fuel",
  notes: null,
  ...extra,
});

const pending = (extra: Partial<typeof REQUEST> = {}) => {
  answers = { "fuelRequest.findFirst": { ...REQUEST, ...extra } };
};

describe("decideFuelRequest", () => {
  it("posts the money when a request is approved", async () => {
    pending();
    const result = await decideFuelRequest(decision());

    expect(result).toEqual({ ok: true, operationId: "op-1" });
    expect(disbursements).toHaveLength(1);
    expect(disbursements[0]!.input).toMatchObject({
      schoolId: "school-1",
      amountCentimes: 45_000,
      method: "CASH",
      categoryId: "cat-fuel",
      cashSessionId: "session-1",
    });
  });

  it("posts and claims inside one transaction", async () => {
    // The bug this closes. It used to read the request, check it was pending,
    // post the money and then write the link — three statements, each its own
    // transaction — on the reasoning that the unique index on
    // `cashOperationId` would stop a double click paying twice. It could not:
    // that index stops two *requests* claiming one movement, which is the
    // opposite direction. Two approvals of one request each made their own
    // operation and violated nothing, so a double-clicked Approve posted a tank
    // of diesel twice and orphaned the first movement.
    pending();
    await decideFuelRequest(decision());

    expect(disbursements[0]!.hadTx).toBe(true);
  });

  it("refuses the second of two approvals rather than paying twice", async () => {
    // The conditional update matches no rows for whichever call arrives second,
    // and its own movement rolls back with the transaction.
    pending();
    claimCount = 0;

    expect(await decideFuelRequest(decision())).toEqual({
      ok: false,
      reason: "ALREADY_DECIDED",
    });
  });

  it("restates the state it decided against as the claim's condition", async () => {
    pending();
    await decideFuelRequest(decision());

    const claim = of("fuelRequest", "updateMany").at(-1)!;
    expect(claim.args).toMatchObject({
      where: {
        id: "req-1",
        schoolId: "school-1",
        status: "PENDING",
        cashOperationId: null,
      },
      data: { status: "APPROVED", cashOperationId: "op-1" },
    });
  });

  it("scopes the request by the school in context, never by id alone", async () => {
    pending();
    await decideFuelRequest(decision());

    expect(of("fuelRequest", "findFirst")[0]!.args).toMatchObject({
      where: { id: "req-1", schoolId: "school-1" },
    });
  });

  it("refuses a request of another school", async () => {
    expect(await decideFuelRequest(decision())).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
    expect(disbursements).toEqual([]);
  });

  it("refuses a request already decided", async () => {
    for (const status of ["APPROVED", "REJECTED", "PAID"]) {
      calls.length = 0;
      disbursements.length = 0;
      pending({ status });

      expect(await decideFuelRequest(decision()), status).toEqual({
        ok: false,
        reason: "ALREADY_DECIDED",
      });
      expect(disbursements, status).toEqual([]);
    }
  });

  it("refuses one that already points at a movement", async () => {
    // Belt and braces behind the status: an approved request with a movement is
    // the same fact said twice, and either half alone must stop a second one.
    pending({ status: "PENDING", cashOperationId: "op-earlier" });

    expect(await decideFuelRequest(decision())).toEqual({
      ok: false,
      reason: "ALREADY_DECIDED",
    });
    expect(disbursements).toEqual([]);
  });

  it("refuses to post a movement for nothing", async () => {
    pending({ amountCentimes: 0 });
    expect(await decideFuelRequest(decision())).toEqual({
      ok: false,
      reason: "NOTHING_TO_PAY",
    });
    expect(disbursements).toEqual([]);
  });

  // ── The refusal ────────────────────────────────────────────────────────────

  it("writes no movement for a refused request", async () => {
    pending();
    const result = await decideFuelRequest(decision({ status: "REJECTED" }));

    expect(result).toEqual({ ok: true, operationId: null });
    expect(disbursements).toEqual([]);
  });

  it("records a refusal rather than deleting it", async () => {
    // So a second ask for the same tank reads as a second ask.
    pending();
    await decideFuelRequest(decision({ status: "REJECTED", notes: "Trop tôt." }));

    expect(of("fuelRequest", "updateMany").at(-1)!.args).toMatchObject({
      data: { status: "REJECTED", decidedById: "user-1", notes: "Trop tôt." },
    });
  });

  it("refuses a second refusal too", async () => {
    pending();
    claimCount = 0;
    expect(
      await decideFuelRequest(decision({ status: "REJECTED" })),
    ).toEqual({ ok: false, reason: "ALREADY_DECIDED" });
  });

  // ── What the ledger line says ──────────────────────────────────────────────

  it("names the bus and the litres in the label", async () => {
    // What makes the line answerable three months later.
    pending();
    await decideFuelRequest(decision());

    expect(disbursements[0]!.input["label"]).toBe(
      "Carburant — 12345-A-6, 45.3 L",
    );
  });

  it("names the employee who drew the fuel", async () => {
    pending();
    await decideFuelRequest(decision());

    expect(disbursements[0]!.input).toMatchObject({
      beneficiaryName: "Karim Alaoui",
      beneficiaryStaffId: "staff-1",
    });
  });

  it("falls back to the typed name for a contractor", async () => {
    pending({ requestedBy: null, requestedById: null });
    await decideFuelRequest(decision());
    expect(disbursements[0]!.input["beneficiaryName"]).toBe("K. Alaoui");
  });

  it("falls back to the bus itself when nobody was named at all", async () => {
    pending({
      requestedBy: null,
      requestedById: null,
      requestedByName: null,
    });
    await decideFuelRequest(decision());
    expect(disbursements[0]!.input["beneficiaryName"]).toBe("12345-A-6");
  });

  it("posts the movement on the day the fuel was drawn", async () => {
    // Not the day somebody got round to approving it — a tank taken on the 15th
    // is the 15th's spend.
    pending();
    await decideFuelRequest(decision());
    expect(disbursements[0]!.input["occurredAt"]).toEqual(new Date(2026, 0, 15));
  });

  it("takes the amount from the request, never from the decision", async () => {
    // The approver agrees to what was asked for; a figure travelling with the
    // decision would let the two disagree.
    pending({ amountCentimes: 99_999 });
    await decideFuelRequest(decision({ amountCentimes: 1 } as never));
    expect(disbursements[0]!.input["amountCentimes"]).toBe(99_999);
  });

  it("lets a genuine ledger failure through rather than reporting success", async () => {
    pending();
    disbursementFails = true;
    await expect(decideFuelRequest(decision())).rejects.toThrow(
      "ledger unavailable",
    );
  });
});
