import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAY_SESSIONS,
  EXCEPTION_KINDS,
  MAX_LESSON_SPAN,
  SCHEDULE_KINDS,
  SCHOOL_WEEK_PARITIES,
  TEACHING_DAYS,
  WEEK_PARITIES,
  addMinutesToTime,
  bookingKeyOf,
  formatDuration,
  isTimeOfDay,
  minutesSinceMidnight,
  parityOverlaps,
  periodsForMinutes,
  planSchoolWeeks,
  runsInWeek,
  runsInWeekNumber,
  slotsOverlap,
  weekWindowsOverlap,
} from "@/modules/timetable/enums";
import {
  addDays,
  atMidnight,
  currentSchoolWeek,
  dateOfWeekday,
  daysOverlapping,
  isSameDay,
  isWithin,
  resolveWeek,
  schoolWeeks,
  startOfWeek,
  toDateKey,
} from "@/modules/timetable/weeks";

/**
 * L'emploi du temps: the grid, and the four things it must never say.
 *
 *   1. a class cannot be in two places at once
 *   2. a teacher cannot be in two rooms at once
 *   3. a room cannot host two classes at once
 *   4. a teacher cannot be booked in a period they do not work
 *
 * Only the first is a property of one row, and the unique index on `bookingKey`
 * enforces it. The other three span rows no constraint can see, so they are
 * checked in code — and, since this audit, inside the transaction that writes,
 * because a check that ran before the transaction opened was not a rule under
 * two people building the grid at once.
 *
 * The rest of what is tested here is the arithmetic every one of those rules
 * stands on: which weeks two lessons share, which half of the rotation each
 * runs in, and how a school year is cut into numbered weeks in the first place.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: unknown };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};

const EMPTY: Record<string, unknown> = {
  findMany: [],
  count: 0,
  findFirst: null,
  findUnique: null,
  create: {},
  upsert: {},
  deleteMany: { count: 0 },
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
vi.mock("@/lib/school-settings-server", () => ({
  loadSchoolSettings: async () => ({ teachingDays: "1,2,3,4,5,6" }),
}));

const { findClash, saveLessonBlock } = await import(
  "@/modules/timetable/service"
);

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The week rotation ────────────────────────────────────────────────────────

describe("parityOverlaps", () => {
  it("misses the opposite half of the rotation", () => {
    // The whole point of a fortnightly grid: A and B never meet, so the same
    // room can hold two different lessons in the same period.
    expect(parityOverlaps("A", "B")).toBe(false);
    expect(parityOverlaps("B", "A")).toBe(false);
  });

  it("collides with its own half", () => {
    expect(parityOverlaps("A", "A")).toBe(true);
    expect(parityOverlaps("B", "B")).toBe(true);
  });

  it("makes every-week overlap everything, including another every-week", () => {
    // Which is exactly why the unique index cannot decide this on its own: no
    // key can say "ALL is both".
    for (const parity of WEEK_PARITIES) {
      expect(parityOverlaps("ALL", parity), parity).toBe(true);
      expect(parityOverlaps(parity, "ALL"), parity).toBe(true);
    }
  });

  it("reads a missing parity as every week", () => {
    // A null must not make each reader decide for itself what it meant.
    expect(parityOverlaps(null, "A")).toBe(true);
    expect(parityOverlaps(undefined, "B")).toBe(true);
    expect(parityOverlaps(null, null)).toBe(true);
  });

  it("is symmetric for every pair", () => {
    for (const a of WEEK_PARITIES) {
      for (const b of WEEK_PARITIES) {
        expect(parityOverlaps(a, b), `${a}/${b}`).toBe(parityOverlaps(b, a));
      }
    }
  });

  it("offers the rotation only two halves to actually be", () => {
    // A week *is* A or B; a lesson may also be "every week".
    expect([...SCHOOL_WEEK_PARITIES]).toEqual(["A", "B"]);
    expect([...WEEK_PARITIES]).toEqual(["ALL", "A", "B"]);
  });
});

describe("runsInWeek", () => {
  it("runs an every-week lesson in either half", () => {
    expect(runsInWeek("ALL", { parity: "A" })).toBe(true);
    expect(runsInWeek("ALL", { parity: "B" })).toBe(true);
  });

  it("runs a rotation lesson only in its own half", () => {
    expect(runsInWeek("A", { parity: "A" })).toBe(true);
    expect(runsInWeek("A", { parity: "B" })).toBe(false);
  });

  it("runs everything when no week is in play", () => {
    // A printout of the template, say — it shows the whole pattern.
    expect(runsInWeek("A", null)).toBe(true);
    expect(runsInWeek("B", null)).toBe(true);
  });

  it("reads a missing parity as every week", () => {
    expect(runsInWeek(null, { parity: "B" })).toBe(true);
  });
});

describe("weekWindowsOverlap", () => {
  const window = (fromWeek: number | null, toWeek: number | null) => ({
    fromWeek,
    toWeek,
  });

  it("keeps the two halves of a lesson edited mid-year apart", () => {
    // One ending at S11, one starting at S12. Treating them as a clash would
    // make a grid uneditable after the first term — which is the reason this is
    // a function rather than two comparisons.
    expect(weekWindowsOverlap(window(null, 11), window(12, null))).toBe(false);
  });

  it("overlaps when they touch on the same week", () => {
    expect(weekWindowsOverlap(window(null, 12), window(12, null))).toBe(true);
  });

  it("reads two open ends as overlapping, not as unknown", () => {
    // "Since the start" and "until further notice" are both null, and the naive
    // comparison of two nulls says nothing.
    expect(weekWindowsOverlap(window(null, null), window(null, null))).toBe(true);
    expect(weekWindowsOverlap(window(null, null), window(20, 25))).toBe(true);
    expect(weekWindowsOverlap(window(20, 25), window(null, null))).toBe(true);
  });

  it("separates two closed windows that do not meet", () => {
    expect(weekWindowsOverlap(window(1, 10), window(11, 20))).toBe(false);
    expect(weekWindowsOverlap(window(11, 20), window(1, 10))).toBe(false);
  });

  it("overlaps a window wholly inside another", () => {
    expect(weekWindowsOverlap(window(1, 30), window(10, 12))).toBe(true);
  });

  it("is symmetric", () => {
    const windows = [
      window(null, null),
      window(null, 11),
      window(12, null),
      window(5, 15),
      window(16, 20),
    ];
    for (const a of windows) {
      for (const b of windows) {
        expect(
          weekWindowsOverlap(a, b),
          `${JSON.stringify(a)}/${JSON.stringify(b)}`,
        ).toBe(weekWindowsOverlap(b, a));
      }
    }
  });
});

describe("runsInWeekNumber", () => {
  it("counts everything when no week is in play", () => {
    expect(runsInWeekNumber({ fromWeek: 12, toWeek: 20 }, null)).toBe(true);
  });

  it("keeps a lesson out of the weeks before it started", () => {
    // A lesson added while looking at week 12 is not retroactively true of
    // September, and a grid claiming it was would make every register before it
    // wrong.
    expect(runsInWeekNumber({ fromWeek: 12, toWeek: null }, 11)).toBe(false);
    expect(runsInWeekNumber({ fromWeek: 12, toWeek: null }, 12)).toBe(true);
  });

  it("keeps it out of the weeks after it ended", () => {
    expect(runsInWeekNumber({ fromWeek: null, toWeek: 11 }, 12)).toBe(false);
    expect(runsInWeekNumber({ fromWeek: null, toWeek: 11 }, 11)).toBe(true);
  });

  it("runs a one-week lesson in exactly that week", () => {
    // How a one-off swap is recorded without touching the pattern.
    for (const week of [11, 12, 13]) {
      expect(runsInWeekNumber({ fromWeek: 12, toWeek: 12 }, week), String(week))
        .toBe(week === 12);
    }
  });
});

// ── The booking key ──────────────────────────────────────────────────────────

describe("bookingKeyOf", () => {
  it("lets one class hold the same slot in week A and in week B", () => {
    // The parity is in the key, which is what makes a fortnightly grid legal at
    // the index level.
    expect(bookingKeyOf(null, null, "A")).not.toBe(bookingKeyOf(null, null, "B"));
  });

  it("keeps a group's booking apart from the whole class's", () => {
    expect(bookingKeyOf("group-a", null)).not.toBe(bookingKeyOf(null, null));
    expect(bookingKeyOf("group-a", null)).not.toBe(bookingKeyOf("group-b", null));
  });

  it("keeps one semester's grid apart from the other's", () => {
    expect(bookingKeyOf(null, "term-1")).not.toBe(bookingKeyOf(null, "term-2"));
    expect(bookingKeyOf(null, "term-1")).not.toBe(bookingKeyOf(null, null));
  });

  it("keeps two windows of the same lesson apart", () => {
    // The rows before and after a mid-year edit are different bookings, or the
    // upsert would overwrite the history it was meant to keep.
    expect(bookingKeyOf(null, null, "ALL", null, 11)).not.toBe(
      bookingKeyOf(null, null, "ALL", 12, null),
    );
  });

  it("reads a missing parity as every week, so the key is stable", () => {
    expect(bookingKeyOf(null, null)).toBe(bookingKeyOf(null, null, "ALL"));
    expect(bookingKeyOf(null, null, null)).toBe(bookingKeyOf(null, null, "ALL"));
  });

  it("gives the same lesson the same key every time", () => {
    expect(bookingKeyOf("g", "t", "A", 12, 20)).toBe(
      bookingKeyOf("g", "t", "A", 12, 20),
    );
  });

  it("never lets an open end read as week zero", () => {
    expect(bookingKeyOf(null, null, "ALL", null, null)).not.toBe(
      bookingKeyOf(null, null, "ALL", 0, 0),
    );
  });
});

// ── The bell schedule ────────────────────────────────────────────────────────

describe("time of day", () => {
  it("accepts a wall-clock time", () => {
    for (const value of ["00:00", "08:30", "13:45", "23:59"]) {
      expect(isTimeOfDay(value), value).toBe(true);
    }
  });

  it("refuses anything that would break the ordering", () => {
    for (const value of ["", "8:30", "24:00", "08:60", "08:30:00", "0830"]) {
      expect(isTimeOfDay(value), value).toBe(false);
    }
  });

  it("orders by minutes since midnight", () => {
    expect(minutesSinceMidnight("08:30")).toBe(510);
    expect(minutesSinceMidnight("00:00")).toBe(0);
    expect(minutesSinceMidnight("23:59")).toBe(1439);
  });

  it("adds minutes without a date library", () => {
    // A bell schedule never crosses midnight, so integer arithmetic on the
    // stored text is enough.
    expect(addMinutesToTime("08:00", 60)).toBe("09:00");
    expect(addMinutesToTime("08:30", 90)).toBe("10:00");
    expect(addMinutesToTime("08:55", 5)).toBe("09:00");
  });

  it("round-trips through minutes", () => {
    for (const time of ["08:00", "08:30", "12:15", "17:45"]) {
      expect(addMinutesToTime(time, 0), time).toBe(time);
    }
  });
});

describe("slotsOverlap", () => {
  const slot = (startTime: string, endTime: string) => ({ startTime, endTime });

  it("overlaps two periods that share time", () => {
    expect(slotsOverlap(slot("08:00", "09:00"), slot("08:30", "09:30"))).toBe(
      true,
    );
  });

  it("does not overlap periods that merely touch", () => {
    // The 08:00 lesson ends as the 09:00 one begins; a school day is built of
    // exactly these.
    expect(slotsOverlap(slot("08:00", "09:00"), slot("09:00", "10:00"))).toBe(
      false,
    );
  });

  it("does not overlap periods in different halves of the day", () => {
    expect(slotsOverlap(slot("08:00", "09:00"), slot("14:00", "15:00"))).toBe(
      false,
    );
  });

  it("overlaps a period wholly inside another", () => {
    expect(slotsOverlap(slot("08:00", "10:00"), slot("08:30", "09:00"))).toBe(
      true,
    );
  });

  it("is symmetric", () => {
    const a = slot("08:00", "09:00");
    const b = slot("08:30", "09:30");
    expect(slotsOverlap(a, b)).toBe(slotsOverlap(b, a));
  });
});

describe("periodsForMinutes", () => {
  it("turns an hour into two periods of a half-hour bell", () => {
    // The bell rings every 30 minutes so a school can start at 08h30 or 09h30 —
    // the half hour exists to let the day shift, not because anybody teaches
    // for half an hour.
    expect(periodsForMinutes(60, 30)).toBe(2);
    expect(periodsForMinutes(90, 30)).toBe(3);
  });

  it("rounds up, because a lesson has to end when a bell rings", () => {
    // A school whose bell is 45 minutes asking for an hour gets two periods
    // rather than one and a third.
    expect(periodsForMinutes(60, 45)).toBe(2);
  });

  it("never answers fewer than one period", () => {
    expect(periodsForMinutes(0, 30)).toBe(1);
    expect(periodsForMinutes(-60, 30)).toBe(1);
  });

  it("answers one for a bell schedule with no length at all", () => {
    // Rather than dividing by zero and asking the placer to book Infinity
    // periods.
    expect(periodsForMinutes(60, 0)).toBe(1);
    expect(periodsForMinutes(60, -30)).toBe(1);
  });

  it("keeps the longest sensible lesson inside the span limit", () => {
    // Anything longer is a data-entry slip rather than a lesson.
    expect(periodsForMinutes(120, 30)).toBeLessThanOrEqual(MAX_LESSON_SPAN);
  });
});

describe("formatDuration", () => {
  it("writes a lesson the way a head of studies says it", () => {
    expect(formatDuration(30)).toBe("30min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(120)).toBe("2h");
  });

  it("pads the minutes, so 2h05 does not read as 2h5", () => {
    expect(formatDuration(125)).toBe("2h05");
  });
});

// ── The year's weeks ─────────────────────────────────────────────────────────

describe("startOfWeek", () => {
  it("takes the Monday of the week", () => {
    // 15 January 2026 is a Thursday.
    expect(startOfWeek(new Date(2026, 0, 15)).getDate()).toBe(12);
  });

  it("puts Sunday in the week that has just finished", () => {
    // Which is how a school reads a timetable printed on the Friday. 18 January
    // 2026 is a Sunday; its Monday is the 12th, not the 19th.
    expect(startOfWeek(new Date(2026, 0, 18)).getDate()).toBe(12);
  });

  it("leaves a Monday where it is", () => {
    expect(startOfWeek(new Date(2026, 0, 12)).getDate()).toBe(12);
  });

  it("drops the time of day, so a week key never depends on it", () => {
    const morning = startOfWeek(new Date(2026, 0, 15, 8, 30));
    const evening = startOfWeek(new Date(2026, 0, 15, 23, 45));
    expect(morning.getTime()).toBe(evening.getTime());
    expect(morning.getHours()).toBe(0);
  });
});

describe("schoolWeeks", () => {
  const year = () => schoolWeeks(new Date(2025, 8, 3), new Date(2026, 5, 30));

  it("counts the opening week whole, even when the year starts mid-week", () => {
    // 3 September 2025 is a Wednesday. The timetable for that week exists and
    // the pupils were there.
    const weeks = year();
    expect(weeks[0]!.index).toBe(1);
    expect(weeks[0]!.start.getDay()).toBe(1);
    expect(weeks[0]!.start.getDate()).toBe(1);
  });

  it("numbers the weeks from one, without gaps", () => {
    const weeks = year();
    expect(weeks.map((week) => week.index)).toEqual(
      weeks.map((_, position) => position + 1),
    );
  });

  it("makes each week seven days long", () => {
    for (const week of year()) {
      expect(daysOverlapping(week, week.start, week.end)).toBe(7);
    }
  });

  it("runs Monday to Sunday", () => {
    for (const week of year()) {
      expect(week.start.getDay()).toBe(1);
      expect(week.end.getDay()).toBe(0);
    }
  });

  it("answers nothing for a year that ends before it starts", () => {
    expect(schoolWeeks(new Date(2026, 5, 30), new Date(2025, 8, 3))).toEqual([]);
  });

  it("bounds itself rather than building a decade of weeks", () => {
    // A year mis-entered as spanning ten years would otherwise build sixty
    // thousand objects before anybody noticed.
    expect(
      schoolWeeks(new Date(2020, 0, 1), new Date(2030, 0, 1)).length,
    ).toBeLessThanOrEqual(80);
  });

  it("gives a one-day year a single week", () => {
    expect(schoolWeeks(new Date(2025, 8, 3), new Date(2025, 8, 3))).toHaveLength(
      1,
    );
  });
});

describe("currentSchoolWeek", () => {
  const weeks = schoolWeeks(new Date(2025, 8, 1), new Date(2026, 5, 30));

  it("takes today's week when today is in the year", () => {
    const week = currentSchoolWeek(weeks, new Date(2026, 0, 15));
    expect(week!.start.getTime()).toBeLessThanOrEqual(
      new Date(2026, 0, 15).getTime(),
    );
    expect(week!.end.getTime()).toBeGreaterThanOrEqual(
      new Date(2026, 0, 15).getTime(),
    );
  });

  it("clamps to the first week before the year has begun", () => {
    // Never null for a year that has weeks: "no week" is not something the
    // screen can render.
    expect(currentSchoolWeek(weeks, new Date(2025, 6, 1))).toEqual(weeks[0]);
  });

  it("clamps to the last week after it has ended", () => {
    // The application is used in August too — enrolling for September, closing
    // the books — and a grid dated outside the school's own calendar is the bug
    // this exists to prevent.
    expect(currentSchoolWeek(weeks, new Date(2026, 7, 1))).toEqual(
      weeks[weeks.length - 1],
    );
  });

  it("answers nothing for a year with no weeks at all", () => {
    expect(currentSchoolWeek([], new Date())).toBeNull();
  });
});

describe("resolveWeek", () => {
  const weeks = schoolWeeks(new Date(2025, 8, 1), new Date(2026, 5, 30));

  it("takes the week the URL asked for", () => {
    expect(resolveWeek(weeks, "12")!.index).toBe(12);
  });

  it("falls back for a week the year does not have", () => {
    // A stale bookmark, a hand-typed URL, a link from last year — none of them
    // should draw a grid for a week the school does not have.
    for (const param of ["999", "0", "-3", "abc", "1.5", ""]) {
      const week = resolveWeek(weeks, param, new Date(2026, 0, 15));
      expect(weeks, param).toContain(week);
    }
  });

  it("falls back when nothing was asked for", () => {
    expect(resolveWeek(weeks, undefined, new Date(2026, 0, 15))).toEqual(
      currentSchoolWeek(weeks, new Date(2026, 0, 15)),
    );
  });
});

describe("planSchoolWeeks", () => {
  const plan = (holidays: { startDate: Date; endDate: Date }[] = []) =>
    planSchoolWeeks({
      yearStart: new Date(2025, 8, 1),
      yearEnd: new Date(2026, 5, 30),
      holidays,
    });

  it("alternates the rotation across taught weeks", () => {
    const weeks = plan();
    expect(weeks[0]!.parity).toBe("A");
    expect(weeks[1]!.parity).toBe("B");
    expect(weeks[2]!.parity).toBe("A");
  });

  it("does not advance the rotation across a holiday", () => {
    // A fortnight of vacances must not silently swap which half comes back —
    // exactly the mistake a school makes doing this on paper.
    const weeks = plan([
      { startDate: new Date(2025, 8, 8), endDate: new Date(2025, 8, 14) },
    ]);

    expect(weeks[0]!.parity).toBe("A");
    expect(weeks[1]!.isTeaching).toBe(false);
    // The holiday week carries the parity the next taught week will use, so
    // reading down the column never jumps.
    expect(weeks[1]!.parity).toBe("B");
    expect(weeks[2]!.parity).toBe("B");
  });

  it("still teaches a week a holiday only clips", () => {
    // "No lessons at all" and "Monday off" are different weeks.
    const weeks = plan([
      { startDate: new Date(2025, 8, 8), endDate: new Date(2025, 8, 9) },
    ]);
    expect(weeks[1]!.isTeaching).toBe(true);
  });

  it("does not let Sunday rescue a week that is otherwise all holiday", () => {
    // Monday to Saturday: Sunday is never taught.
    const weeks = plan([
      { startDate: new Date(2025, 8, 8), endDate: new Date(2025, 8, 13) },
    ]);
    expect(weeks[1]!.isTeaching).toBe(false);
  });

  it("takes the first parity it is given", () => {
    const weeks = planSchoolWeeks({
      yearStart: new Date(2025, 8, 1),
      yearEnd: new Date(2026, 5, 30),
      holidays: [],
      firstParity: "B",
    });
    expect(weeks[0]!.parity).toBe("B");
    expect(weeks[1]!.parity).toBe("A");
  });

  it("numbers its weeks the same way the picker does", () => {
    // Numbering only the taught weeks was tried, and made "semaine 12" mean two
    // different fortnights depending on which screen you read.
    const planned = plan([
      { startDate: new Date(2025, 8, 8), endDate: new Date(2025, 8, 14) },
    ]);
    const picker = schoolWeeks(new Date(2025, 8, 1), new Date(2026, 5, 30));

    expect(planned.map((week) => week.number)).toEqual(
      picker.map((week) => week.index),
    );
    expect(planned[5]!.startsOn.getTime()).toBe(picker[5]!.start.getTime());
  });

  it("never gives a week a parity outside the rotation", () => {
    for (const week of plan()) {
      expect(SCHOOL_WEEK_PARITIES, String(week.number)).toContain(week.parity);
    }
  });
});

describe("the week helpers", () => {
  it("compares whole days, whatever the time part", () => {
    expect(isSameDay(new Date(2026, 0, 15, 8), new Date(2026, 0, 15, 23))).toBe(
      true,
    );
    expect(isSameDay(new Date(2026, 0, 15), new Date(2026, 0, 16))).toBe(false);
  });

  it("reads an inclusive range at both ends", () => {
    const start = new Date(2026, 0, 12);
    const end = new Date(2026, 0, 18);
    expect(isWithin(start, start, end)).toBe(true);
    expect(isWithin(end, start, end)).toBe(true);
    expect(isWithin(new Date(2026, 0, 11), start, end)).toBe(false);
    expect(isWithin(new Date(2026, 0, 19), start, end)).toBe(false);
  });

  it("counts the days a holiday clips off a week", () => {
    const [week] = schoolWeeks(new Date(2026, 0, 12), new Date(2026, 0, 18));
    expect(daysOverlapping(week!, new Date(2026, 0, 12), new Date(2026, 0, 13)))
      .toBe(2);
    expect(daysOverlapping(week!, new Date(2026, 0, 1), new Date(2026, 0, 5)))
      .toBe(0);
  });

  it("counts a holiday spanning the whole week as seven days", () => {
    const [week] = schoolWeeks(new Date(2026, 0, 12), new Date(2026, 0, 18));
    expect(
      daysOverlapping(week!, new Date(2025, 11, 1), new Date(2026, 1, 1)),
    ).toBe(7);
  });

  it("writes a date key that survives a URL", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    // Local, not UTC: Morocco is ahead of UTC, and a key read in the wrong
    // frame would file a Monday under the Sunday before it.
    expect(toDateKey(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
  });

  it("finds the date an ISO weekday falls on", () => {
    const [week] = schoolWeeks(new Date(2026, 0, 12), new Date(2026, 0, 18));
    expect(dateOfWeekday(week!, 1).getDate()).toBe(12);
    expect(dateOfWeekday(week!, 6).getDate()).toBe(17);
  });

  it("steps days across a month boundary", () => {
    expect(addDays(new Date(2026, 0, 31), 1).getMonth()).toBe(1);
    expect(atMidnight(new Date(2026, 0, 31, 18)).getHours()).toBe(0);
  });
});

describe("the declared sets", () => {
  it("offers every day of the week and never a zero", () => {
    // All seven, so a school can declare whatever week it runs — Sunday
    // included. Which days it actually teaches is its own setting, and Monday
    // to Saturday is only the default. ISO numbering, so there is no day 0.
    expect([...TEACHING_DAYS]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(TEACHING_DAYS).not.toContain(0);
  });

  it("keeps a Ramadan bell schedule beside the standard one", () => {
    // Rather than rewriting the grid twice a year.
    expect([...SCHEDULE_KINDS]).toEqual(["STANDARD", "RAMADAN"]);
  });

  it("splits the day into the two halves the rules key off", () => {
    expect([...DAY_SESSIONS]).toEqual(["MORNING", "AFTERNOON"]);
  });

  it("gives a one-off change two shapes and no more", () => {
    // "Moved" is a cancellation here and a replacement there; one row for both
    // would tie two cells together that a user then cannot edit apart.
    expect([...EXCEPTION_KINDS]).toEqual(["CANCELLED", "REPLACED"]);
  });
});

// ── The clash rules ──────────────────────────────────────────────────────────

const entry = (extra: Record<string, unknown> = {}) => ({
  teacherId: null as string | null,
  roomId: null as string | null,
  schoolClassId: "class-1",
  classGroupId: null as string | null,
  weekParity: "ALL",
  fromWeek: null as number | null,
  toWeek: null as number | null,
  timeSlot: { dayOfWeek: 1, startTime: "08:00" },
  schoolClass: { code: "3AP-A" },
  ...extra,
});

const incoming = (extra: Record<string, unknown> = {}) => ({
  timeSlotId: "slot-1",
  schoolClassId: "class-2",
  teacherId: null as string | null,
  roomId: null as string | null,
  classGroupId: null as string | null,
  termId: null as string | null,
  weekParity: "ALL",
  fromWeek: null as number | null,
  toWeek: null as number | null,
  ...extra,
}) as Parameters<typeof findClash>[0];

const booked = (entries: ReturnType<typeof entry>[]) => {
  answers = { "timetableEntry.findMany": entries };
};

describe("findClash", () => {
  it("finds nothing in an empty period", async () => {
    expect(await findClash(incoming())).toBeNull();
  });

  // ── Rule 4, checked first ──────────────────────────────────────────────────

  it("says a teacher does not work this period before saying they are busy", async () => {
    // A different sentence from naming the class they are already with, and the
    // one a grid-builder needs first.
    answers = {
      "teacherUnavailability.findUnique": {
        reason: "Mercredi après-midi",
        timeSlot: { startTime: "14:00" },
      },
    };

    expect(await findClash(incoming({ teacherId: "teacher-1" }))).toEqual({
      kind: "UNAVAILABLE",
      className: "Mercredi après-midi",
      slotLabel: "14:00",
    });
    // Answered without even reading the bookings.
    expect(of("timetableEntry", "findMany")).toEqual([]);
  });

  it("carries the reason back, when one was given", async () => {
    answers = {
      "teacherUnavailability.findUnique": {
        reason: null,
        timeSlot: { startTime: "14:00" },
      },
    };
    const clash = await findClash(incoming({ teacherId: "teacher-1" }));
    expect(clash).toMatchObject({ kind: "UNAVAILABLE", className: "" });
  });

  it("does not ask about availability when no teacher is named", async () => {
    await findClash(incoming());
    expect(of("teacherUnavailability", "findUnique")).toEqual([]);
  });

  // ── Rule 1: the class ──────────────────────────────────────────────────────

  it("refuses to sit a class down twice in one period", async () => {
    booked([entry({ schoolClassId: "class-2" })]);
    expect(await findClash(incoming())).toMatchObject({ kind: "CLASS" });
  });

  it("lets two halves of a split class share a period", async () => {
    // A language or lab subject taught in halves is exactly this.
    booked([entry({ schoolClassId: "class-2", classGroupId: "group-a" })]);
    expect(
      await findClash(incoming({ classGroupId: "group-b" })),
    ).toBeNull();
  });

  it("refuses the same half twice", async () => {
    booked([entry({ schoolClassId: "class-2", classGroupId: "group-a" })]);
    expect(
      await findClash(incoming({ classGroupId: "group-a" })),
    ).toMatchObject({ kind: "CLASS" });
  });

  it("refuses the whole class over one of its own groups", async () => {
    // The whole class may not share a period with anybody, including half of
    // itself.
    booked([entry({ schoolClassId: "class-2", classGroupId: "group-a" })]);
    expect(await findClash(incoming({ classGroupId: null }))).toMatchObject({
      kind: "CLASS",
    });
  });

  it("refuses a group over the whole class", async () => {
    booked([entry({ schoolClassId: "class-2", classGroupId: null })]);
    expect(
      await findClash(incoming({ classGroupId: "group-a" })),
    ).toMatchObject({ kind: "CLASS" });
  });

  // ── Rule 2: the teacher ────────────────────────────────────────────────────

  it("refuses to put a teacher in two rooms at once", async () => {
    booked([entry({ teacherId: "teacher-1" })]);
    expect(
      await findClash(incoming({ teacherId: "teacher-1" })),
    ).toMatchObject({ kind: "TEACHER", className: "3AP-A" });
  });

  it("names the class the teacher is already with", async () => {
    // "M. Bennis est avec 3AP-A à 08:00" is a sentence somebody can act on.
    booked([entry({ teacherId: "teacher-1" })]);
    const clash = await findClash(incoming({ teacherId: "teacher-1" }));
    expect(clash).toEqual({
      kind: "TEACHER",
      className: "3AP-A",
      slotLabel: "08:00",
    });
  });

  it("lets a different teacher take the period", async () => {
    booked([entry({ teacherId: "teacher-1" })]);
    expect(await findClash(incoming({ teacherId: "teacher-2" }))).toBeNull();
  });

  it("does not clash a lesson with no teacher against one that has none", async () => {
    // Two unstaffed lessons in one period are a gap to fill, not a conflict.
    booked([entry({ teacherId: null })]);
    expect(await findClash(incoming({ teacherId: null }))).toBeNull();
  });

  // ── Rule 3: the room ───────────────────────────────────────────────────────

  it("refuses to put two classes in one room", async () => {
    booked([entry({ roomId: "room-1" })]);
    expect(await findClash(incoming({ roomId: "room-1" }))).toMatchObject({
      kind: "ROOM",
    });
  });

  it("does not clash two lessons that book no room", async () => {
    booked([entry({ roomId: null })]);
    expect(await findClash(incoming({ roomId: null }))).toBeNull();
  });

  // ── The rotation, and the weeks ────────────────────────────────────────────

  it("lets opposite halves of the rotation share everything", async () => {
    // Same teacher, same room, same period — and no clash, because they never
    // happen in the same week.
    booked([entry({ teacherId: "teacher-1", roomId: "room-1", weekParity: "A" })]);
    expect(
      await findClash(
        incoming({ teacherId: "teacher-1", roomId: "room-1", weekParity: "B" }),
      ),
    ).toBeNull();
  });

  it("clashes an every-week lesson against either half", async () => {
    for (const parity of ["A", "B"]) {
      calls.length = 0;
      booked([entry({ teacherId: "teacher-1", weekParity: parity })]);
      expect(
        await findClash(incoming({ teacherId: "teacher-1", weekParity: "ALL" })),
        parity,
      ).toMatchObject({ kind: "TEACHER" });
    }
  });

  it("lets the two halves of a lesson edited mid-year past each other", async () => {
    // One closed at S11, one starting at S12. Treating them as a clash would
    // make a grid uneditable after the first term.
    booked([entry({ teacherId: "teacher-1", fromWeek: null, toWeek: 11 })]);
    expect(
      await findClash(
        incoming({ teacherId: "teacher-1", fromWeek: 12, toWeek: null }),
      ),
    ).toBeNull();
  });

  it("clashes two windows that share a week", async () => {
    booked([entry({ teacherId: "teacher-1", fromWeek: null, toWeek: 12 })]);
    expect(
      await findClash(
        incoming({ teacherId: "teacher-1", fromWeek: 12, toWeek: null }),
      ),
    ).toMatchObject({ kind: "TEACHER" });
  });

  // ── The semester ───────────────────────────────────────────────────────────

  it("lets an all-year booking see every row", async () => {
    // A grid laid over a semester lesson nobody was warned about is the failure
    // this avoids, so the term filter only narrows when the *incoming* lesson
    // has a term of its own.
    await findClash(incoming({ termId: null }));
    const where = (of("timetableEntry", "findMany")[0]!.args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("OR");
  });

  it("narrows a semester lesson to its own term and the all-year rows", async () => {
    await findClash(incoming({ termId: "term-1" }));
    expect(of("timetableEntry", "findMany")[0]!.args).toMatchObject({
      where: { OR: [{ termId: null }, { termId: "term-1" }] },
    });
  });

  // ── The rows being edited ──────────────────────────────────────────────────

  it("does not clash a lesson with itself", async () => {
    await findClash(incoming({ exceptEntryIds: ["entry-1", "entry-2"] }));
    expect(of("timetableEntry", "findMany")[0]!.args).toMatchObject({
      where: { NOT: { id: { in: ["entry-1", "entry-2"] } } },
    });
  });

  it("excludes nothing when nothing is being edited", async () => {
    await findClash(incoming());
    const where = (of("timetableEntry", "findMany")[0]!.args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("NOT");
  });

  // ── The order the answers come in ──────────────────────────────────────────

  it("names the class before the teacher when both would collide", async () => {
    // The order a grid-builder wants to hear them: the class being already sat
    // down is the more basic fact.
    booked([entry({ schoolClassId: "class-2", teacherId: "teacher-1" })]);
    expect(
      await findClash(incoming({ teacherId: "teacher-1" })),
    ).toMatchObject({ kind: "CLASS" });
  });

  it("names the teacher before the room", async () => {
    booked([entry({ teacherId: "teacher-1", roomId: "room-1" })]);
    expect(
      await findClash(incoming({ teacherId: "teacher-1", roomId: "room-1" })),
    ).toMatchObject({ kind: "TEACHER" });
  });
});

// ── The write ────────────────────────────────────────────────────────────────

const block = (extra: Record<string, unknown> = {}) => ({
  schoolClassId: "class-2",
  timeSlotIds: ["slot-1", "slot-2"],
  subjectId: "maths",
  teacherId: "teacher-1" as string | null,
  roomId: "room-1" as string | null,
  classGroupId: null as string | null,
  termId: null as string | null,
  weekParity: "ALL",
  fromWeek: null as number | null,
  toWeek: null as number | null,
  ...extra,
}) as Parameters<typeof saveLessonBlock>[0];

describe("saveLessonBlock", () => {
  it("writes one row per period, not one row with a span", async () => {
    // A `spanSlots` column would leave the second hour unbooked as far as the
    // database is concerned, and a class could be double-booked into it without
    // anything noticing.
    const result = await saveLessonBlock(block());

    expect(result).toEqual({ ok: true, written: 2 });
    expect(of("timetableEntry", "upsert")).toHaveLength(2);
  });

  it("stamps the same booking key on every row of the block", async () => {
    await saveLessonBlock(block({ classGroupId: "group-a", termId: "term-1" }));

    const keys = of("timetableEntry", "upsert").map(
      (call) => (call.args as { create: { bookingKey: string } }).create.bookingKey,
    );
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(bookingKeyOf("group-a", "term-1", "ALL", null, null));
  });

  it("checks the clash rules again inside the transaction it writes in", async () => {
    // The bug this closes. Rules 2 and 3 have no constraint behind them, and
    // they used to be checked only in the action, before this transaction
    // opened — so two people building the grid in September, which is exactly
    // when two people build the grid, could both pass and both write.
    booked([entry({ teacherId: "teacher-1" })]);

    const result = await saveLessonBlock(block());
    expect(result).toMatchObject({ ok: false, clash: { kind: "TEACHER" } });
    expect(of("timetableEntry", "upsert")).toEqual([]);
  });

  it("refuses a room taken between the dialog's check and the write", async () => {
    booked([entry({ roomId: "room-1", teacherId: "teacher-9" })]);

    const result = await saveLessonBlock(block());
    expect(result).toMatchObject({ ok: false, clash: { kind: "ROOM" } });
    expect(of("timetableEntry", "upsert")).toEqual([]);
  });

  it("checks every period of the block before writing any of it", async () => {
    // A block is placed whole or not at all: half a double period, with the
    // second hour silently dropped, is worse than a refusal somebody can read.
    booked([entry({ teacherId: "teacher-1" })]);
    await saveLessonBlock(block());

    expect(of("timetableEntry", "findMany")).toHaveLength(1);
    expect(of("timetableEntry", "upsert")).toEqual([]);
  });

  it("clears the rows it replaces before checking, so a lesson may move onto itself", async () => {
    await saveLessonBlock(block(), ["old-1", "old-2"]);

    expect(of("timetableEntry", "deleteMany")[0]!.args).toMatchObject({
      where: { id: { in: ["old-1", "old-2"] } },
    });
    // And the check excludes them too, in case the delete has not landed.
    expect(of("timetableEntry", "findMany")[0]!.args).toMatchObject({
      where: { NOT: { id: { in: ["old-1", "old-2"] } } },
    });
  });

  it("deletes nothing when there is nothing to replace", async () => {
    await saveLessonBlock(block());
    expect(of("timetableEntry", "deleteMany")).toEqual([]);
  });

  it("upserts rather than creates, so re-placing a lesson moves it", async () => {
    // A repeat across days may land on a slot this class already fills with the
    // very lesson being edited.
    await saveLessonBlock(block());

    const call = of("timetableEntry", "upsert")[0]!.args as {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(call.where).toHaveProperty("schoolClassId_timeSlotId_bookingKey");
    // The update must not restate the key it matched on, or the row could walk.
    expect(call.update).not.toHaveProperty("bookingKey");
    expect(call.create).toHaveProperty("bookingKey");
  });

  it("writes the same lesson to both halves of a block", async () => {
    await saveLessonBlock(block());
    const created = of("timetableEntry", "upsert").map(
      (call) => (call.args as { create: Record<string, unknown> }).create,
    );
    expect(created.map((row) => row["timeSlotId"])).toEqual(["slot-1", "slot-2"]);
    for (const row of created) {
      expect(row["subjectId"]).toBe("maths");
      expect(row["teacherId"]).toBe("teacher-1");
    }
  });
});
