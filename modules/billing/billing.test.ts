import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BILLING_CYCLES,
  BPS_FULL,
  BPS_PER_PERCENT,
  DISCOUNT_KINDS,
  DISCOUNT_REASONS,
  FEE_KINDS,
  applyPercentBps,
  feeRateScopeKey,
  splitIntoInstalments,
} from "@/modules/billing/enums";
import { isSubscribable } from "@/modules/enrolment/schedule";

/**
 * La liste des prix: what a school charges, before anybody is charged it.
 *
 * The module owns almost no behaviour on purpose — what a family owes is
 * decided on the échéancier, and a FeeRate is a number a bursar types. Two
 * things here are rules rather than forms, and both are about money that gets
 * summed and disputed:
 *
 *   * **nothing is a float.** Every amount is an integer of centimes and every
 *     percentage an integer of basis points, and the two conversions that
 *     matter — a reduction and a split into instalments — round once, in one
 *     place, so an invoice line and its total can never round differently.
 *   * **carrying a price list into a new year does not uprate it.** A school
 *     raises its fees by a figure decided in a meeting, not by a rule this code
 *     could guess, and a silent increase is the one mistake nobody would catch
 *     until a parent queried a receipt.
 */

// ─────────────────────────────────────────────────────────────────────────────

const calls: { model: string; op: string; args: unknown }[] = [];
let answers: Record<string, unknown> = {};
/** Row counts the delta is measured against, read in order. */
let counts: number[] = [];

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: unknown) => {
            calls.push({ model, op, args });
            if (op === "count") return counts.shift() ?? 0;
            const key = `${model}.${op}`;
            if (key in answers) return answers[key];
            return op === "findMany" ? [] : {};
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const { copyFeeConfiguration } = await import("@/modules/billing/service");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

beforeEach(() => {
  calls.length = 0;
  answers = {};
  counts = [];
});

// ── The catalogues ───────────────────────────────────────────────────────────

describe("what a charge can be", () => {
  it("names every kind a school actually raises", () => {
    expect([...FEE_KINDS]).toEqual([
      "TUITION",
      "REGISTRATION",
      "INSURANCE",
      "TRANSPORT",
      "CANTEEN",
      "CLUB",
      "SUPPLIES",
      "UNIFORM",
      "EXAM",
      "OTHER",
    ]);
  });

  it("keeps OTHER last, for anything the school invents", () => {
    expect(FEE_KINDS.at(-1)).toBe("OTHER");
  });

  it("lets the catalogue decide what is optional, not the kind", () => {
    /*
      This used to assert that `FLAG_GATED_FEE_KINDS` was exactly
      ["TRANSPORT", "CANTEEN"] — the two kinds the échéancier would gate on a
      switch, and the only two `resyncOptionalCharges` would ever withdraw.

      That pairing was the bug, not the contract. It meant the *catalogue* was
      configurable and the *opt-ins* were not: a school could declare "Club de
      football" as an optional charge and then find no way at all to sell it,
      because nothing outside those two names could be subscribed to. See
      EnrollmentOption.

      What replaces it is one flag on the charge itself, which is what
      `isMandatory` already meant.
    */
    expect(isSubscribable({ isMandatory: false })).toBe(true);
    expect(isSubscribable({ isMandatory: true })).toBe(false);
  });

  it("sells a club on the same terms as the bus", () => {
    // The case the old design could not express. A club and the bus are both
    // just optional charges now, and neither is named anywhere in the billing
    // logic — the kind is for grouping a report, not for deciding a charge.
    expect(FEE_KINDS).toContain("CLUB");
    for (const kind of ["CLUB", "TRANSPORT", "CANTEEN", "UNIFORM"]) {
      expect(FEE_KINDS, kind).toContain(kind);
      expect(isSubscribable({ isMandatory: false }), kind).toBe(true);
    }
  });

  it("separates what is quoted from how it is collected", () => {
    // Moroccan schools quote scolarité as one annual figure and collect it
    // monthly, so the two are different facts.
    expect([...BILLING_CYCLES]).toEqual([
      "ANNUAL",
      "MONTHLY",
      "TERM",
      "ONE_OFF",
    ]);
  });

  it("expresses a reduction one of exactly two ways", () => {
    expect([...DISCOUNT_KINDS]).toEqual(["PERCENTAGE", "FIXED_AMOUNT"]);
  });

  it("records why a reduction exists, because an accountant asks", () => {
    // Reporting on what the school gives away, broken down by reason.
    expect(DISCOUNT_REASONS).toContain("SIBLING");
    expect(DISCOUNT_REASONS).toContain("HARDSHIP");
    expect(DISCOUNT_REASONS.at(-1)).toBe("OTHER");
  });

  it("gives every catalogue distinct values", () => {
    for (const [name, values] of [
      ["fee kinds", FEE_KINDS],
      ["billing cycles", BILLING_CYCLES],
      ["discount kinds", DISCOUNT_KINDS],
      ["discount reasons", DISCOUNT_REASONS],
    ] as const) {
      expect(new Set(values).size, name).toBe(values.length);
    }
  });
});

// ── Basis points ─────────────────────────────────────────────────────────────

describe("applyPercentBps", () => {
  it("takes a percentage off an amount in centimes", () => {
    expect(applyPercentBps(100_000, 1000)).toBe(90_000);
    expect(applyPercentBps(100_000, 2500)).toBe(75_000);
  });

  it("takes nothing off for no reduction", () => {
    expect(applyPercentBps(123_457, 0)).toBe(123_457);
  });

  it("takes everything off for a whole one", () => {
    expect(applyPercentBps(123_457, BPS_FULL)).toBe(0);
  });

  it("rounds once, at the end, to a whole centime", () => {
    // The only place this maths happens, so an invoice line and its total can
    // never round differently.
    const net = applyPercentBps(10_000, 3333);
    expect(Number.isInteger(net)).toBe(true);
    expect(net).toBe(6_667);
  });

  it("counts a hundred basis points as one percent", () => {
    expect(BPS_PER_PERCENT).toBe(100);
    expect(BPS_FULL).toBe(100 * BPS_PER_PERCENT);
    expect(applyPercentBps(100_000, BPS_PER_PERCENT)).toBe(99_000);
  });

  it("expresses an eighth off exactly, which a float would not", () => {
    // 12.5% is 1250 bps — the hint on the form says as much.
    expect(applyPercentBps(80_000, 1250)).toBe(70_000);
  });

  it("never loses more than half a centime to rounding", () => {
    for (const amount of [1, 99, 12_345, 999_999]) {
      for (const bps of [1, 333, 1250, 5000, 9999]) {
        const exact = (amount * (BPS_FULL - bps)) / BPS_FULL;
        expect(
          Math.abs(applyPercentBps(amount, bps) - exact),
          `${amount}@${bps}`,
        ).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("leaves nothing to take off an amount of nothing", () => {
    expect(applyPercentBps(0, 5000)).toBe(0);
  });
});

describe("splitIntoInstalments", () => {
  it("sums exactly back, whatever the division", () => {
    for (const [amount, count] of [
      [1_000_000, 9],
      [100, 3],
      [1, 12],
      [999_999, 7],
    ] as const) {
      const parts = splitIntoInstalments(amount, count);
      expect(parts.reduce((sum, part) => sum + part, 0), `${amount}/${count}`)
        .toBe(amount);
    }
  });

  it("returns whole centimes only", () => {
    for (const part of splitIntoInstalments(999_999, 7)) {
      expect(Number.isInteger(part)).toBe(true);
    }
  });

  it("puts the odd centime early rather than in a larger last month", () => {
    expect(splitIntoInstalments(100, 3)).toEqual([34, 33, 33]);
  });

  it("never spreads more than a centime between two months", () => {
    for (const count of [2, 3, 7, 9, 10, 12]) {
      const parts = splitIntoInstalments(1_234_567, count);
      expect(Math.max(...parts) - Math.min(...parts), String(count))
        .toBeLessThanOrEqual(1);
    }
  });

  it("gives an amount smaller than the count a centime each and no more", () => {
    // Five centimes over nine instalments: five months of one, four of nothing.
    expect(splitIntoInstalments(5, 9)).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0]);
  });

  it("answers nothing for no instalments", () => {
    expect(splitIntoInstalments(1000, 0)).toEqual([]);
    expect(splitIntoInstalments(1000, -3)).toEqual([]);
  });
});

describe("feeRateScopeKey", () => {
  it("keeps a level's own price apart from the every-level one", () => {
    // What stops one fee having two "all levels" prices in the same year, since
    // SQLite treats NULLs as distinct in a unique index.
    expect(feeRateScopeKey(null)).not.toBe(feeRateScopeKey("level-1"));
    expect(feeRateScopeKey(null)).toBe(feeRateScopeKey(undefined));
  });

  it("gives each level its own key", () => {
    expect(feeRateScopeKey("level-1")).not.toBe(feeRateScopeKey("level-2"));
  });

  it("is stable for the same level", () => {
    expect(feeRateScopeKey("level-1")).toBe(feeRateScopeKey("level-1"));
  });
});

// ── Carrying a price list into a new year ────────────────────────────────────

const rate = (extra: Record<string, unknown> = {}) => ({
  id: "rate-1",
  schoolYearId: "year-1",
  feeTypeId: "fee-scolarite",
  levelId: null,
  amountCentimes: 900_000,
  instalmentCount: 9,
  perInstalment: false,
  isActive: true,
  notes: null,
  scopeKey: "",
  ...extra,
});

const discount = (extra: Record<string, unknown> = {}) => ({
  id: "disc-1",
  schoolYearId: "year-1",
  code: "FRATRIE",
  name: "Réduction fratrie",
  nameAr: null,
  kind: "PERCENTAGE",
  percentBps: 1000,
  amountCentimes: 0,
  reason: "SIBLING",
  feeTypeId: "fee-scolarite",
  isStackable: false,
  isActive: true,
  notes: null,
  ...extra,
});

describe("copyFeeConfiguration", () => {
  const listing = (rates: unknown[] = [], discounts: unknown[] = []) => {
    answers = {
      "feeRate.findMany": rates,
      "discount.findMany": discounts,
    };
  };

  it("reads the source year's list and writes onto the target", async () => {
    listing([rate()], []);
    counts = [0, 1, 0, 0];
    await copyFeeConfiguration("year-1", "year-2");

    expect(of("feeRate", "findMany")[0]!.args).toMatchObject({
      where: { schoolYearId: "year-1" },
    });
    const upsert = of("feeRate", "upsert")[0]!.args as {
      where: { schoolYearId_feeTypeId_scopeKey: { schoolYearId: string } };
      create: Record<string, unknown>;
    };
    expect(upsert.where.schoolYearId_feeTypeId_scopeKey.schoolYearId).toBe(
      "year-2",
    );
    expect(upsert.create["schoolYearId"]).toBe("year-2");
  });

  it("carries last year's amount across without uprating it", async () => {
    // A school raises its fees by a figure decided in a meeting, and a silent
    // increase is the one mistake nobody would catch until a parent queried a
    // receipt.
    listing([rate({ amountCentimes: 900_000 })], []);
    counts = [0, 1, 0, 0];
    await copyFeeConfiguration("year-1", "year-2");

    const create = (of("feeRate", "upsert")[0]!.args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["amountCentimes"]).toBe(900_000);
    expect(create["instalmentCount"]).toBe(9);
    expect(create["perInstalment"]).toBe(false);
  });

  it("never overwrites a rate the target year already has", async () => {
    // Running the copy twice, or onto a year somebody has already started
    // editing, must leave what they typed exactly as it is.
    listing([rate()], []);
    counts = [1, 1, 0, 0];
    const result = await copyFeeConfiguration("year-1", "year-2");

    expect(
      (of("feeRate", "upsert")[0]!.args as { update: unknown }).update,
    ).toEqual({});
    expect(result.rates).toBe(0);
  });

  it("counts what it actually added, not what it tried to", async () => {
    // `update: {}` leaves `updatedAt` untouched, so a row that already existed
    // is indistinguishable from a fresh one by its timestamps — the before and
    // after delta is the only honest answer, and it is shown to whoever pressed
    // the button.
    listing([rate(), rate({ feeTypeId: "fee-transport" })], []);
    counts = [1, 3, 0, 0];
    const result = await copyFeeConfiguration("year-1", "year-2");

    expect(result.rates).toBe(2);
  });

  it("carries the scope key rather than recomputing it", async () => {
    // It mirrors `levelId`, which is copied unchanged — and both years point at
    // the same Level rows, since a level belongs to the school and not to a
    // year.
    listing([rate({ levelId: "level-1", scopeKey: "level-1" })], []);
    counts = [0, 1, 0, 0];
    await copyFeeConfiguration("year-1", "year-2");

    const create = (of("feeRate", "upsert")[0]!.args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["scopeKey"]).toBe("level-1");
    expect(create["levelId"]).toBe("level-1");
  });

  it("keys a rate on the year, the charge and the level together", async () => {
    listing([rate({ scopeKey: "level-1" })], []);
    counts = [0, 1, 0, 0];
    await copyFeeConfiguration("year-1", "year-2");

    expect(of("feeRate", "upsert")[0]!.args).toMatchObject({
      where: {
        schoolYearId_feeTypeId_scopeKey: {
          schoolYearId: "year-2",
          feeTypeId: "fee-scolarite",
          scopeKey: "level-1",
        },
      },
    });
  });

  it("copies a reduction whole, reason included", async () => {
    listing([], [discount()]);
    counts = [0, 0, 0, 1];
    const result = await copyFeeConfiguration("year-1", "year-2");

    const create = (of("discount", "upsert")[0]!.args as {
      create: Record<string, unknown>;
    }).create;
    expect(create).toMatchObject({
      schoolYearId: "year-2",
      code: "FRATRIE",
      kind: "PERCENTAGE",
      percentBps: 1000,
      reason: "SIBLING",
      isStackable: false,
    });
    expect(result.discounts).toBe(1);
  });

  it("keeps a reduction pointed at the charge it applies to", async () => {
    // A FeeType belongs to the school and not to a year, so the link survives
    // the crossing.
    listing([], [discount({ feeTypeId: "fee-scolarite" })]);
    counts = [0, 0, 0, 1];
    await copyFeeConfiguration("year-1", "year-2");

    const create = (of("discount", "upsert")[0]!.args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["feeTypeId"]).toBe("fee-scolarite");
  });

  it("keys a reduction on its code within the year", async () => {
    listing([], [discount()]);
    counts = [0, 0, 0, 1];
    await copyFeeConfiguration("year-1", "year-2");

    expect(of("discount", "upsert")[0]!.args).toMatchObject({
      where: { schoolYearId_code: { schoolYearId: "year-2", code: "FRATRIE" } },
    });
  });

  it("carries a withdrawn rate across as withdrawn", async () => {
    // A price the school stopped offering is not one the new year should start
    // offering again.
    listing([rate({ isActive: false })], []);
    counts = [0, 1, 0, 0];
    await copyFeeConfiguration("year-1", "year-2");

    const create = (of("feeRate", "upsert")[0]!.args as {
      create: Record<string, unknown>;
    }).create;
    expect(create["isActive"]).toBe(false);
  });

  it("writes nothing for a year with no price list", async () => {
    listing([], []);
    counts = [0, 0, 0, 0];
    const result = await copyFeeConfiguration("year-1", "year-2");

    expect(result).toEqual({ rates: 0, discounts: 0 });
    expect(of("feeRate", "upsert")).toEqual([]);
    expect(of("discount", "upsert")).toEqual([]);
  });

  it("never carries the source year's own id onto a row", async () => {
    // The one field that must not survive the copy, or the new year's rates
    // would belong to the old one.
    listing([rate()], [discount()]);
    counts = [0, 1, 0, 1];
    await copyFeeConfiguration("year-1", "year-2");

    for (const op of [
      of("feeRate", "upsert")[0]!,
      of("discount", "upsert")[0]!,
    ]) {
      const create = (op.args as { create: Record<string, unknown> }).create;
      expect(create["schoolYearId"]).toBe("year-2");
      expect(create).not.toHaveProperty("id");
    }
  });
});
