import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { splitIntoInstalments } from "@/modules/billing/enums";
import {
  ENROLMENT_STATUSES,
  FEE_LINE_STATUSES,
  LIVE_ENROLMENT_STATUSES,
  defaultInstalmentCount,
  instalmentDueDates,
  isPayable,
  monthKeyFromString,
  monthKeyString,
  monthOrdinal,
  monthsOfYear,
  netAmount,
  startOfMonth,
} from "@/modules/enrolment/enums";
import {
  buildScheduleLines,
  type ScheduleInput,
} from "@/modules/enrolment/schedule";
import { enrolmentSchema, feeLineSchema } from "@/modules/enrolment/validation";

/**
 * L'échéancier: what a family is charged, and when.
 *
 * The whole year is written the day the family signs — twelve or so rows per
 * pupil — rather than derived by a screen. That is deliberate, and it is what
 * makes every rule below load-bearing: once a row exists, a receipt attaches to
 * it, and a figure that moves afterwards moves money.
 *
 *   * **The price is fixed the day the family signs.** The amount is copied off
 *     the rate, never read back through it, so a rate corrected in November
 *     cannot restate what was agreed in September.
 *   * **Nothing divides badly.** Instalments sum exactly back to the annual
 *     figure; a reduction is applied percentage-then-flat, in that order, and
 *     floored at zero.
 *   * **A mid-year opt-in is pro-rated by the calendar**, not by a second
 *     division of the annual figure — and its `periodIndex` still counts from
 *     the top of the year, because that is half the unique the schedule is made
 *     idempotent by.
 *   * **Money already taken pins the line.** Waiving a charge somebody has paid
 *     made their money disappear from every "how much has this pupil paid" sum
 *     while the caisse went on counting it.
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * `tx` records whether the statement ran inside a transaction.
 *
 * Money rules that read a figure and then write against it are only rules if
 * both halves are one atomic act — otherwise a receipt commits in the gap and
 * the guard decided on a past that no longer holds. That is invisible to an
 * assertion on the arguments, so the harness tracks the boundary itself.
 */
type Call = { model: string; op: string; args: unknown; tx: boolean };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};
let txDepth = 0;

const EMPTY: Record<string, unknown> = {
  findMany: [],
  count: 0,
  findFirst: null,
  findUnique: null,
  create: {},
  createMany: { count: 0 },
  update: {},
  deleteMany: { count: 0 },
  aggregate: { _sum: {} },
};

function delegate(model: string) {
  return new Proxy(
    {},
    {
      get: (_d, op: string) => async (args: unknown) => {
        calls.push({ model, op, args, tx: txDepth > 0 });
        const key = `${model}.${op}`;
        if (key in answers) return answers[key];
        return op in EMPTY ? EMPTY[op] : null;
      },
    },
  );
}

const db = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      if (model === "$transaction") {
        return async (work: unknown) => {
          txDepth += 1;
          try {
            return typeof work === "function"
              ? await (work as (tx: unknown) => unknown)(db)
              : await Promise.all(work as unknown[]);
          } finally {
            txDepth -= 1;
          }
        };
      }
      return delegate(model);
    },
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));
vi.mock("@/modules/students/service", () => ({
  refreshStudentStatus: async () => {},
}));
vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({
    defaultInstalmentCount: 0,
    feeDueDayOfMonth: 0,
  }),
}));

const {
  assignClass,
  buildFeeSchedule,
  repriceFeeLine,
  repriceFollowingLines,
  replaceOptions,
  resolveOptionStart,
  resyncOptionalCharges,
  setEnrolmentStatus,
} = await import("@/modules/enrolment/service");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

const only = (model: string, op: string): Call => {
  const matches = of(model, op);
  expect(matches, `${model}.${op}`).toHaveLength(1);
  return matches[0]!;
};

beforeEach(() => {
  calls.length = 0;
  answers = {};
  txDepth = 0;
});

// ── What one line costs ──────────────────────────────────────────────────────

describe("netAmount", () => {
  it("takes the percentage first, then the flat sum", () => {
    // The order is fixed on purpose: 1000 less 10% less 50 is 850, and the
    // other way round it is 855. Two screens disagreeing about a parent's bill
    // by a few dirhams is a support call.
    expect(netAmount(100_000, 1000, 5_000)).toBe(85_000);
  });

  it("never answers a negative", () => {
    // A reduction larger than the charge is a data-entry slip, not a credit
    // note — and a negative line would subtract from what the family owes.
    expect(netAmount(10_000, 0, 50_000)).toBe(0);
    expect(netAmount(10_000, 10_000, 1)).toBe(0);
  });

  it("leaves a line with no reduction alone", () => {
    expect(netAmount(120_000, 0, 0)).toBe(120_000);
  });

  it("takes a full-percentage reduction down to nothing", () => {
    expect(netAmount(120_000, 10_000, 0)).toBe(0);
  });

  it("rounds to whole centimes", () => {
    // 33.33% of 100 dirhams is not a whole centime. Money is an integer column,
    // so the rounding has to happen once, here.
    const net = netAmount(10_000, 3333, 0);
    expect(Number.isInteger(net)).toBe(true);
    expect(net).toBe(6_667);
  });
});

describe("splitIntoInstalments", () => {
  it("sums exactly back to the annual figure", () => {
    // Dividing and rounding each part independently is what leaves a school a
    // centime short on every schedule it issues.
    for (const [amount, count] of [
      [1_000_000, 9],
      [100, 3],
      [1, 9],
      [999_999, 7],
      [123_457, 12],
    ] as const) {
      const parts = splitIntoInstalments(amount, count);
      expect(parts, `${amount}/${count}`).toHaveLength(count);
      expect(parts.reduce((sum, part) => sum + part, 0), `${amount}/${count}`).toBe(
        amount,
      );
    }
  });

  it("spreads the remainder over the first instalments", () => {
    // A family pays the odd centime early rather than being surprised by a
    // larger last month.
    expect(splitIntoInstalments(100, 3)).toEqual([34, 33, 33]);
  });

  it("never differs by more than a centime between months", () => {
    const parts = splitIntoInstalments(1_000_000, 9);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it("answers nothing for no instalments", () => {
    expect(splitIntoInstalments(1000, 0)).toEqual([]);
  });
});

// ── The calendar ─────────────────────────────────────────────────────────────

describe("monthsOfYear", () => {
  it("takes the months the year actually touches", () => {
    // Built from the year's own dates rather than assumed September–June: a
    // school running to mid-July gets a July column, and one that does not is
    // not given an empty one.
    const months = monthsOfYear(new Date(2025, 8, 15), new Date(2026, 5, 30));
    expect(months).toHaveLength(10);
    expect(months[0]).toEqual({ year: 2025, month: 9 });
    expect(months[9]).toEqual({ year: 2026, month: 6 });
  });

  it("counts a year that runs into July", () => {
    expect(monthsOfYear(new Date(2025, 8, 1), new Date(2026, 6, 15))).toHaveLength(
      11,
    );
  });

  it("counts a single month as one", () => {
    expect(monthsOfYear(new Date(2025, 8, 1), new Date(2025, 8, 30))).toEqual([
      { year: 2025, month: 9 },
    ]);
  });

  it("terminates on a year whose end precedes its start", () => {
    // Validation stops that at the form; a loop that would never end is not
    // worth risking.
    expect(monthsOfYear(new Date(2026, 5, 1), new Date(2025, 8, 1))).toEqual([]);
  });

  it("bounds itself on an absurd range", () => {
    expect(
      monthsOfYear(new Date(2000, 0, 1), new Date(2099, 0, 1)).length,
    ).toBeLessThanOrEqual(24);
  });
});

describe("monthOrdinal", () => {
  it("orders a year that straddles two calendar years", () => {
    // Comparing month numbers alone is exactly where this gets it wrong:
    // January is month 1 and comes *after* September.
    expect(monthOrdinal(new Date(2026, 0, 15))).toBeGreaterThan(
      monthOrdinal(new Date(2025, 8, 15)),
    );
  });

  it("ignores the day of the month", () => {
    expect(monthOrdinal(new Date(2025, 8, 1))).toBe(
      monthOrdinal(new Date(2025, 8, 30)),
    );
  });
});

describe("month keys", () => {
  it("round-trips through its string form", () => {
    for (const key of [
      { year: 2025, month: 9 },
      { year: 2026, month: 1 },
      { year: 2026, month: 12 },
    ]) {
      expect(monthKeyFromString(monthKeyString(key))).toEqual(key);
    }
  });

  it("pads the month, so the keys sort", () => {
    expect(monthKeyString({ year: 2026, month: 1 })).toBe("2026-01");
    expect(monthKeyString({ year: 2025, month: 9 }) < "2026-01").toBe(true);
  });

  it("reads nothing as nothing, so blank and nonsense are the same answer", () => {
    for (const value of ["", "  ", "2026", "2026-1", "2026-13", "2026-00", "x"]) {
      expect(monthKeyFromString(value), value).toBeNull();
    }
  });

  it("takes the first of the month as the stored date", () => {
    const date = startOfMonth({ year: 2026, month: 1 });
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0);
    expect(date.getFullYear()).toBe(2026);
  });
});

describe("instalmentDueDates", () => {
  const yearStart = new Date(2025, 8, 15);
  const yearEnd = new Date(2026, 5, 30);

  it("bills on the year's own opening day when nothing says otherwise", () => {
    // Rather than an invented convention nobody could explain: a year opening
    // on 15 September bills on the 15th.
    const dates = instalmentDueDates(yearStart, yearEnd, 3);
    expect(dates.map((date) => date.getDate())).toEqual([15, 15, 15]);
  });

  it("takes the school's own day when it has one", () => {
    const dates = instalmentDueDates(yearStart, yearEnd, 2, 5);
    expect(dates.map((date) => date.getDate())).toEqual([5, 5]);
  });

  it("clamps a day the month does not have", () => {
    // The 31st in a 30-day month would roll into the next one, putting the line
    // in a different column from the month it says it is in.
    const dates = instalmentDueDates(new Date(2025, 8, 1), new Date(2025, 10, 30), 3, 31);
    expect(dates.map((date) => date.getMonth())).toEqual([8, 9, 10]);
    expect(dates.map((date) => date.getDate())).toEqual([30, 31, 30]);
  });

  it("steps a month at a time", () => {
    const dates = instalmentDueDates(yearStart, yearEnd, 4);
    expect(dates.map((date) => date.getMonth())).toEqual([8, 9, 10, 11]);
  });

  it("clamps a plan longer than the year to its last month", () => {
    // A nine-month plan on a six-month year still produces nine dated lines,
    // rather than dates in the holidays.
    const dates = instalmentDueDates(new Date(2025, 8, 1), new Date(2026, 1, 28), 9);
    expect(dates).toHaveLength(9);
    for (const date of dates) {
      expect(monthOrdinal(date)).toBeLessThanOrEqual(
        monthOrdinal(new Date(2026, 1, 1)),
      );
    }
  });

  it("answers nothing for no instalments", () => {
    expect(instalmentDueDates(yearStart, yearEnd, 0)).toEqual([]);
    expect(instalmentDueDates(yearStart, yearEnd, -3)).toEqual([]);
  });
});

describe("defaultInstalmentCount", () => {
  it("follows the calendar for a monthly charge", () => {
    // It used to be a fixed nine, which is true of a September–June year and
    // silently wrong of any other: a twelve-month year stopped billing in
    // November with three months left to run, and nothing said so on screen
    // because nine was a number no form ever showed.
    expect(defaultInstalmentCount("MONTHLY", 12, 3)).toBe(12);
    expect(defaultInstalmentCount("MONTHLY", 10, 3)).toBe(10);
  });

  it("lets a school that really does collect nine say so", () => {
    expect(defaultInstalmentCount("MONTHLY", 10, 3, 9)).toBe(9);
  });

  it("collects a term charge once per term", () => {
    expect(defaultInstalmentCount("TERM", 10, 3)).toBe(3);
    expect(defaultInstalmentCount("TERM", 10, 2)).toBe(2);
  });

  it("collects an annual or one-off charge once", () => {
    expect(defaultInstalmentCount("ANNUAL", 10, 3)).toBe(1);
    expect(defaultInstalmentCount("ONE_OFF", 10, 3)).toBe(1);
    expect(defaultInstalmentCount("SOMETHING_ELSE", 10, 3)).toBe(1);
  });

  it("never answers fewer than one instalment", () => {
    // A charge collected zero times is a charge nobody is billed for.
    expect(defaultInstalmentCount("MONTHLY", 0, 0)).toBe(1);
    expect(defaultInstalmentCount("TERM", 10, 0)).toBe(1);
  });
});

// ── Building the schedule ────────────────────────────────────────────────────

const scolarite = {
  id: "fee-scolarite",
  kind: "TUITION",
  billingCycle: "MONTHLY",
  isMandatory: true,
};
const transport = {
  id: "fee-transport",
  kind: "TRANSPORT",
  billingCycle: "MONTHLY",
  isMandatory: false,
};
const canteen = {
  id: "fee-canteen",
  kind: "CANTEEN",
  billingCycle: "MONTHLY",
  isMandatory: false,
};
/** A charge the old design had no way to sell. See EnrollmentOption. */
const club = {
  id: "fee-club",
  kind: "CLUB",
  billingCycle: "ANNUAL",
  isMandatory: false,
};

const rate = (extra: Record<string, unknown> = {}) => ({
  id: "rate-1",
  feeTypeId: "fee-scolarite",
  amountCentimes: 900_000,
  instalmentCount: 9,
  perInstalment: false,
  scopeKey: "",
  ...extra,
});

const schedule = (extra: Partial<ScheduleInput> = {}): ScheduleInput => ({
  levelId: "level-1",
  options: [],
  yearStart: new Date(2025, 8, 1),
  yearEnd: new Date(2026, 5, 30),
  termCount: 3,
  feeTypes: [scolarite],
  rates: [rate()],
  instalmentsPerYear: 0,
  dueDayOfMonth: 5,
  ...extra,
});

describe("buildScheduleLines", () => {
  it("bills a mandatory charge to everybody", () => {
    const lines = buildScheduleLines(schedule());
    expect(lines).toHaveLength(9);
    expect(lines[0]).toMatchObject({
      feeTypeId: "fee-scolarite",
      periodIndex: 1,
      dueMonth: 9,
      dueYear: 2025,
      status: "DUE",
    });
  });

  it("sums the instalments back to the year's price", () => {
    const lines = buildScheduleLines(schedule());
    expect(lines.reduce((sum, line) => sum + line.amountCentimes, 0)).toBe(
      900_000,
    );
  });

  it("does not bill an optional charge to a family that did not take it", () => {
    const lines = buildScheduleLines(
      schedule({ feeTypes: [scolarite, transport], rates: [rate(), rate({ id: "rate-2", feeTypeId: "fee-transport", amountCentimes: 450_000 })] }),
    );
    expect(lines.every((line) => line.feeTypeId === "fee-scolarite")).toBe(true);
  });

  it("bills one the family did take", () => {
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-transport", startsOn: null }],
        feeTypes: [transport],
        rates: [
          rate({ id: "rate-2", feeTypeId: "fee-transport", amountCentimes: 450_000 }),
        ],
      }),
    );
    expect(lines).toHaveLength(9);
    expect(lines.reduce((sum, line) => sum + line.amountCentimes, 0)).toBe(
      450_000,
    );
  });

  it("does not bill a club just because the family is on the bus", () => {
    // Subscriptions name the charge they are for, so taking the bus and the
    // cantine says nothing whatever about a club.
    const lines = buildScheduleLines(
      schedule({
        options: [
          { feeTypeId: "fee-transport", startsOn: null },
          { feeTypeId: "fee-canteen", startsOn: null },
        ],
        feeTypes: [club],
        rates: [rate({ id: "rate-3", feeTypeId: "fee-club" })],
      }),
    );
    expect(lines).toEqual([]);
  });

  it("bills a club to the family that subscribed to it", () => {
    /*
      The case the old design could not express at all.

      `isSubscribed` switched on `FeeType.kind` and knew two names, so a
      school's own optional charge could be declared in the catalogue and then
      never sold — the only route was a bursar typing the lines onto each
      échéancier by hand. Nothing here knows what a club is; it is billed
      because the family asked for it. See EnrollmentOption.
    */
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-club", startsOn: null }],
        feeTypes: [club],
        rates: [
          rate({
            id: "rate-3",
            feeTypeId: "fee-club",
            amountCentimes: 120_000,
            instalmentCount: 3,
          }),
        ],
      }),
    );

    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.feeTypeId === "fee-club")).toBe(true);
    expect(lines.reduce((sum, line) => sum + line.amountCentimes, 0)).toBe(
      120_000,
    );
  });

  it("prorates a club from its own start month, like any other opt-in", () => {
    // The mid-year rule is a property of the subscription, not of the two kinds
    // that used to have a start-month column each.
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-club", startsOn: new Date(2026, 0, 1) }],
        feeTypes: [club],
        rates: [
          rate({ id: "rate-3", feeTypeId: "fee-club", instalmentCount: 9 }),
        ],
      }),
    );

    // Still numbered from the top of the year — see the note on `periodIndex`.
    expect(lines.map((line) => line.periodIndex)).toEqual([5, 6, 7, 8, 9]);
  });

  it("bills a mandatory charge to a family that subscribed to nothing", () => {
    // `isMandatory` is the whole test. Scolarité is not opted into and never
    // was; only the optional charges consult the subscriptions.
    const lines = buildScheduleLines(schedule({ options: [] }));
    expect(lines).toHaveLength(9);
    expect(lines.every((line) => line.feeTypeId === "fee-scolarite")).toBe(true);
  });

  it("ignores a subscription to a charge the school made mandatory", () => {
    // A stale row — the school changed its mind and made the cantine
    // compulsory. It is billed to everyone either way, and must not be billed
    // twice.
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-canteen", startsOn: null }],
        feeTypes: [{ ...canteen, isMandatory: true }],
        rates: [
          rate({ id: "rate-4", feeTypeId: "fee-canteen", instalmentCount: 9 }),
        ],
      }),
    );

    expect(lines).toHaveLength(9);
    expect(new Set(lines.map((line) => line.feeTypeId))).toEqual(
      new Set(["fee-canteen"]),
    );
  });

  // ── The price list ─────────────────────────────────────────────────────────

  it("lets a level's own price beat the every-level one", () => {
    // Which is what makes a null `levelId` on a rate mean a default rather than
    // a competing price.
    const lines = buildScheduleLines(
      schedule({
        rates: [
          rate({ id: "all", amountCentimes: 900_000, scopeKey: "" }),
          rate({ id: "mine", amountCentimes: 1_800_000, scopeKey: "level-1" }),
        ],
      }),
    );
    expect(lines[0]!.feeRateId).toBe("mine");
    expect(lines.reduce((sum, line) => sum + line.amountCentimes, 0)).toBe(
      1_800_000,
    );
  });

  it("falls back to the every-level price for a level with none of its own", () => {
    const lines = buildScheduleLines(
      schedule({
        levelId: "level-2",
        rates: [
          rate({ id: "all", scopeKey: "" }),
          rate({ id: "other", scopeKey: "level-1", amountCentimes: 1_800_000 }),
        ],
      }),
    );
    expect(lines[0]!.feeRateId).toBe("all");
  });

  it("raises nothing at all where the school has set no price", () => {
    // Not the same as charging nothing: a zero line is one a bursar has to hunt
    // down and explain.
    expect(buildScheduleLines(schedule({ rates: [] }))).toEqual([]);
    expect(
      buildScheduleLines(schedule({ rates: [rate({ amountCentimes: 0 })] })),
    ).toEqual([]);
  });

  it("charges a per-instalment rate on every instalment rather than dividing it", () => {
    const lines = buildScheduleLines(
      schedule({
        rates: [rate({ perInstalment: true, amountCentimes: 100_000, instalmentCount: 9 })],
      }),
    );
    expect(lines).toHaveLength(9);
    expect(lines.every((line) => line.baseAmountCentimes === 100_000)).toBe(true);
  });

  it("follows the rate's own instalment count over any default", () => {
    const lines = buildScheduleLines(
      schedule({ rates: [rate({ instalmentCount: 3 })] }),
    );
    expect(lines).toHaveLength(3);
  });

  it("follows the calendar when the rate does not say", () => {
    const lines = buildScheduleLines(
      schedule({ rates: [rate({ instalmentCount: null })] }),
    );
    expect(lines).toHaveLength(10);
  });

  // ── A mid-year opt-in ──────────────────────────────────────────────────────

  it("bills a January joiner from January", () => {
    // The one mistake nobody forgives: billing a child put on the bus in
    // January for the whole year.
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-canteen", startsOn: new Date(2026, 0, 1) }],
        feeTypes: [canteen],
        rates: [
          rate({
            id: "rate-canteen",
            feeTypeId: "fee-canteen",
            amountCentimes: 900_000,
            instalmentCount: 9,
          }),
        ],
      }),
    );

    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatchObject({ dueMonth: 1, dueYear: 2026 });
  });

  it("keeps the monthly rate for the months actually used", () => {
    // The pro-rata falls out of the calendar rather than being a second,
    // differently-rounded division of the annual figure.
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-canteen", startsOn: new Date(2026, 0, 1) }],
        feeTypes: [canteen],
        rates: [
          rate({
            id: "rate-canteen",
            feeTypeId: "fee-canteen",
            amountCentimes: 900_000,
            instalmentCount: 9,
          }),
        ],
      }),
    );
    expect(lines.every((line) => line.baseAmountCentimes === 100_000)).toBe(true);
  });

  it("still counts periodIndex from the top of the year", () => {
    // Half the (enrolment, feeType, periodIndex) unique the schedule is made
    // idempotent by. Renumbering January to 1 would collide with the September
    // line of a family that started on time.
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-canteen", startsOn: new Date(2026, 0, 1) }],
        feeTypes: [canteen],
        rates: [
          rate({
            id: "rate-canteen",
            feeTypeId: "fee-canteen",
            instalmentCount: 9,
          }),
        ],
      }),
    );
    expect(lines.map((line) => line.periodIndex)).toEqual([5, 6, 7, 8, 9]);
  });

  it("ignores a start month on a charge everybody pays", () => {
    // A mandatory fee is owed by everyone from the rentrée; only the flag-gated
    // kinds carry a start.
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-canteen", startsOn: new Date(2026, 0, 1) }],
        feeTypes: [scolarite],
      }),
    );
    expect(lines).toHaveLength(9);
    expect(lines[0]!.dueMonth).toBe(9);
  });

  it("bills nothing when the opt-in starts after the year ends", () => {
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-canteen", startsOn: new Date(2027, 0, 1) }],
        feeTypes: [canteen],
        rates: [rate({ id: "r", feeTypeId: "fee-canteen" })],
      }),
    );
    expect(lines).toEqual([]);
  });

  it("grants no reduction at generation time", () => {
    // Who qualifies is decided per pupil, afterwards, in the fee grid.
    const lines = buildScheduleLines(schedule());
    for (const line of lines) {
      expect(line.discountBps).toBe(0);
      expect(line.discountCentimes).toBe(0);
      expect(line.amountCentimes).toBe(line.baseAmountCentimes);
    }
  });

  it("records where every figure came from", () => {
    // For the "why am I being charged this?" conversation — kept, and never
    // read back to compute a total.
    const lines = buildScheduleLines(schedule());
    expect(lines.every((line) => line.feeRateId === "rate-1")).toBe(true);
  });

  it("gives each charge a distinct line per instalment", () => {
    const lines = buildScheduleLines(
      schedule({
        options: [{ feeTypeId: "fee-transport", startsOn: null }],
        feeTypes: [scolarite, transport],
        rates: [
          rate(),
          rate({ id: "rate-2", feeTypeId: "fee-transport", amountCentimes: 450_000 }),
        ],
      }),
    );
    const keys = lines.map((line) => `${line.feeTypeId}:${line.periodIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ── The statuses ─────────────────────────────────────────────────────────────

describe("statuses", () => {
  it("counts only a DUE line toward what a family owes", () => {
    expect(FEE_LINE_STATUSES.filter(isPayable)).toEqual(["DUE"]);
  });

  it("keeps a waiver and a correction apart", () => {
    // Both stop the line counting; one is a favour and the other is an
    // administrative correction, and a school reports on them separately.
    expect(FEE_LINE_STATUSES).toContain("WAIVED");
    expect(FEE_LINE_STATUSES).toContain("CANCELLED");
    expect(isPayable("WAIVED")).toBe(false);
    expect(isPayable("CANCELLED")).toBe(false);
  });

  it("treats pending and active as holding a place", () => {
    expect([...LIVE_ENROLMENT_STATUSES]).toEqual(["PENDING", "ACTIVE"]);
    for (const status of ["TRANSFERRED", "WITHDRAWN", "COMPLETED"]) {
      expect(LIVE_ENROLMENT_STATUSES, status).not.toContain(status);
    }
  });

  it("says nothing about a status it has never heard of", () => {
    for (const nonsense of ["", "due", "PAID", "__proto__"]) {
      expect(isPayable(nonsense), nonsense).toBe(false);
    }
  });
});

// ── Seating a pupil ──────────────────────────────────────────────────────────

describe("assignClass", () => {
  const enrolled = () => {
    answers = {
      "enrollment.findUnique": {
        schoolYearId: "year-1",
        schoolClassId: null,
        levelOfferingId: "offering-1",
      },
      "schoolClass.findFirst": { id: "class-1" },
    };
  };

  it("seats a pupil in a class of their own level", async () => {
    enrolled();
    expect(await assignClass("enrol-1", "class-1")).toBe(true);
    expect(only("enrollment", "update").args).toMatchObject({
      data: { schoolClassId: "class-1", classGroupId: null },
    });
  });

  it("checks the class against the pupil's own level offering", async () => {
    // The regression. Both pickers already offer only classes of the pupil's
    // level — the enrolment form even says in its own comment that "the server
    // will refuse" a class of the old level — but the server checked only the
    // year. An id posted directly seated a 1AP child in a 2BAC class, where
    // they sat its timetable and were read against its programme while their
    // échéancier went on being priced for 1AP.
    enrolled();
    await assignClass("enrol-1", "class-1");

    expect(only("schoolClass", "findFirst").args).toMatchObject({
      where: {
        id: "class-1",
        levelOfferingId: "offering-1",
        levelOffering: { schoolYearId: "year-1" },
      },
    });
  });

  it("refuses a class of another level", async () => {
    answers = {
      "enrollment.findUnique": {
        schoolYearId: "year-1",
        schoolClassId: null,
        levelOfferingId: "offering-1",
      },
    };
    expect(await assignClass("enrol-1", "class-from-2bac")).toBe(false);
    expect(of("enrollment", "update")).toEqual([]);
  });

  it("takes a pupil out of a class without looking one up", async () => {
    enrolled();
    expect(await assignClass("enrol-1", null)).toBe(true);
    expect(of("schoolClass", "findFirst")).toEqual([]);
    expect(only("enrollment", "update").args).toMatchObject({
      data: { schoolClassId: null, classGroupId: null },
    });
  });

  it("clears the group along with the class", async () => {
    // A group of a class the pupil is not in would put them in two rooms at
    // once on the timetable.
    enrolled();
    await assignClass("enrol-1", null, "group-1");
    expect(only("enrollment", "update").args).toMatchObject({
      data: { classGroupId: null },
    });
  });

  it("keeps a group only when it belongs to the class being assigned", async () => {
    enrolled();
    answers["classGroup.findFirst"] = { id: "group-1" };
    await assignClass("enrol-1", "class-1", "group-1");

    expect(only("classGroup", "findFirst").args).toMatchObject({
      where: { id: "group-1", schoolClassId: "class-1" },
    });
    expect(only("enrollment", "update").args).toMatchObject({
      data: { classGroupId: "group-1" },
    });
  });

  it("drops a group belonging to another class", async () => {
    enrolled();
    await assignClass("enrol-1", "class-1", "group-from-elsewhere");
    expect(only("enrollment", "update").args).toMatchObject({
      data: { classGroupId: null },
    });
  });

  it("refuses an enrolment that does not exist", async () => {
    expect(await assignClass("nowhere", "class-1")).toBe(false);
    expect(of("enrollment", "update")).toEqual([]);
  });
});

// ── Leaving ──────────────────────────────────────────────────────────────────

describe("setEnrolmentStatus", () => {
  const dataOf = () =>
    (only("enrollment", "update").args as { data: Record<string, unknown> }).data;

  it("stamps the departure the day the pupil leaves", async () => {
    answers = {
      "enrollment.findUnique": { leftOn: null },
      "enrollment.update": { studentId: "student-1" },
    };
    const day = new Date(2026, 0, 15);
    await setEnrolmentStatus("enrol-1", "WITHDRAWN", day);

    expect(dataOf()).toMatchObject({ status: "WITHDRAWN", leftOn: day });
  });

  it("does not move a departure already recorded", async () => {
    // The bug this closes. The enrolment form calls this on every save, and it
    // rewrote `leftOn` each time — so a pupil who withdrew on 15 January had
    // their departure moved to June the first time somebody edited their notes.
    // Nothing said so, because no form shows the field.
    const actual = new Date(2026, 0, 15);
    answers = {
      "enrollment.findUnique": { leftOn: actual },
      "enrollment.update": { studentId: "student-1" },
    };
    await setEnrolmentStatus("enrol-1", "WITHDRAWN", new Date(2026, 5, 30));

    expect(dataOf()["leftOn"]).toEqual(actual);
  });

  it("does not move it for a transfer either", async () => {
    const actual = new Date(2026, 0, 15);
    answers = {
      "enrollment.findUnique": { leftOn: actual },
      "enrollment.update": { studentId: "student-1" },
    };
    await setEnrolmentStatus("enrol-1", "TRANSFERRED", new Date(2026, 5, 30));
    expect(dataOf()["leftOn"]).toEqual(actual);
  });

  it("clears the departure when the pupil comes back onto the roll", async () => {
    answers = { "enrollment.update": { studentId: "student-1" } };
    await setEnrolmentStatus("enrol-1", "ACTIVE", new Date());

    expect(dataOf()).toMatchObject({ status: "ACTIVE", leftOn: null });
  });

  it("records no departure for a pupil who finished the year", async () => {
    // COMPLETED is the end of the year, not a mid-year departure — and the fee
    // lines after it were owed.
    answers = { "enrollment.update": { studentId: "student-1" } };
    await setEnrolmentStatus("enrol-1", "COMPLETED", new Date());
    expect(dataOf()["leftOn"]).toBeNull();
  });

  it("does not read the row at all for a status that is not a departure", async () => {
    answers = { "enrollment.update": { studentId: "student-1" } };
    for (const status of ["PENDING", "ACTIVE", "COMPLETED"]) {
      calls.length = 0;
      await setEnrolmentStatus("enrol-1", status);
      expect(of("enrollment", "findUnique"), status).toEqual([]);
    }
  });

  it("covers every declared status", async () => {
    answers = {
      "enrollment.findUnique": { leftOn: null },
      "enrollment.update": { studentId: "student-1" },
    };
    for (const status of ENROLMENT_STATUSES) {
      calls.length = 0;
      await setEnrolmentStatus("enrol-1", status, new Date(2026, 0, 15));
      const left = status === "TRANSFERRED" || status === "WITHDRAWN";
      expect(dataOf()["leftOn"] === null, status).toBe(!left);
    }
  });
});

// ── The start month of an opt-in ─────────────────────────────────────────────

describe("resolveOptionStart", () => {
  const year = () => {
    answers = {
      "schoolYear.findUnique": {
        startDate: new Date(2025, 8, 1),
        endDate: new Date(2026, 5, 30),
      },
    };
  };

  it("takes a month inside the year", async () => {
    year();
    const start = await resolveOptionStart("year-1", "2026-01");
    expect(start).toEqual(new Date(2026, 0, 1));
  });

  it("normalises the first month of the year back to nothing", async () => {
    // "From the start" is what null already means, and storing a copy of the
    // year's opening month would stop tracking it if the dates are corrected.
    year();
    expect(await resolveOptionStart("year-1", "2025-09")).toBeNull();
  });

  it("refuses a month before the rentrée", async () => {
    // It would bill an opt-in for months that do not exist.
    year();
    expect(await resolveOptionStart("year-1", "2025-06")).toBeNull();
  });

  it("refuses a month after the year ends", async () => {
    // It would bill it for none at all, and read as a silently free canteen.
    year();
    expect(await resolveOptionStart("year-1", "2026-09")).toBeNull();
  });

  it("takes the last month of the year", async () => {
    year();
    expect(await resolveOptionStart("year-1", "2026-06")).toEqual(
      new Date(2026, 5, 1),
    );
  });

  it("reads a blank or malformed month as nothing", async () => {
    year();
    for (const value of [null, "", "2026", "2026-13", "nonsense"]) {
      expect(await resolveOptionStart("year-1", value), String(value)).toBeNull();
    }
  });

  it("answers nothing for a year that does not exist", async () => {
    expect(await resolveOptionStart("nowhere", "2026-01")).toBeNull();
  });
});

// ── Money already taken pins the line ────────────────────────────────────────

describe("repriceFeeLine", () => {
  const paid = (centimes: number) => {
    answers = {
      "paymentAllocation.aggregate": { _sum: { amountCentimes: centimes } },
    };
  };

  const edit = (extra: Record<string, unknown> = {}) => ({
    baseAmountCentimes: 100_000,
    discountBps: 0,
    discountCentimes: 0,
    discountId: null,
    status: "DUE",
    notes: null,
    ...extra,
  });

  it("writes the net from the parts, so a total cannot disagree with its cell", async () => {
    paid(0);
    expect(await repriceFeeLine("line-1", edit({ discountBps: 1000 }))).toEqual({
      ok: true,
    });
    expect(only("enrollmentFee", "update").args).toMatchObject({
      data: { baseAmountCentimes: 100_000, discountBps: 1000, amountCentimes: 90_000 },
    });
  });

  it("refuses to waive a charge the family has paid", async () => {
    // Every "how much has this pupil paid" sum reads through lines that are
    // still DUE, so a waived one takes its receipts out of the pupil's total
    // while the caisse goes on counting every centime. The two sets of books
    // then disagree by exactly the amount somebody actually handed over.
    paid(50_000);
    const result = await repriceFeeLine("line-1", edit({ status: "WAIVED" }));

    expect(result).toEqual({
      ok: false,
      reason: "ALREADY_PAID",
      paidCentimes: 50_000,
    });
    expect(of("enrollmentFee", "update")).toEqual([]);
  });

  it("refuses to cancel one either", async () => {
    paid(50_000);
    expect(
      await repriceFeeLine("line-1", edit({ status: "CANCELLED" })),
    ).toMatchObject({ ok: false, reason: "ALREADY_PAID" });
  });

  it("refuses to discount a line below what has been paid on it", async () => {
    paid(80_000);
    expect(
      await repriceFeeLine("line-1", edit({ discountCentimes: 50_000 })),
    ).toMatchObject({ ok: false, reason: "ALREADY_PAID" });
    expect(of("enrollmentFee", "update")).toEqual([]);
  });

  it("allows a reduction down to exactly what has been paid", async () => {
    paid(80_000);
    expect(
      await repriceFeeLine("line-1", edit({ discountCentimes: 20_000 })),
    ).toEqual({ ok: true });
  });

  it("allows raising a line that has been part-paid", async () => {
    // A family owing more than they have handed over is the ordinary state of
    // every schedule in September.
    paid(30_000);
    expect(
      await repriceFeeLine("line-1", edit({ baseAmountCentimes: 200_000 })),
    ).toEqual({ ok: true });
  });

  it("waives a line nobody has paid against", async () => {
    paid(0);
    expect(
      await repriceFeeLine("line-1", edit({ status: "WAIVED" })),
    ).toEqual({ ok: true });
  });

  it("reads what has been paid inside the transaction that reprices", async () => {
    // The guard and the write used to be two statements on their own
    // connections. A receipt committing in the gap walked straight through a
    // check that had already read zero, and the line was waived under money the
    // caisse was still counting — the disagreement the refusal above exists to
    // prevent, reached by timing instead of by permission.
    paid(0);
    await repriceFeeLine("line-1", edit({ status: "WAIVED" }));

    expect(only("paymentAllocation", "aggregate").tx).toBe(true);
    expect(only("enrollmentFee", "update").tx).toBe(true);
  });

  it("counts only posted receipts", async () => {
    // A cancelled receipt put its money back, so it must not pin a line it no
    // longer pays for.
    paid(0);
    await repriceFeeLine("line-1", edit());
    expect(only("paymentAllocation", "aggregate").args).toMatchObject({
      where: { enrollmentFeeId: "line-1", payment: { status: "POSTED" } },
    });
  });

  // ── The annulations trail ──────────────────────────────────────────────────

  it("stamps who cancelled a line and why", async () => {
    // A charge that vanishes from a family's schedule with no trace is the one
    // thing a bursar can never answer for at the end of the year.
    paid(0);
    await repriceFeeLine(
      "line-1",
      edit({
        status: "WAIVED",
        cancelReason: "Fratrie — accord direction.",
        actorId: "user-1",
      }),
    );

    const data = (only("enrollmentFee", "update").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["cancelReason"]).toBe("Fratrie — accord direction.");
    expect(data["cancelledById"]).toBe("user-1");
    expect(data["cancelledAt"]).toBeInstanceOf(Date);
  });

  it("wipes the trail when a line is owed again", async () => {
    // A half-cleared row is what makes the annulations journal lie.
    paid(0);
    await repriceFeeLine("line-1", edit({ status: "DUE", actorId: "user-1" }));

    const data = (only("enrollmentFee", "update").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data["cancelledAt"]).toBeNull();
    expect(data["cancelReason"]).toBeNull();
    expect(data["cancelledById"]).toBeNull();
  });

  it("never writes the reason or the actor as columns of their own", async () => {
    // They are stamped through the trail above; passing them straight into the
    // update would write two fields the row does not have.
    paid(0);
    await repriceFeeLine("line-1", edit({ actorId: "user-1", cancelReason: "x" }));

    const data = (only("enrollmentFee", "update").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data).not.toHaveProperty("actorId");
  });
});

describe("repriceFollowingLines", () => {
  const line = (id: string, base: number, paidCentimes = 0) => ({
    id,
    baseAmountCentimes: base,
    allocations: paidCentimes > 0 ? [{ amountCentimes: paidCentimes }] : [],
  });

  const carrying = (following: ReturnType<typeof line>[]) => {
    answers = {
      "enrollmentFee.findUnique": {
        enrollmentId: "enrol-1",
        feeTypeId: "fee-scolarite",
        periodIndex: 4,
      },
      "enrollmentFee.findMany": following,
    };
  };

  it("carries a reduction to every later month of the same charge", async () => {
    carrying([line("l5", 100_000), line("l6", 100_000)]);
    expect(
      await repriceFollowingLines("line-4", {
        discountBps: 1000,
        discountCentimes: 0,
        discountId: "disc-1",
      }),
    ).toBe(2);

    for (const call of of("enrollmentFee", "update")) {
      expect(call.args).toMatchObject({
        data: { discountBps: 1000, discountId: "disc-1", amountCentimes: 90_000 },
      });
    }
  });

  it("asks only for the later instalments of the same charge, still owed", async () => {
    carrying([]);
    await repriceFollowingLines("line-4", {
      discountBps: 1000,
      discountCentimes: 0,
      discountId: null,
    });

    expect(only("enrollmentFee", "findMany").args).toMatchObject({
      where: {
        enrollmentId: "enrol-1",
        feeTypeId: "fee-scolarite",
        periodIndex: { gt: 4 },
        status: "DUE",
      },
    });
  });

  it("computes each month's net from its own base", async () => {
    // Instalments differ by a centime where the year does not divide evenly, so
    // copying one month's total over the others would change what is owed.
    carrying([line("l5", 100_001), line("l6", 100_000)]);
    await repriceFollowingLines("line-4", {
      discountBps: 1000,
      discountCentimes: 0,
      discountId: null,
    });

    const amounts = of("enrollmentFee", "update").map(
      (call) => (call.args as { data: { amountCentimes: number } }).data.amountCentimes,
    );
    expect(amounts).toEqual([90_001, 90_000]);
  });

  it("skips a month it would push below what has been paid on it", async () => {
    // Applied quietly rather than as a refusal: half the point of the tick is
    // that the bursar does not have to think about which months are settled.
    carrying([line("l5", 100_000, 95_000), line("l6", 100_000)]);
    const moved = await repriceFollowingLines("line-4", {
      discountBps: 1000,
      discountCentimes: 0,
      discountId: null,
    });

    expect(moved).toBe(1);
    expect(of("enrollmentFee", "update")).toHaveLength(1);
    expect(only("enrollmentFee", "update").args).toMatchObject({
      where: { id: "l6" },
    });
  });

  it("still moves a month whose reduction lands exactly on what was paid", async () => {
    carrying([line("l5", 100_000, 90_000)]);
    expect(
      await repriceFollowingLines("line-4", {
        discountBps: 1000,
        discountCentimes: 0,
        discountId: null,
      }),
    ).toBe(1);
  });

  it("reads the later months inside the transaction that reprices them", async () => {
    // Worse here than in `repriceFeeLine`, because this path skips a line it
    // would underprice rather than refusing: a receipt landing between the read
    // and the write raises nothing at all, it just quietly reprices a month
    // below what the family handed over — across a whole year of lines at one
    // tick of the box.
    carrying([line("l5", 100_000), line("l6", 100_000)]);
    await repriceFollowingLines("line-4", {
      discountBps: 1000,
      discountCentimes: 0,
      discountId: null,
    });

    expect(only("enrollmentFee", "findUnique").tx).toBe(true);
    expect(only("enrollmentFee", "findMany").tx).toBe(true);
    for (const call of of("enrollmentFee", "update")) {
      expect(call.tx).toBe(true);
    }
  });

  it("carries only the reduction, never the base amount", async () => {
    carrying([line("l5", 123_456)]);
    await repriceFollowingLines("line-4", {
      discountBps: 0,
      discountCentimes: 1_000,
      discountId: null,
    });

    const data = (only("enrollmentFee", "update").args as {
      data: Record<string, unknown>;
    }).data;
    expect(data).not.toHaveProperty("baseAmountCentimes");
    expect(data["amountCentimes"]).toBe(122_456);
  });

  it("does nothing for a line that does not exist", async () => {
    expect(
      await repriceFollowingLines("nowhere", {
        discountBps: 1000,
        discountCentimes: 0,
        discountId: null,
      }),
    ).toBe(0);
    expect(of("enrollmentFee", "findMany")).toEqual([]);
  });

  it("does nothing when there is no later month", async () => {
    carrying([]);
    expect(
      await repriceFollowingLines("line-9", {
        discountBps: 1000,
        discountCentimes: 0,
        discountId: null,
      }),
    ).toBe(0);
  });
});

// ── Who may subscribe to what ────────────────────────────────────────────────

describe("replaceOptions", () => {
  /** A school selling the bus and one club, and nothing else. */
  const sellingBusAndClub = () => {
    answers = {
      "enrollment.findUnique": {
        schoolYearId: "year-1",
        schoolYear: { schoolId: "school-1" },
      },
      "feeType.findMany": [
        { id: "fee-transport", code: "TRANSPORT", name: "Bus", nameAr: null, kind: "TRANSPORT" },
        { id: "fee-club", code: "CLUB-FOOT", name: "Club", nameAr: null, kind: "CLUB" },
      ],
      "schoolYear.findUnique": {
        startDate: new Date(2025, 8, 1),
        endDate: new Date(2026, 5, 30),
      },
    };
  };

  it("only ever offers the school's own optional charges", async () => {
    sellingBusAndClub();
    await replaceOptions("enrol-1", []);

    // Scolarité is not on offer, and neither is another school's club.
    const [lookup] = of("feeType", "findMany");
    expect(lookup.args).toMatchObject({
      where: { schoolId: "school-1", isActive: true, isMandatory: false },
    });
  });

  it("refuses a charge this school does not sell", async () => {
    // The id comes from a form. A crafted POST must not be able to subscribe a
    // pupil to scolarité — or to a club belonging to another school.
    sellingBusAndClub();

    const kept = await replaceOptions("enrol-1", [
      { feeTypeId: "fee-club", startsOn: null },
      { feeTypeId: "fee-scolarite-from-elsewhere", startsOn: null },
    ]);

    expect(kept).toEqual(["fee-club"]);
    expect(of("enrollmentOption", "upsert")).toHaveLength(1);
  });

  it("removes the charges the family did not tick", async () => {
    sellingBusAndClub();
    await replaceOptions("enrol-1", [
      { feeTypeId: "fee-club", startsOn: null },
    ]);

    // Whatever is not kept goes, which is what makes an un-ticked box mean
    // something without the caller diffing anything.
    const [removal] = of("enrollmentOption", "deleteMany");
    expect(removal.args).toMatchObject({
      where: { enrollmentId: "enrol-1", feeTypeId: { notIn: ["fee-club"] } },
    });
  });

  it("drops a start month outside the school year", async () => {
    // August is before the rentrée: billing an opt-in from it would raise
    // instalments for months the year does not have. `resolveOptionStart`
    // answers null, which already means "from the start of the year".
    sellingBusAndClub();
    await replaceOptions("enrol-1", [
      { feeTypeId: "fee-club", startsOn: "2025-08" },
    ]);

    const [written] = of("enrollmentOption", "upsert");
    expect(written.args).toMatchObject({ create: { startsOn: null } });
  });

  it("subscribes nobody when the enrolment cannot be found", async () => {
    answers = { "enrollment.findUnique": null };

    expect(await replaceOptions("nonsense", [
      { feeTypeId: "fee-club", startsOn: null },
    ])).toEqual([]);
    expect(of("enrollmentOption", "upsert")).toHaveLength(0);
    expect(of("enrollmentOption", "deleteMany")).toHaveLength(0);
  });
});

// ── Taking a charge back off the schedule ────────────────────────────────────

describe("resyncOptionalCharges", () => {
  /** A pupil who has just been un-ticked from the bus, and prices nothing. */
  const withdrawnFromTransport = (
    existing: Record<string, unknown>[],
  ): void => {
    answers = {
      "enrollment.findUnique": {
        options: [],
        levelOffering: { levelId: "level-1" },
        schoolYear: {
          id: "year-1",
          startDate: new Date(2025, 8, 1),
          endDate: new Date(2026, 5, 30),
          schoolId: "school-1",
          _count: { terms: 3 },
        },
      },
      "enrollmentFee.findMany": existing,
    };
  };

  const busLine = (postedAllocations: number) => ({
    id: "bus-1",
    feeTypeId: "fee-transport",
    periodIndex: 1,
    feeType: { kind: "TRANSPORT" },
    _count: { allocations: postedAllocations },
  });

  it("counts only posted receipts as money holding a line down", async () => {
    // A cancelled receipt has already put its money back, so it holds nothing.
    // Counting every allocation regardless of its receipt meant a struck-out
    // one pinned the charge for ever: the family withdrew from the bus, and the
    // line could never come off the schedule again — so they went on being
    // billed for a service nobody was providing. `canChangeLevel` has always
    // read it this way; this is the sibling that did not.
    withdrawnFromTransport([busLine(0)]);
    await resyncOptionalCharges("enrol-1");

    expect(only("enrollmentFee", "findMany").args).toMatchObject({
      select: {
        _count: {
          select: { allocations: { where: { payment: { status: "POSTED" } } } },
        },
      },
    });
  });

  it("takes a withdrawn charge off the schedule when nothing posted paid it", async () => {
    withdrawnFromTransport([busLine(0)]);
    expect(await resyncOptionalCharges("enrol-1")).toEqual({
      added: 0,
      removed: 1,
    });
    expect(only("enrollmentFee", "deleteMany").args).toMatchObject({
      where: { id: { in: ["bus-1"] } },
    });
  });

  it("leaves a withdrawn charge alone while a posted receipt still pays it", async () => {
    // Deleting it would leave that receipt's allocation pointing at nothing.
    // The bursar waives or refunds it deliberately instead.
    withdrawnFromTransport([busLine(1)]);
    expect(await resyncOptionalCharges("enrol-1")).toEqual({
      added: 0,
      removed: 0,
    });
    expect(of("enrollmentFee", "deleteMany")).toEqual([]);
  });
});

// ── The schedule the service actually builds ─────────────────────────────────

describe("buildFeeSchedule", () => {
  it("prices against the level the pupil is admitted to", async () => {
    answers = {
      "enrollment.findUnique": {
        options: [],
        levelOffering: { levelId: "level-1" },
        schoolYear: {
          id: "year-1",
          startDate: new Date(2025, 8, 1),
          endDate: new Date(2026, 5, 30),
          schoolId: "school-1",
          _count: { terms: 3 },
        },
      },
      "feeType.findMany": [scolarite],
      "feeRate.findMany": [rate({ scopeKey: "level-1", amountCentimes: 1_800_000 })],
    };

    const lines = await buildFeeSchedule("enrol-1");
    expect(lines.reduce((sum, line) => sum + line.amountCentimes, 0)).toBe(
      1_800_000,
    );
  });

  it("reads the price list of the year's own school", async () => {
    answers = {
      "enrollment.findUnique": {
        options: [],
        levelOffering: { levelId: "level-1" },
        schoolYear: {
          id: "year-1",
          startDate: new Date(2025, 8, 1),
          endDate: new Date(2026, 5, 30),
          schoolId: "school-1",
          _count: { terms: 3 },
        },
      },
    };
    await buildFeeSchedule("enrol-1");

    // Not whichever school is selected in the header — the schedule belongs to
    // the year it is for.
    expect(only("feeType", "findMany").args).toMatchObject({
      where: { schoolId: "school-1", isActive: true },
    });
    expect(only("feeRate", "findMany").args).toMatchObject({
      where: { schoolYearId: "year-1", isActive: true },
    });
  });

  it("answers nothing for an enrolment that does not exist", async () => {
    expect(await buildFeeSchedule("nowhere")).toEqual([]);
    expect(of("feeType", "findMany")).toEqual([]);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("feeLineSchema", () => {
  const t = getDictionaryFor("en");
  const cell = (extra: Record<string, unknown> = {}) => ({
    baseAmount: "1000",
    discountPercent: "0",
    discountAmount: "0",
    discountId: "",
    status: "DUE",
    cancelReason: "",
    notes: "",
    ...extra,
  });

  it("turns the dirhams a bursar types into centimes", () => {
    const parsed = feeLineSchema(t).safeParse(cell({ baseAmount: "1234.56" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.baseAmountCentimes).toBe(123_456);
  });

  it("turns whole percent into basis points", () => {
    const parsed = feeLineSchema(t).safeParse(cell({ discountPercent: "12.5" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.discountBps).toBe(1250);
  });

  it("refuses a flat reduction larger than the charge", () => {
    // `netAmount` would floor it at zero and the bursar would never know they
    // had typed the wrong figure.
    expect(
      feeLineSchema(t).safeParse(cell({ baseAmount: "100", discountAmount: "500" }))
        .success,
    ).toBe(false);
  });

  it("accepts one exactly equal to the charge", () => {
    expect(
      feeLineSchema(t).safeParse(cell({ baseAmount: "100", discountAmount: "100" }))
        .success,
    ).toBe(true);
  });

  it("requires a reason for anything that stops being owed", () => {
    // Waiving a charge without saying why is the thing the annulations journal
    // exists to prevent.
    for (const status of ["WAIVED", "CANCELLED"]) {
      expect(
        feeLineSchema(t).safeParse(cell({ status })).success,
        status,
      ).toBe(false);
      expect(
        feeLineSchema(t).safeParse(cell({ status, cancelReason: "Fratrie." }))
          .success,
        status,
      ).toBe(true);
    }
  });

  it("needs no reason for a line that stays owed", () => {
    expect(feeLineSchema(t).safeParse(cell()).success).toBe(true);
  });

  it("refuses a negative amount or a negative reduction", () => {
    expect(feeLineSchema(t).safeParse(cell({ baseAmount: "-100" })).success).toBe(
      false,
    );
    expect(
      feeLineSchema(t).safeParse(cell({ discountAmount: "-10" })).success,
    ).toBe(false);
    expect(
      feeLineSchema(t).safeParse(cell({ discountPercent: "-5" })).success,
    ).toBe(false);
  });

  it("refuses a reduction over a hundred percent", () => {
    expect(
      feeLineSchema(t).safeParse(cell({ discountPercent: "101" })).success,
    ).toBe(false);
  });

  it("refuses a status nothing recognises", () => {
    for (const status of ["", "PAID", "due", "__proto__"]) {
      expect(feeLineSchema(t).safeParse(cell({ status })).success, status).toBe(
        false,
      );
    }
  });

  it("strips anything the form did not declare", () => {
    const parsed = feeLineSchema(t).safeParse({
      ...cell(),
      // The net is computed, never submitted, and the trail is stamped by the
      // service.
      amountCentimes: 1,
      enrollmentId: "another-pupil",
      cancelledById: "somebody-else",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("amountCentimes");
      expect(parsed.data).not.toHaveProperty("enrollmentId");
      expect(parsed.data).not.toHaveProperty("cancelledById");
    }
  });
});

describe("enrolmentSchema", () => {
  const t = getDictionaryFor("en");
  const form = (extra: Record<string, unknown> = {}) => ({
    studentId: "student-1",
    levelOfferingId: "offering-1",
    schoolClassId: "",
    classGroupId: "",
    status: "ACTIVE",
    enrolledOn: "2025-09-01",
    isRepeating: false,
    usesTransport: false,
    usesCanteen: false,
    transportStartsOn: "",
    canteenStartsOn: "",
    notes: "",
    ...extra,
  });

  it("accepts a well-formed inscription", () => {
    expect(enrolmentSchema(t).safeParse(form()).success).toBe(true);
  });

  it("requires the pupil and the level", () => {
    expect(enrolmentSchema(t).safeParse(form({ studentId: "" })).success).toBe(
      false,
    );
    expect(
      enrolmentSchema(t).safeParse(form({ levelOfferingId: "" })).success,
    ).toBe(false);
  });

  it("accepts every declared status and refuses the rest", () => {
    for (const status of ENROLMENT_STATUSES) {
      expect(enrolmentSchema(t).safeParse(form({ status })).success, status).toBe(
        true,
      );
    }
    for (const status of ["", "active", "ENROLLED"]) {
      expect(enrolmentSchema(t).safeParse(form({ status })).success, status).toBe(
        false,
      );
    }
  });

  it("leaves the class optional, because a place is granted before it is seated", () => {
    // A school admits a child to 4AP in June and decides in September which of
    // 4AP-A and 4AP-B they sit in.
    expect(enrolmentSchema(t).safeParse(form({ schoolClassId: "" })).success).toBe(
      true,
    );
  });

  it("strips anything the form did not declare", () => {
    const parsed = enrolmentSchema(t).safeParse({
      ...form(),
      // The year and the departure date are the server's; neither is a field.
      schoolYearId: "another-year",
      leftOn: "2026-06-30",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("schoolYearId");
      expect(parsed.data).not.toHaveProperty("leftOn");
    }
  });
});
