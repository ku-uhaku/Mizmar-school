import { describe, expect, it, beforeEach, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { balanceTenders } from "@/modules/treasury/payment-state";
import { paymentSchema, transferSchema } from "@/modules/treasury/validation";

/**
 * Recording a receipt, and moving cash between tills.
 *
 * Both are guarded in two layers, and the layers are not redundant: the schema
 * refuses what a form can express, and `recordPayment` refuses what a crafted
 * POST can. The tests below run against both, because the interesting failures
 * are the ones that get past the first.
 */

const t = getDictionaryFor("en");

/**
 * A tender as the form actually submits one. Every optional column is a
 * *nullable* string rather than an absent key — `optionalText` accepts "" and
 * turns it into null, so an omitted field is a malformed submission and not a
 * blank one.
 */
function tender(
  method: string,
  amount: string,
  extra: Record<string, string> = {},
) {
  return {
    method,
    amount,
    reference: "",
    bankId: "",
    bankName: "",
    chequeNumber: "",
    chequeDueOn: "",
    drawerName: "",
    ...extra,
  };
}

// ── The receipt form ─────────────────────────────────────────────────────────

describe("paymentSchema", () => {
  const base = {
    familyId: "family-1",
    paidAt: "",
    notes: "",
    tenders: [tender("CASH", "1200")],
    allocations: [{ enrollmentFeeId: "fee-1", amount: "1200" }],
  };

  it("accepts a plain cash receipt", () => {
    const parsed = paymentSchema(t).safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("converts to centimes so nothing downstream sees a dirham", () => {
    const parsed = paymentSchema(t).safeParse(base);
    expect(parsed.success && parsed.data.allocations[0]!.amountCentimes).toBe(
      120000,
    );
  });

  it("refuses a receipt that settles nothing", () => {
    const parsed = paymentSchema(t).safeParse({ ...base, allocations: [] });
    expect(parsed.success).toBe(false);
  });

  it("refuses a receipt with no tender at all", () => {
    const parsed = paymentSchema(t).safeParse({ ...base, tenders: [] });
    expect(parsed.success).toBe(false);
  });

  it("refuses when the money taken does not match what it settles", () => {
    // The cross-total. Without it a cashier takes 1 200 and clears 2 000 of
    // charges, and the family's balance is wrong with a valid receipt on file.
    const parsed = paymentSchema(t).safeParse({
      ...base,
      allocations: [{ enrollmentFeeId: "fee-1", amount: "2000" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a receipt for nothing", () => {
    const parsed = paymentSchema(t).safeParse({
      ...base,
      tenders: [tender("CASH", "0")],
      allocations: [{ enrollmentFeeId: "fee-1", amount: "0" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts several tenders that add up", () => {
    const parsed = paymentSchema(t).safeParse({
      ...base,
      tenders: [
        tender("CASH", "500"),
        tender("CHEQUE", "700", { chequeNumber: "123456" }),
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("matches the totals across several lines and several tenders", () => {
    const parsed = paymentSchema(t).safeParse({
      ...base,
      tenders: [tender("CASH", "500"), tender("BANK_TRANSFER", "700")],
      allocations: [
        { enrollmentFeeId: "fee-1", amount: "800" },
        { enrollmentFeeId: "fee-2", amount: "400" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("catches a mismatch of a single centime", () => {
    // The whole reason the ledger is in centimes: a rounding difference must
    // fail loudly rather than settle silently.
    const parsed = paymentSchema(t).safeParse({
      ...base,
      tenders: [tender("CASH", "1200.01")],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses an amount that is not a number", () => {
    const parsed = paymentSchema(t).safeParse({
      ...base,
      allocations: [{ enrollmentFeeId: "fee-1", amount: "mille deux cents" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a negative amount", () => {
    const parsed = paymentSchema(t).safeParse({
      ...base,
      tenders: [tender("CASH", "-1200")],
      allocations: [{ enrollmentFeeId: "fee-1", amount: "-1200" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses an absurd amount rather than storing it", () => {
    const parsed = paymentSchema(t).safeParse({
      ...base,
      tenders: [tender("CASH", "999999999")],
      allocations: [{ enrollmentFeeId: "fee-1", amount: "999999999" }],
    });
    expect(parsed.success).toBe(false);
  });
});

// ── The transfer form ────────────────────────────────────────────────────────

describe("transferSchema", () => {
  const toRegister = {
    fromRegisterId: "reg-1",
    target: "REGISTER",
    toRegisterId: "reg-2",
    bankId: "",
    bankAccountLabel: "",
    amount: "500",
    reference: "",
    occurredAt: "",
    notes: "",
  };

  it("accepts a transfer between two tills", () => {
    expect(transferSchema(t).safeParse(toRegister).success).toBe(true);
  });

  it("refuses a transfer from a till to itself", () => {
    // Money that leaves a till and arrives in the same one has not moved, and
    // the pair of ledger legs it would write says otherwise.
    const parsed = transferSchema(t).safeParse({
      ...toRegister,
      toRegisterId: "reg-1",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires a destination till when the target is a till", () => {
    const parsed = transferSchema(t).safeParse({
      ...toRegister,
      toRegisterId: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires a bank or a written account when the target is the bank", () => {
    const toBank = { ...toRegister, target: "BANK", toRegisterId: "" };

    expect(transferSchema(t).safeParse(toBank).success).toBe(false);
    expect(
      transferSchema(t).safeParse({ ...toBank, bankId: "bank-1" }).success,
    ).toBe(true);
    expect(
      transferSchema(t).safeParse({ ...toBank, bankAccountLabel: "BP 1234" })
        .success,
    ).toBe(true);
  });

  it("refuses a transfer of nothing", () => {
    expect(
      transferSchema(t).safeParse({ ...toRegister, amount: "0" }).success,
    ).toBe(false);
  });

  it("accepts the smallest transfer the currency allows", () => {
    const parsed = transferSchema(t).safeParse({
      ...toRegister,
      amount: "0.01",
    });
    expect(parsed.success && parsed.data.amountCentimes).toBe(1);
  });

  it("refuses an unknown target", () => {
    expect(
      transferSchema(t).safeParse({ ...toRegister, target: "MATTRESS" }).success,
    ).toBe(false);
  });
});

// ── What a crafted POST can still try ────────────────────────────────────────

const tx = {
  enrollmentFee: { findMany: async () => lines },
  payment: {
    // `nextPaymentCode` counts this year's receipts inside the transaction.
    count: async () => 0,
    create: async (args: unknown) => {
      created.push(args);
      return { id: "pay-1", code: "R-2026-0001" };
    },
  },
  paymentTender: { create: async () => ({ id: "t" }) },
  cheque: { create: async () => ({ id: "c" }) },
  cashOperation: { create: async () => ({ id: "op" }) },
};

let lines: {
  id: string;
  amountCentimes: number;
  allocations: { amountCentimes: number }[];
}[] = [];
const created: unknown[] = [];

vi.mock("@/lib/db", () => ({
  auditClient: {},
  db: {
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    payment: {
      findFirst: async () => null,
      aggregate: async () => ({ _max: { sequence: 0 } }),
      count: async () => 0,
    },
    cashOperation: { aggregate: async () => ({ _max: { sequence: 0 } }) },
  },
}));

const { recordPayment } = await import("@/modules/treasury/service");

function input(
  allocations: { enrollmentFeeId: string; amountCentimes: number }[],
  tenders = [{ method: "CASH" as const, amountCentimes: 120000 }],
) {
  return {
    schoolId: "school-1",
    schoolYearId: "year-1",
    familyId: "family-1",
    paidAt: new Date(2026, 2, 15),
    createdById: "user-1",
    cashSessionId: "session-1",
    notes: null,
    tenders,
    allocations,
  } as Parameters<typeof recordPayment>[0];
}

beforeEach(() => {
  created.length = 0;
  lines = [
    { id: "fee-1", amountCentimes: 120000, allocations: [] },
    { id: "fee-2", amountCentimes: 80000, allocations: [] },
  ];
});

describe("recordPayment", () => {
  it("records a receipt that adds up", async () => {
    const result = await recordPayment(
      input([{ enrollmentFeeId: "fee-1", amountCentimes: 120000 }]),
    );

    expect(result.ok).toBe(true);
    expect(created).toHaveLength(1);
  });

  it("refuses a receipt that settles nothing", async () => {
    const result = await recordPayment(input([]));
    expect(result).toMatchObject({ ok: false, reason: "NO_LINES" });
    expect(created).toEqual([]);
  });

  it("refuses when the tenders and the allocations disagree", async () => {
    const result = await recordPayment(
      input([{ enrollmentFeeId: "fee-1", amountCentimes: 100000 }]),
    );
    expect(result).toMatchObject({ ok: false, reason: "TOTALS_DISAGREE" });
    expect(created).toEqual([]);
  });

  it("refuses a receipt for nothing", async () => {
    const result = await recordPayment(
      input([{ enrollmentFeeId: "fee-1", amountCentimes: 0 }], [
        { method: "CASH", amountCentimes: 0 },
      ]),
    );
    expect(result).toMatchObject({ ok: false, reason: "TOTALS_DISAGREE" });
  });

  it("merges a line named twice before checking it, not after", async () => {
    // Regression: a request naming one line twice passed the over-payment check
    // twice, each half compared against an outstanding figure that knew nothing
    // about the other — and only the unique index downstream caught it, as a
    // crash. 700 + 700 against a 1 200 charge must be refused as 1 400.
    const result = await recordPayment(
      input(
        [
          { enrollmentFeeId: "fee-1", amountCentimes: 70000 },
          { enrollmentFeeId: "fee-1", amountCentimes: 70000 },
        ],
        [{ method: "CASH", amountCentimes: 140000 }],
      ),
    );

    expect(result).toMatchObject({ ok: false, reason: "OVER_ALLOCATED" });
    expect(created).toEqual([]);
  });

  it("writes one allocation when a line is named twice and still fits", async () => {
    const result = await recordPayment(
      input(
        [
          { enrollmentFeeId: "fee-1", amountCentimes: 50000 },
          { enrollmentFeeId: "fee-1", amountCentimes: 70000 },
        ],
        [{ method: "CASH", amountCentimes: 120000 }],
      ),
    );

    expect(result.ok).toBe(true);
    expect(created[0]).toMatchObject({
      data: {
        allocations: {
          create: [{ enrollmentFeeId: "fee-1", amountCentimes: 120000 }],
        },
      },
    });
  });

  it("refuses to allocate more than a line still owes", async () => {
    lines = [
      {
        id: "fee-1",
        amountCentimes: 120000,
        allocations: [{ amountCentimes: 100000 }],
      },
    ];

    const result = await recordPayment(
      input([{ enrollmentFeeId: "fee-1", amountCentimes: 30000 }], [
        { method: "CASH", amountCentimes: 30000 },
      ]),
    );

    expect(result).toMatchObject({ ok: false, reason: "OVER_ALLOCATED" });
  });

  it("allows exactly what a part-paid line still owes", async () => {
    lines = [
      {
        id: "fee-1",
        amountCentimes: 120000,
        allocations: [{ amountCentimes: 100000 }],
      },
    ];

    const result = await recordPayment(
      input([{ enrollmentFeeId: "fee-1", amountCentimes: 20000 }], [
        { method: "CASH", amountCentimes: 20000 },
      ]),
    );

    expect(result.ok).toBe(true);
  });

  it("refuses a line the school and year cannot reach", async () => {
    // The re-read inside the transaction is scoped by school, year and family,
    // so another tenant's fee id simply is not there.
    lines = [];

    const result = await recordPayment(
      input([{ enrollmentFeeId: "fee-from-another-school", amountCentimes: 120000 }]),
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "LINE_UNREACHABLE",
      lineId: "fee-from-another-school",
    });
    expect(created).toEqual([]);
  });

  it("refuses the whole receipt when one line of several is unreachable", async () => {
    // Part-applying a receipt would leave the family's balance wrong with a
    // valid-looking document on file.
    const result = await recordPayment(
      input(
        [
          { enrollmentFeeId: "fee-1", amountCentimes: 120000 },
          { enrollmentFeeId: "fee-elsewhere", amountCentimes: 20000 },
        ],
        [{ method: "CASH", amountCentimes: 140000 }],
      ),
    );

    expect(result.ok).toBe(false);
    expect(created).toEqual([]);
  });

  it("refuses a negative allocation smuggled past the form", async () => {
    // Two negatives and a positive can be made to satisfy the cross-total, so
    // the sign has to be checked per line and not only in aggregate.
    const result = await recordPayment(
      input(
        [
          { enrollmentFeeId: "fee-1", amountCentimes: 140000 },
          { enrollmentFeeId: "fee-2", amountCentimes: -20000 },
        ],
        [{ method: "CASH", amountCentimes: 120000 }],
      ),
    );

    expect(result).toMatchObject({ ok: false, reason: "OVER_ALLOCATED" });
    expect(created).toEqual([]);
  });
});

/**
 * Balancing a règlement — the "Solder" button.
 *
 * Its own block because the rule is about *which row* takes the difference, and
 * every case below is one a cashier hits at the desk. The old version put the
 * difference on the first row whatever it was, which is where the chèque cases
 * come from.
 */
describe("balanceTenders", () => {
  const cash = (amount: number) => ({
    method: "CASH",
    amountCentimes: amount,
    isBlank: false,
  });
  const cheque = (amount: number) => ({
    method: "CHEQUE",
    amountCentimes: amount,
    isBlank: false,
  });
  const blank = (method = "CASH") => ({
    method,
    amountCentimes: 0,
    isBlank: true,
  });

  it("fills a single empty row with the whole selection", () => {
    expect(balanceTenders([blank()], 120_000)).toEqual([120_000]);
  });

  it("puts the balance on the empty row, not on the chèque above it", () => {
    // 3 000 by chèque, the rest in cash — the case the old version broke by
    // restating a signed document.
    expect(balanceTenders([cheque(300_000), blank()], 500_000)).toEqual([
      300_000,
      200_000,
    ]);
  });

  it("leaves a chèque alone and tops up the cash row when none is blank", () => {
    expect(balanceTenders([cheque(300_000), cash(100_000)], 500_000)).toEqual([
      300_000,
      200_000,
    ]);
  });

  it("falls back to the last row when every row is a chèque", () => {
    expect(balanceTenders([cheque(100_000), cheque(100_000)], 500_000)).toEqual([
      100_000,
      400_000,
    ]);
  });

  it("never leaves a row negative when more was tendered than ticked", () => {
    // The old subtraction produced -100 000 on row one: a receipt claiming the
    // school handed money out.
    const balanced = balanceTenders([cash(300_000), cash(300_000)], 500_000);
    expect(balanced).toEqual([300_000, 200_000]);
    expect(balanced.every((amount) => amount >= 0)).toBe(true);
  });

  it("empties later rows before touching earlier ones", () => {
    expect(
      balanceTenders([cash(300_000), cash(100_000), cash(100_000)], 250_000),
    ).toEqual([250_000, 0, 0]);
  });

  it("changes nothing when it already balances", () => {
    expect(balanceTenders([cash(200_000), cash(300_000)], 500_000)).toEqual([
      200_000,
      300_000,
    ]);
  });

  it("copes with no rows at all", () => {
    expect(balanceTenders([], 500_000)).toEqual([]);
  });
});
