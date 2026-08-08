import { describe, expect, it } from "vitest";

import {
  ADVANCE_STATUSES,
  DEPARTMENTS,
  JOB_ROLES,
  CHARGEABLE_ABSENCE_STATUSES,
  EMPLOYED_STATUSES,
  OWED_ADVANCE_STATUSES,
  PAYABLE_SALARY_STATUSES,
  STAFF_STATUSES,
  WORKING_DAYS_PER_MONTH,
  advanceInstalment,
  dailyRate,
  departmentOf,
  grossSalary,
  isAdvanceDecidable,
  isAdvancePayable,
  isChargeableAbsence,
  netSalary,
  outstandingAdvance,
  spanInDays,
  staffName,
  startOfDay,
  suggestStatutory,
  totalDeductions,
} from "@/modules/hr/enums";

/**
 * La RH.
 *
 * Two things here are worth more than the rest. The first is arithmetic that
 * ends up on a legal document with somebody's name on it. The second is that
 * `hr.view` and `hr.payroll` are different codes — in most schools exactly two
 * people may see what a colleague earns, and the confidentiality tests live in
 * `payroll-visibility.test.ts` beside this one.
 */

// ── Le bulletin ──────────────────────────────────────────────────────────────

const gains = {
  baseCentimes: 800_000,
  allowanceCentimes: 100_000,
  overtimeCentimes: 50_000,
  bonusCentimes: 25_000,
};

const noDeductions = {
  absenceCentimes: 0,
  advanceCentimes: 0,
  socialCentimes: 0,
  taxCentimes: 0,
  otherDeductionCentimes: 0,
};

describe("grossSalary", () => {
  it("adds every gain", () => {
    expect(grossSalary(gains)).toBe(975_000);
  });

  it("is the base alone when nothing is added", () => {
    expect(
      grossSalary({
        baseCentimes: 800_000,
        allowanceCentimes: 0,
        overtimeCentimes: 0,
        bonusCentimes: 0,
      }),
    ).toBe(800_000);
  });

  it("stays an integer number of centimes", () => {
    expect(Number.isInteger(grossSalary(gains))).toBe(true);
  });
});

describe("totalDeductions", () => {
  it("adds every retenue", () => {
    expect(
      totalDeductions({
        absenceCentimes: 30_000,
        advanceCentimes: 100_000,
        socialCentimes: 60_000,
        taxCentimes: 40_000,
        otherDeductionCentimes: 5_000,
      }),
    ).toBe(235_000);
  });

  it("is zero when nothing is withheld", () => {
    expect(totalDeductions(noDeductions)).toBe(0);
  });
});

describe("netSalary", () => {
  it("is the gross less the retenues", () => {
    expect(
      netSalary(gains, { ...noDeductions, socialCentimes: 75_000 }),
    ).toBe(900_000);
  });

  it("is the gross when nothing is withheld", () => {
    expect(netSalary(gains, noDeductions)).toBe(975_000);
  });

  it("floors at zero rather than going negative", () => {
    // A negative bulletin would become a décaissement the school collects
    // *from* an employee. What is genuinely owed back is recovered as an
    // advance on the following month, which is how a bursar does it on paper.
    expect(
      netSalary(gains, { ...noDeductions, otherDeductionCentimes: 2_000_000 }),
    ).toBe(0);
  });

  it("is exactly zero when the retenues match the gross", () => {
    expect(
      netSalary(gains, { ...noDeductions, otherDeductionCentimes: 975_000 }),
    ).toBe(0);
  });
});

// ── Cotisations ──────────────────────────────────────────────────────────────

describe("suggestStatutory", () => {
  // CNSS 4.48%, ceiling 6 000 MAD, AMO 2.26%, an illustrative flat IR.
  const rates = {
    cnssRateBps: 448,
    cnssCeilingCentimes: 600_000,
    amoRateBps: 226,
    irRateBps: 1000,
  };

  it("computes each cotisation off the gross", () => {
    const suggestion = suggestStatutory(500_000, rates);
    expect(suggestion.cnssCentimes).toBe(22_400);
    expect(suggestion.amoCentimes).toBe(11_300);
    expect(suggestion.socialCentimes).toBe(33_700);
  });

  it("caps the CNSS base at the ceiling", () => {
    // The one piece of real structure here, and getting it wrong is not a
    // rounding error: above the ceiling the employee's share stops growing, and
    // computing it on the whole gross overstates every senior salary.
    const atCeiling = suggestStatutory(600_000, rates);
    const wellAbove = suggestStatutory(2_000_000, rates);

    expect(wellAbove.cnssCentimes).toBe(atCeiling.cnssCentimes);
    expect(wellAbove.cnssCentimes).toBe(26_880);
  });

  it("does not cap the AMO, which has no ceiling", () => {
    const low = suggestStatutory(600_000, rates);
    const high = suggestStatutory(2_000_000, rates);
    expect(high.amoCentimes).toBeGreaterThan(low.amoCentimes);
  });

  it("treats a ceiling of zero as no ceiling at all", () => {
    const uncapped = suggestStatutory(2_000_000, {
      ...rates,
      cnssCeilingCentimes: 0,
    });
    expect(uncapped.cnssCentimes).toBe(89_600);
  });

  it("returns whole centimes, never a fraction", () => {
    const suggestion = suggestStatutory(333_333, rates);
    for (const value of Object.values(suggestion)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("never suggests a negative deduction", () => {
    const suggestion = suggestStatutory(0, rates);
    for (const value of Object.values(suggestion)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps social as the sum of its two parts", () => {
    // The screen shows the parts to explain the figure; they must add up to the
    // box the bulletin actually stores.
    for (const gross of [0, 250_000, 600_000, 1_500_000]) {
      const s = suggestStatutory(gross, rates);
      expect(s.socialCentimes, String(gross)).toBe(s.cnssCentimes + s.amoCentimes);
    }
  });
});

describe("dailyRate", () => {
  it("uses the twenty-six-day Moroccan convention", () => {
    expect(WORKING_DAYS_PER_MONTH).toBe(26);
    expect(dailyRate(800_000)).toBe(Math.round(800_000 / 26));
  });

  it("accepts another working-day count", () => {
    expect(dailyRate(800_000, 20)).toBe(40_000);
  });

  it("does not divide by zero", () => {
    expect(dailyRate(800_000, 0)).toBe(800_000);
    expect(Number.isFinite(dailyRate(800_000, 0))).toBe(true);
  });

  it("returns whole centimes", () => {
    expect(Number.isInteger(dailyRate(999_999))).toBe(true);
  });
});

// ── Les avances ──────────────────────────────────────────────────────────────

describe("outstandingAdvance", () => {
  it("is the amount less what has been recovered", () => {
    expect(
      outstandingAdvance({
        status: "PAID",
        amountCentimes: 300_000,
        recoveredCentimes: 100_000,
      }),
    ).toBe(200_000);
  });

  it("owes nothing before the money has left", () => {
    // REQUESTED and APPROVED owe nothing: the cash is still in the till.
    for (const status of ["REQUESTED", "APPROVED", "CANCELLED"]) {
      expect(
        outstandingAdvance({
          status,
          amountCentimes: 300_000,
          recoveredCentimes: 0,
        }),
        status,
      ).toBe(0);
    }
  });

  it("floors at zero on an over-recovery", () => {
    // The service refuses one, but a hand-edited row must read as settled
    // rather than as the school owing the employee money.
    expect(
      outstandingAdvance({
        status: "PAID",
        amountCentimes: 300_000,
        recoveredCentimes: 400_000,
      }),
    ).toBe(0);
  });

  it("owes nothing once fully recovered", () => {
    expect(
      outstandingAdvance({
        status: "RECOVERED",
        amountCentimes: 300_000,
        recoveredCentimes: 300_000,
      }),
    ).toBe(0);
  });

  it("owes nothing for a status it does not know", () => {
    expect(
      outstandingAdvance({
        status: "SOMETHING_ELSE",
        amountCentimes: 300_000,
        recoveredCentimes: 0,
      }),
    ).toBe(0);
  });
});

describe("advanceInstalment", () => {
  const advance = {
    status: "PAID",
    amountCentimes: 300_000,
    recoveredCentimes: 0,
    instalmentCount: 3,
  };

  it("spreads the advance over its instalments", () => {
    expect(advanceInstalment(advance)).toBe(100_000);
  });

  it("never asks for more than is still owed", () => {
    // The last instalment is whatever is left, so rounding never leaves a stray
    // centime owed for ever.
    expect(
      advanceInstalment({ ...advance, recoveredCentimes: 250_000 }),
    ).toBe(50_000);
  });

  it("clears the remainder on the final instalment", () => {
    // 100 000 over 3 is 33 333,33 — three equal instalments leave a centime.
    const odd = {
      status: "PAID",
      amountCentimes: 100_000,
      recoveredCentimes: 0,
      instalmentCount: 3,
    };
    let recovered = 0;
    for (let month = 0; month < 12 && recovered < odd.amountCentimes; month++) {
      recovered += advanceInstalment({ ...odd, recoveredCentimes: recovered });
    }
    expect(recovered).toBe(odd.amountCentimes);
  });

  it("asks for nothing once nothing is owed", () => {
    expect(
      advanceInstalment({ ...advance, recoveredCentimes: 300_000 }),
    ).toBe(0);
    expect(advanceInstalment({ ...advance, status: "REQUESTED" })).toBe(0);
  });

  it("survives an instalment count of zero", () => {
    expect(advanceInstalment({ ...advance, instalmentCount: 0 })).toBe(300_000);
  });

  it("always asks for at least one centime while something is owed", () => {
    // Otherwise an advance spread over more instalments than it has centimes
    // would never finish being recovered.
    const tiny = {
      status: "PAID",
      amountCentimes: 5,
      recoveredCentimes: 0,
      instalmentCount: 60,
    };
    expect(advanceInstalment(tiny)).toBeGreaterThan(0);
  });
});

describe("advance statuses", () => {
  it("lets a decision be made only before one has been", () => {
    expect(isAdvanceDecidable("REQUESTED")).toBe(true);
    for (const status of ["APPROVED", "PAID", "RECOVERED", "CANCELLED"]) {
      expect(isAdvanceDecidable(status), status).toBe(false);
    }
  });

  it("lets money leave only once the advance is agreed", () => {
    expect(isAdvancePayable("APPROVED")).toBe(true);
    for (const status of ["REQUESTED", "PAID", "RECOVERED", "CANCELLED"]) {
      expect(isAdvancePayable(status), status).toBe(false);
    }
  });

  it("owes money only once it has been handed over", () => {
    // PAID and RECOVERED, and not the two before the cash leaves the till.
    // RECOVERED stays on the list deliberately: the status is stamped from the
    // sum, so a row that says RECOVERED while its recoveries fall short must
    // still report the remainder rather than silently reading as settled.
    expect([...OWED_ADVANCE_STATUSES].sort()).toEqual(["PAID", "RECOVERED"]);
    for (const status of ["REQUESTED", "APPROVED", "CANCELLED"]) {
      expect(OWED_ADVANCE_STATUSES, status).not.toContain(status);
    }
    for (const status of OWED_ADVANCE_STATUSES) {
      expect(ADVANCE_STATUSES).toContain(status);
    }
  });

  it("still reports a remainder on a row stamped RECOVERED too early", () => {
    expect(
      outstandingAdvance({
        status: "RECOVERED",
        amountCentimes: 300_000,
        recoveredCentimes: 250_000,
      }),
    ).toBe(50_000);
  });

  it("says no to a status the code does not know", () => {
    expect(isAdvanceDecidable("")).toBe(false);
    expect(isAdvancePayable("__proto__")).toBe(false);
  });
});

// ── Le registre ──────────────────────────────────────────────────────────────

describe("isChargeableAbsence", () => {
  it("charges an unjustified absence of a declared kind", () => {
    for (const status of CHARGEABLE_ABSENCE_STATUSES) {
      expect(isChargeableAbsence(status, false), status).toBe(true);
    }
  });

  it("never charges an absence somebody justified", () => {
    // The office accepting a note is what stops the retenue, and it has to beat
    // the status: a justified ABSENT is still ABSENT on the register.
    for (const status of CHARGEABLE_ABSENCE_STATUSES) {
      expect(isChargeableAbsence(status, true), status).toBe(false);
    }
  });

  it("does not charge a day somebody worked", () => {
    expect(isChargeableAbsence("PRESENT", false)).toBe(false);
    expect(isChargeableAbsence("PRESENT", true)).toBe(false);
  });

  it("does not charge a status it does not know", () => {
    expect(isChargeableAbsence("", false)).toBe(false);
    expect(isChargeableAbsence("toString", false)).toBe(false);
    expect(isChargeableAbsence("__proto__", false)).toBe(false);
  });
});

describe("startOfDay", () => {
  it("keeps the local calendar day", () => {
    // Local rather than UTC on purpose: a register is marked in the morning at
    // the school, and a UTC day would put a mark made at 00h30 in Casablanca on
    // the day before.
    const marked = startOfDay(new Date(2026, 2, 15, 0, 30));
    expect(marked.getDate()).toBe(15);
    expect(marked.getHours()).toBe(0);
  });

  it("normalises every hour of a day to the same instant", () => {
    // Which is what makes the unique index on (staffId, date) bite.
    const morning = startOfDay(new Date(2026, 2, 15, 7, 45));
    const evening = startOfDay(new Date(2026, 2, 15, 19, 5));
    expect(morning.getTime()).toBe(evening.getTime());
  });

  it("accepts a date written as a string", () => {
    expect(startOfDay("2026-03-15").getHours()).toBe(0);
  });

  it("does not mutate the date it was given", () => {
    const moment = new Date(2026, 2, 15, 14, 30);
    const before = moment.getTime();
    startOfDay(moment);
    expect(moment.getTime()).toBe(before);
  });
});

describe("spanInDays", () => {
  it("counts both ends", () => {
    expect(spanInDays(new Date(2026, 2, 2), new Date(2026, 2, 6))).toBe(5);
  });

  it("counts a single day as one", () => {
    const day = new Date(2026, 2, 2);
    expect(spanInDays(day, day)).toBe(1);
  });

  it("ignores the time of day at either end", () => {
    expect(
      spanInDays(new Date(2026, 2, 2, 17, 0), new Date(2026, 2, 3, 8, 0)),
    ).toBe(2);
  });

  it("counts nothing for a range that ends before it starts", () => {
    expect(spanInDays(new Date(2026, 2, 6), new Date(2026, 2, 2))).toBe(0);
  });

  it("survives a daylight-saving change", () => {
    // Morocco shifts its clocks around Ramadan, so a "day" in the range is 23
    // or 25 hours. Flooring the division would lose a day of leave.
    const across = spanInDays(new Date(2026, 2, 20), new Date(2026, 3, 10));
    expect(across).toBe(22);
  });

  it("counts a whole month correctly", () => {
    expect(spanInDays(new Date(2026, 0, 1), new Date(2026, 0, 31))).toBe(31);
  });

  it("counts across a year boundary", () => {
    expect(spanInDays(new Date(2025, 11, 30), new Date(2026, 0, 2))).toBe(4);
  });
});

// ── People ───────────────────────────────────────────────────────────────────

describe("departmentOf", () => {
  it("files every job role somewhere", () => {
    for (const role of JOB_ROLES) {
      expect(departmentOf(role), role).toBeTruthy();
      expect(DEPARTMENTS, role).toContain(departmentOf(role));
    }
  });

  it("files an unknown role rather than returning undefined", () => {
    expect(departmentOf("SORCERER")).toBeTruthy();
  });
});

describe("staffName", () => {
  it("joins the two names", () => {
    expect(staffName({ firstName: "Amine", lastName: "Benali" })).toBe(
      "Amine Benali",
    );
  });

  it("does not leave a stray space when one is missing", () => {
    expect(staffName({ firstName: "Amine", lastName: "" })).toBe("Amine");
    expect(staffName({ firstName: "", lastName: "Benali" })).toBe("Benali");
  });
});

describe("employment statuses", () => {
  it("counts as employed only statuses that exist", () => {
    for (const status of EMPLOYED_STATUSES) {
      expect(STAFF_STATUSES).toContain(status);
    }
  });

  it("does not count somebody who has left", () => {
    expect(EMPLOYED_STATUSES).not.toContain("LEFT");
  });
});

describe("salary statuses", () => {
  it("lets only a declared status be paid", () => {
    for (const status of PAYABLE_SALARY_STATUSES) {
      expect(status).toBeTruthy();
    }
    expect(PAYABLE_SALARY_STATUSES).not.toContain("PAID");
  });
});
