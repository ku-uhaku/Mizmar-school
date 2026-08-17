import { describe, expect, it } from "vitest";

import { PERIODS, parsePeriod, periodRange, type Period } from "@/lib/period";

/**
 * The windows the caisse's tiles and the dashboard's finance card are read
 * over.
 *
 * Pinned here for one reason, which was a real bug: **the four controls are
 * nested.** Anything "jour" counts, "semaine", "mois" and "année" must count
 * too. The year used to be exactly the school year's teaching dates, so on any
 * day of the summer — when a school is taking the frais d'inscription for
 * September — a receipt written today showed under "jour" and disappeared under
 * "année". The wider control printed the smaller number, which reads as money
 * gone missing.
 */

const year = {
  startDate: new Date(2026, 8, 1), // 1 September 2026
  endDate: new Date(2027, 5, 30), // 30 June 2027
};

const contains = (
  outer: { from: Date; to: Date },
  inner: { from: Date; to: Date },
): boolean => outer.from <= inner.from && outer.to >= inner.to;

describe("parsePeriod", () => {
  it("accepts the four known periods", () => {
    for (const period of PERIODS) expect(parsePeriod(period)).toBe(period);
  });

  it("falls back to the day for anything else", () => {
    for (const value of [undefined, "", "decade", ["week"]])
      expect(parsePeriod(value)).toBe("day");
  });
});

describe("periodRange", () => {
  it("is half-open, so a movement at the last instant belongs to one window", () => {
    const day = periodRange("day", new Date(2026, 7, 17, 22, 30));
    expect(day.from).toEqual(new Date(2026, 7, 17));
    expect(day.to).toEqual(new Date(2026, 7, 18));
  });

  it("counts a Sunday into the week that has just finished", () => {
    // Sunday 23 August 2026 → the week that opened on Monday the 17th.
    const week = periodRange("week", new Date(2026, 7, 23, 9, 0));
    expect(week.from).toEqual(new Date(2026, 7, 17));
    expect(week.to).toEqual(new Date(2026, 7, 24));
  });

  it("reads the year over the school year, not the calendar one", () => {
    const range = periodRange("year", new Date(2026, 9, 12), year, [year]);
    expect(range.from).toEqual(new Date(2026, 8, 1));
    // The stated end is inclusive, so the exclusive bound is the day after.
    expect(range.to).toEqual(new Date(2027, 6, 1));
  });

  it("falls back to the calendar year with no school year in context", () => {
    const range = periodRange("year", new Date(2026, 7, 17), null);
    expect(range.from).toEqual(new Date(2026, 0, 1));
    expect(range.to).toEqual(new Date(2027, 0, 1));
  });

  // The bug: 17 August 2026 sits before the year it is being spent on opens.
  it("covers a receipt taken in the summer, before the year opens", () => {
    const now = new Date(2026, 7, 17);
    const range = periodRange("year", now, year, [year]);
    expect(range.from <= now).toBe(true);
    expect(range.to > now).toBe(true);
  });

  it("covers a receipt taken after the year has closed", () => {
    const now = new Date(2027, 6, 20); // 20 July 2027
    const range = periodRange("year", now, year, [year]);
    expect(range.from <= now).toBe(true);
    expect(range.to > now).toBe(true);
  });

  it("reaches back to the morning after the previous year closed", () => {
    const previous = {
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2026, 5, 30), // closed 30 June 2026
    };
    const range = periodRange("year", new Date(2026, 7, 17), year, [
      previous,
      year,
    ]);
    expect(range.from).toEqual(new Date(2026, 6, 1)); // 1 July 2026
  });

  it("never overlaps the previous year, so nothing is counted twice", () => {
    const previous = {
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2026, 5, 30),
    };
    const current = periodRange("year", new Date(2026, 9, 12), year, [
      previous,
      year,
    ]);
    const earlier = periodRange("year", new Date(2026, 2, 10), previous, [
      previous,
      year,
    ]);
    expect(earlier.to <= current.from).toBe(true);
  });

  // The invariant, over every day of a whole year rather than the handful of
  // dates somebody thought to write down.
  it("keeps the year a superset of the day, the week and the month", () => {
    const narrower: Period[] = ["day", "week", "month"];
    for (let offset = 0; offset < 400; offset += 1) {
      const now = new Date(2026, 6, 1 + offset);
      const yearRange = periodRange("year", now, year, [year]);
      for (const period of narrower) {
        expect(
          contains(yearRange, periodRange(period, now)),
          `${period} on ${now.toDateString()} escapes the year`,
        ).toBe(true);
      }
    }
  });
});
