import { describe, expect, it } from "vitest";

import {
  CATEGORY_KINDS,
  CHEQUE_STATUSES,
  CHEQUE_TRANSITIONS,
  FAILED_CHEQUE_STATUSES,
  OPEN_CHEQUE_STATUSES,
  PAYMENT_METHODS,
  TENDER_METHODS,
  UNPAID_CHEQUE_ENDINGS,
  canMoveCheque,
  cashImpactOf,
  categoryKindsFor,
  centimesToDirhams,
  chequeMovesFrom,
  chequeUndoesReceipt,
  dirhamsToCentimes,
  documentCode,
  expectedDrawerTotal,
  isChequeStatus,
  isStaleSession,
  recordedAt,
  openSessionKey,
  outstandingOf,
  startOfDay,
  sumCentimes,
  summariseMethod,
  type ChequeStatus,
} from "@/modules/treasury/enums";
import {
  PAYMENT_STATES,
  isOverdue,
  paymentStateOf,
  standingStateOf,
} from "@/modules/treasury/payment-state";

/**
 * La caisse.
 *
 * This module's rules are arithmetic, and arithmetic that is wrong by one
 * centime in one direction is a school that cannot close its day. So the tests
 * are about the *edges* — the boundary between due and late, between a drawer
 * that can cover a payout and one that cannot, between a cheque that became
 * money and one that never will.
 *
 * Everything is in centimes and integer throughout. That is not incidental:
 * `0.1 + 0.2` is the reason a ledger kept in dirhams eventually stops
 * reconciling, and several tests below exist only to keep it that way.
 */

// ── Money ────────────────────────────────────────────────────────────────────

describe("centimes", () => {
  it("round-trips a plain amount", () => {
    expect(dirhamsToCentimes(1200)).toBe(120000);
    expect(centimesToDirhams(120000)).toBe(1200);
  });

  it("rounds to the nearest centime rather than truncating", () => {
    expect(dirhamsToCentimes(12.345)).toBe(1235);
    expect(dirhamsToCentimes(12.344)).toBe(1234);
  });

  it("survives the amounts binary floating point gets wrong", () => {
    // 8.115 * 100 is 811.4999999999999 in IEEE 754. Truncating would lose a
    // centime on an ordinary fee, and lose it silently.
    expect(dirhamsToCentimes(8.115)).toBe(812);
    expect(dirhamsToCentimes(1.005)).toBe(100);
    expect(dirhamsToCentimes(0.1 + 0.2)).toBe(30);
  });

  it("handles zero and negatives without surprises", () => {
    expect(dirhamsToCentimes(0)).toBe(0);
    expect(dirhamsToCentimes(-45.5)).toBe(-4550);
    expect(centimesToDirhams(0)).toBe(0);
  });

  it("keeps a school year's fees exact when summed", () => {
    // Ten instalments of 1 233,33 — the case a dirham-denominated ledger drifts
    // on. In centimes it is exact by construction.
    const instalment = dirhamsToCentimes(1233.33);
    const total = sumCentimes(Array.from({ length: 10 }, () => instalment));
    expect(total).toBe(1233330);
    expect(Number.isInteger(total)).toBe(true);
  });
});

describe("sumCentimes", () => {
  it("adds nothing to zero", () => {
    expect(sumCentimes([])).toBe(0);
  });

  it("adds a mix of signs", () => {
    expect(sumCentimes([50000, -20000, 1500])).toBe(31500);
  });
});

describe("outstandingOf", () => {
  it("is what is left to pay", () => {
    expect(outstandingOf(120000, 40000)).toBe(80000);
  });

  it("is zero once settled exactly", () => {
    expect(outstandingOf(120000, 120000)).toBe(0);
  });

  it("floors at zero so an over-allocation cannot poison a family total", () => {
    // The service refuses over-allocation; this keeps one bug from becoming a
    // negative that silently cancels out somebody else's genuine debt.
    expect(outstandingOf(120000, 150000)).toBe(0);
  });
});

// ── The rule the drawer balances on ──────────────────────────────────────────

describe("cashImpactOf", () => {
  it("adds cash taken in and removes cash paid out", () => {
    expect(cashImpactOf("ENCAISSEMENT", "CASH", 50000)).toBe(50000);
    expect(cashImpactOf("DECAISSEMENT", "CASH", 50000)).toBe(-50000);
  });

  it("moves nothing for a cheque or a transfer", () => {
    // A cheque sits in the safe and a virement never comes near the desk, so
    // neither may shift the figure the cashier will be asked to count.
    for (const kind of ["ENCAISSEMENT", "DECAISSEMENT"] as const) {
      expect(cashImpactOf(kind, "CHEQUE", 50000)).toBe(0);
      expect(cashImpactOf(kind, "BANK_TRANSFER", 50000)).toBe(0);
    }
  });

  it("moves only the cash portion of a mixed receipt", () => {
    // 1 200 paid as 500 cash + 700 cheque moves 500 in the drawer, not 1 200.
    expect(cashImpactOf("ENCAISSEMENT", "MIXED", 50000)).toBe(50000);
    expect(cashImpactOf("DECAISSEMENT", "MIXED", 50000)).toBe(-50000);
  });

  it("moves nothing when the cash portion is zero", () => {
    expect(cashImpactOf("ENCAISSEMENT", "MIXED", 0)).toBe(0);
  });
});

describe("expectedDrawerTotal", () => {
  it("is the float plus everything posted since", () => {
    expect(expectedDrawerTotal(20000, [50000, -15000, 3000])).toBe(58000);
  });

  it("is the float alone on a drawer nothing has moved through", () => {
    expect(expectedDrawerTotal(20000, [])).toBe(20000);
  });

  it("can legitimately reach zero", () => {
    expect(expectedDrawerTotal(20000, [-20000])).toBe(0);
  });

  it("reports a negative rather than hiding one", () => {
    // Not reachable through the app — `availableIfShortOf` refuses first — but
    // if the ledger ever did say this, the figure must show it rather than
    // clamp and look correct.
    expect(expectedDrawerTotal(10000, [-15000])).toBe(-5000);
  });
});

// ── Tenders ──────────────────────────────────────────────────────────────────

describe("summariseMethod", () => {
  it("keeps a single tender's own name", () => {
    for (const method of TENDER_METHODS) {
      expect(summariseMethod([method])).toBe(method);
    }
  });

  it("stays single-named when the same tender is used twice", () => {
    expect(summariseMethod(["CASH", "CASH"])).toBe("CASH");
  });

  it("becomes MIXED across two or more kinds", () => {
    expect(summariseMethod(["CASH", "CHEQUE"])).toBe("MIXED");
    expect(summariseMethod(["CASH", "CHEQUE", "BANK_TRANSFER"])).toBe("MIXED");
  });

  it("never offers MIXED as a tender in its own right", () => {
    // MIXED is a summary for the ledger; the detail lives in the tenders.
    expect(TENDER_METHODS).not.toContain("MIXED");
    expect(PAYMENT_METHODS).toContain("MIXED");
    for (const tender of TENDER_METHODS) {
      expect(PAYMENT_METHODS).toContain(tender);
    }
  });
});

describe("categoryKindsFor", () => {
  it("always admits the rubriques that belong on both sides", () => {
    expect(categoryKindsFor("IN")).toEqual(["IN", "BOTH"]);
    expect(categoryKindsFor("OUT")).toEqual(["OUT", "BOTH"]);
  });

  it("never lets one side's rubriques onto the other", () => {
    expect(categoryKindsFor("IN")).not.toContain("OUT");
    expect(categoryKindsFor("OUT")).not.toContain("IN");
  });

  it("covers the declared kinds between the two sides", () => {
    const covered = new Set([
      ...categoryKindsFor("IN"),
      ...categoryKindsFor("OUT"),
    ]);
    expect([...covered].sort()).toEqual([...CATEGORY_KINDS].sort());
  });
});

// ── The shift ────────────────────────────────────────────────────────────────

describe("recordedAt", () => {
  it("is simply now when the form sent no day", () => {
    const before = Date.now();
    const moment = recordedAt(null).getTime();
    expect(moment).toBeGreaterThanOrEqual(before);
    expect(moment).toBeLessThanOrEqual(Date.now());
  });

  it("keeps the chosen day and takes the clock time from now", () => {
    // What a date input posts: "2026-08-13" coerced through `new Date`, which
    // the spec fixes at midnight UTC. This is the exact value that used to
    // reach the database and render as 01h00 in Morocco.
    const chosen = new Date("2026-08-13");
    const stamped = recordedAt(chosen);
    const now = new Date();

    expect(stamped.getFullYear()).toBe(2026);
    expect(stamped.getMonth()).toBe(7);
    expect(stamped.getDate()).toBe(13);
    // Not midnight — the whole point.
    expect(stamped.getHours()).toBe(now.getHours());
    expect(stamped.getMinutes()).toBe(now.getMinutes());
  });

  it("names the day the operator picked, not the one UTC midnight lands on", () => {
    // Reading the local components of a UTC-midnight value gives the previous
    // day anywhere west of Greenwich. Asserting on the UTC components of the
    // input is what makes this test mean the same thing in every zone.
    const chosen = new Date("2026-01-01");
    const stamped = recordedAt(chosen);

    expect(stamped.getFullYear()).toBe(chosen.getUTCFullYear());
    expect(stamped.getMonth()).toBe(chosen.getUTCMonth());
    expect(stamped.getDate()).toBe(chosen.getUTCDate());
  });

  it("does not mutate its argument", () => {
    const chosen = new Date("2026-08-13");
    const before = chosen.getTime();
    recordedAt(chosen);
    expect(chosen.getTime()).toBe(before);
  });
});

describe("startOfDay", () => {
  it("keeps the calendar day and drops the time", () => {
    const day = startOfDay(new Date(2026, 2, 15, 23, 59, 59, 999));
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(2);
    expect(day.getDate()).toBe(15);
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
    expect(day.getSeconds()).toBe(0);
    expect(day.getMilliseconds()).toBe(0);
  });

  it("does not mutate its argument", () => {
    const moment = new Date(2026, 2, 15, 14, 30);
    const before = moment.getTime();
    startOfDay(moment);
    expect(moment.getTime()).toBe(before);
  });

  it("works in local time, not UTC", () => {
    // The bug this closes elsewhere in the module: `toISOString().slice(0,10)`
    // reads the UTC day, which is a day behind for every hour before 01h00 in
    // Morocco — so the message naming the day a shift belonged to named the
    // wrong one.
    const lateEvening = new Date(2026, 2, 15, 23, 30);
    expect(startOfDay(lateEvening).getDate()).toBe(15);
  });
});

describe("isStaleSession", () => {
  const openedAt = new Date(2026, 2, 15, 8, 0);

  it("is fresh at any hour of its own day", () => {
    expect(isStaleSession(openedAt, new Date(2026, 2, 15, 8, 0))).toBe(false);
    expect(isStaleSession(openedAt, new Date(2026, 2, 15, 23, 59, 59))).toBe(
      false,
    );
  });

  it("is stale the moment the next day starts", () => {
    // A drawer opened at 08h00 and still open at 09h00 the next morning has
    // been open twenty-five hours — but what makes it wrong is that it belongs
    // to yesterday, and yesterday has been counted and banked.
    expect(isStaleSession(openedAt, new Date(2026, 2, 16, 0, 0, 0))).toBe(true);
    expect(isStaleSession(openedAt, new Date(2026, 2, 16, 9, 0))).toBe(true);
  });

  it("is decided by the calendar day, not by elapsed hours", () => {
    // Twenty-three hours, but across midnight: stale.
    const lateOpen = new Date(2026, 2, 15, 23, 0);
    expect(isStaleSession(lateOpen, new Date(2026, 2, 16, 22, 0))).toBe(true);

    // Sixteen hours, same day: fresh.
    const earlyOpen = new Date(2026, 2, 15, 7, 0);
    expect(isStaleSession(earlyOpen, new Date(2026, 2, 15, 23, 0))).toBe(false);
  });

  it("is stale across a month and a year boundary", () => {
    expect(
      isStaleSession(new Date(2026, 0, 31, 20, 0), new Date(2026, 1, 1, 8, 0)),
    ).toBe(true);
    expect(
      isStaleSession(new Date(2025, 11, 31, 20, 0), new Date(2026, 0, 1, 8, 0)),
    ).toBe(true);
  });
});

describe("openSessionKey", () => {
  it("carries the register's id while the session is open", () => {
    // Which is what makes the unique index refuse a second open session on the
    // same till.
    expect(openSessionKey("reg-1", "OPEN")).toBe("reg-1");
  });

  it("is null once closed, so every closed session escapes the index", () => {
    // SQLite treats NULLs as distinct, so any number of closed sessions coexist.
    expect(openSessionKey("reg-1", "CLOSED")).toBeNull();
  });
});

describe("documentCode", () => {
  it("pads the sequence to four digits so codes sort as text", () => {
    expect(documentCode("R", 2025, 187)).toBe("R-2025-0187");
    expect(documentCode("OP", 2025, 43)).toBe("OP-2025-0043");
    expect(documentCode("R", 2025, 1)).toBe("R-2025-0001");
  });

  it("does not truncate once past four digits", () => {
    expect(documentCode("R", 2025, 12345)).toBe("R-2025-12345");
  });

  it("keeps codes of one year sorting in issue order", () => {
    const codes = [1, 2, 10, 99, 100, 1000].map((n) =>
      documentCode("R", 2025, n),
    );
    expect([...codes].sort()).toEqual(codes);
  });
});

// ── The life of a cheque ─────────────────────────────────────────────────────

describe("cheque transitions", () => {
  it("declares a row for every status", () => {
    for (const status of CHEQUE_STATUSES) {
      expect(CHEQUE_TRANSITIONS[status], status).toBeDefined();
    }
  });

  it("never moves back to the pile", () => {
    // PENDING is where a cheque starts and nothing returns to it.
    for (const status of CHEQUE_STATUSES) {
      expect(CHEQUE_TRANSITIONS[status], status).not.toContain("PENDING");
    }
  });

  it("only ever names statuses that exist", () => {
    for (const status of CHEQUE_STATUSES) {
      for (const next of CHEQUE_TRANSITIONS[status]) {
        expect(CHEQUE_STATUSES).toContain(next);
      }
    }
  });

  it("lets the pile be banked, cashed, handed back or struck out", () => {
    expect([...CHEQUE_TRANSITIONS.PENDING].sort()).toEqual([
      "CANCELLED",
      "CASHED",
      "DEPOSITED",
      "RETURNED",
    ]);
  });

  it("lets a bounced cheque be re-presented", () => {
    // A family says "représentez-le le 5", and without this the cheque was
    // stranded in a terminal state it had not really reached.
    expect(canMoveCheque("BOUNCED", "DEPOSITED")).toBe(true);
  });

  it("treats the money-arrived and paper-gone endings as final", () => {
    for (const terminal of ["CASHED", "RETURNED", "CANCELLED"] as const) {
      expect(CHEQUE_TRANSITIONS[terminal], terminal).toEqual([]);
      for (const target of CHEQUE_STATUSES) {
        expect(canMoveCheque(terminal, target), `${terminal}→${target}`).toBe(
          false,
        );
      }
    }
  });

  it("refuses a move the table does not draw", () => {
    expect(canMoveCheque("PENDING", "BOUNCED")).toBe(false);
    expect(canMoveCheque("DEPOSITED", "CANCELLED")).toBe(false);
  });

  it("offers nothing at all from a status the code does not know", () => {
    // The column is a plain String, so this is reachable from data alone —
    // and indexing off the end of the table would crash the menu.
    expect(chequeMovesFrom("HELD_BY_LAWYER")).toEqual([]);
    expect(chequeMovesFrom("")).toEqual([]);
    expect(chequeMovesFrom("__proto__")).toEqual([]);
    expect(canMoveCheque("HELD_BY_LAWYER", "CASHED")).toBe(false);
    expect(canMoveCheque("PENDING", "NOT_A_STATUS")).toBe(false);
  });

  it("recognises exactly the declared statuses", () => {
    for (const status of CHEQUE_STATUSES) expect(isChequeStatus(status)).toBe(true);
    for (const other of ["pending", "Cashed", "", "toString"]) {
      expect(isChequeStatus(other), other).toBe(false);
    }
  });

  it("can reach every non-initial status from PENDING", () => {
    // Otherwise a status exists that no cheque can ever be in.
    const seen = new Set<ChequeStatus>(["PENDING"]);
    const queue: ChequeStatus[] = ["PENDING"];
    while (queue.length) {
      for (const next of CHEQUE_TRANSITIONS[queue.shift()!]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...CHEQUE_STATUSES].sort());
  });
});

describe("what a cheque's ending means for the receipt", () => {
  it("undoes the receipt for all three endings that never became money", () => {
    // Only BOUNCED used to. A cheque handed back or struck out left the receipt
    // standing, so the family still read as having paid, the charges never came
    // back onto the schedule, and the day's takings counted money the school
    // was never going to see.
    for (const status of ["BOUNCED", "RETURNED", "CANCELLED"] as const) {
      expect(chequeUndoesReceipt(status), status).toBe(true);
    }
  });

  it("leaves the receipt alone when the money actually arrived", () => {
    expect(chequeUndoesReceipt("CASHED")).toBe(false);
  });

  it("does not undo anything for a cheque still in flight", () => {
    expect(chequeUndoesReceipt("PENDING")).toBe(false);
    expect(chequeUndoesReceipt("DEPOSITED")).toBe(false);
  });

  it("says no to a status it does not know", () => {
    expect(chequeUndoesReceipt("SOMETHING_ELSE")).toBe(false);
  });

  it("counts as open exactly the cheques still expected to turn into money", () => {
    expect([...OPEN_CHEQUE_STATUSES].sort()).toEqual(["DEPOSITED", "PENDING"]);
  });

  it("flags in red only what the school expected money from and did not get", () => {
    // One short of UNPAID_CHEQUE_ENDINGS on purpose: CANCELLED is a cashier
    // striking out their own typing, and drawing every corrected keystroke in
    // red is how a screen teaches people to ignore red.
    expect([...FAILED_CHEQUE_STATUSES].sort()).toEqual(["BOUNCED", "RETURNED"]);
    expect(FAILED_CHEQUE_STATUSES).not.toContain("CANCELLED");
    for (const status of FAILED_CHEQUE_STATUSES) {
      expect(UNPAID_CHEQUE_ENDINGS).toContain(status);
    }
  });

  it("partitions every status into open, unpaid, or cashed", () => {
    for (const status of CHEQUE_STATUSES) {
      const open = OPEN_CHEQUE_STATUSES.includes(status);
      const unpaid = UNPAID_CHEQUE_ENDINGS.includes(status);
      expect(
        Number(open) + Number(unpaid) + Number(status === "CASHED"),
        `${status} must be in exactly one bucket`,
      ).toBe(1);
    }
  });
});

// ── Where a charge stands ────────────────────────────────────────────────────

describe("isOverdue", () => {
  const now = new Date(2026, 2, 15, 14, 0);

  it("is not late on the day it falls due", () => {
    // The failure this closes: a family chased at 14h00 for an instalment due
    // that morning. A due date is a wall-calendar date.
    expect(isOverdue(new Date(2026, 2, 15, 0, 0), now)).toBe(false);
    expect(isOverdue(new Date(2026, 2, 15, 23, 59), now)).toBe(false);
  });

  it("is late once the day has passed", () => {
    expect(isOverdue(new Date(2026, 2, 14, 23, 59), now)).toBe(true);
  });

  it("is not late while the day is still ahead", () => {
    expect(isOverdue(new Date(2026, 2, 16, 0, 0), now)).toBe(false);
  });

  it("accepts a date written as a string", () => {
    expect(isOverdue("2026-03-14", now)).toBe(true);
    expect(isOverdue("2026-03-16", now)).toBe(false);
  });

  it("treats an absent or unparseable date as not late", () => {
    // An absent date cannot make a charge overdue.
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
    expect(isOverdue("", now)).toBe(false);
    expect(isOverdue("not a date", now)).toBe(false);
  });
});

describe("paymentStateOf", () => {
  const now = new Date(2026, 2, 15, 12, 0);
  const future = new Date(2026, 5, 1);
  const past = new Date(2026, 0, 1);

  it("is settled once the whole charge is covered", () => {
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 120000,
        dueDate: past,
        now,
      }),
    ).toBe("SETTLED");
  });

  it("is settled even when overpaid, and even when the date has passed", () => {
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 130000,
        dueDate: past,
        now,
      }),
    ).toBe("SETTLED");
  });

  it("is upcoming when nothing is paid and the date is ahead", () => {
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 0,
        dueDate: future,
        now,
      }),
    ).toBe("UPCOMING");
  });

  it("is partial when something is paid and the date is ahead", () => {
    // A family that has paid 800 of 1 200 is neither settled nor untouched, and
    // collapsing this into OVERDUE would put a paying family on the chasing list.
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 80000,
        dueDate: future,
        now,
      }),
    ).toBe("PARTIAL");
  });

  it("is overdue once the day has passed with anything still owed", () => {
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 0,
        dueDate: past,
        now,
      }),
    ).toBe("OVERDUE");
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 119999,
        dueDate: past,
        now,
      }),
    ).toBe("OVERDUE");
  });

  it("prefers settled over overdue when both could apply", () => {
    // Paid late is paid, not late.
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 120000,
        dueDate: past,
        now,
      }),
    ).toBe("SETTLED");
  });

  it("is upcoming for an undated charge nobody has paid", () => {
    expect(
      paymentStateOf({
        amountCentimes: 120000,
        paidCentimes: 0,
        dueDate: null,
        now,
      }),
    ).toBe("UPCOMING");
  });

  it("is settled for a charge of nothing", () => {
    expect(
      paymentStateOf({
        amountCentimes: 0,
        paidCentimes: 0,
        dueDate: past,
        now,
      }),
    ).toBe("SETTLED");
  });

  it("only ever answers one of the four declared states", () => {
    for (const paid of [0, 1, 59999, 120000, 130000]) {
      for (const dueDate of [past, future, null]) {
        expect(
          PAYMENT_STATES as readonly string[],
        ).toContain(
          paymentStateOf({
            amountCentimes: 120000,
            paidCentimes: paid,
            dueDate,
            now,
          }),
        );
      }
    }
  });
});

describe("standingStateOf", () => {
  it("is overdue when any part of the schedule is late", () => {
    // One late instalment makes the whole schedule need chasing, even if most
    // of the year is paid.
    expect(
      standingStateOf({
        chargedCentimes: 1200000,
        paidCentimes: 1100000,
        overdueCentimes: 100000,
      }),
    ).toBe("OVERDUE");
  });

  it("is settled when the whole schedule is covered and nothing is late", () => {
    expect(
      standingStateOf({
        chargedCentimes: 1200000,
        paidCentimes: 1200000,
        overdueCentimes: 0,
      }),
    ).toBe("SETTLED");
  });

  it("is partial part-way through a year", () => {
    expect(
      standingStateOf({
        chargedCentimes: 1200000,
        paidCentimes: 400000,
        overdueCentimes: 0,
      }),
    ).toBe("PARTIAL");
  });

  it("is upcoming before anything has been paid", () => {
    expect(
      standingStateOf({
        chargedCentimes: 1200000,
        paidCentimes: 0,
        overdueCentimes: 0,
      }),
    ).toBe("UPCOMING");
  });

  it("does not call an empty schedule settled", () => {
    // Nothing charged and nothing paid is a pupil with no fee schedule yet,
    // which must not read on screen as a family that has paid up.
    expect(
      standingStateOf({
        chargedCentimes: 0,
        paidCentimes: 0,
        overdueCentimes: 0,
      }),
    ).toBe("UPCOMING");
  });
});
