import { describe, expect, it } from "vitest";

import {
  generateTimetable,
  minutesToCover,
  SLACK_MINUTES,
  type GeneratorDemand,
  type GeneratorInput,
  type GeneratorSlot,
} from "@/modules/timetable/generator";

/**
 * The placer counts minutes, not periods, because a school's slots are not all
 * the same length — 1h30 on Monday to Thursday and 1h on Friday is an ordinary
 * week. Every case here is a bell the old period arithmetic got wrong.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** Back-to-back slots of `length` minutes, `count` of them, from `start`. */
function day(
  dayOfWeek: number,
  start: number,
  length: number,
  count: number,
): GeneratorSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `d${dayOfWeek}-${index}`,
    dayOfWeek,
    startTime: clock(start + index * length),
    endTime: clock(start + (index + 1) * length),
    session: "MORNING",
    minutes: length,
  }));
}

function demand(over: Partial<GeneratorDemand> = {}): GeneratorDemand {
  return {
    schoolClassId: "c1",
    subjectId: "maths",
    classGroupId: null,
    candidateTeachers: ["t1"],
    teacherWasAssigned: true,
    homeRoomId: null,
    requiresLab: false,
    classSize: 0,
    minutes: 60,
    blockMinutes: 0,
    maxMinutesPerDay: 240,
    ...over,
  };
}

function input(
  slots: GeneratorSlot[],
  demands: GeneratorDemand[],
  over: Partial<GeneratorInput> = {},
): GeneratorInput {
  return {
    slots,
    demands,
    rooms: [],
    busyTeacher: {},
    busyRoom: {},
    busyClass: {},
    unavailableTeacher: {},
    teacherCapacity: {},
    teacherLoad: {},
    classCapacity: 0,
    classLoad: {},
    labRoomKinds: [],
    seed: 42,
    ...over,
  };
}

const minutesOf = (placements: { minutes: number }[]) =>
  placements.reduce((sum, placement) => sum + placement.minutes, 0);

describe("minutesToCover", () => {
  it("never asks for less than one slack, so a declared subject is not dropped", () => {
    expect(minutesToCover(5)).toBe(SLACK_MINUTES);
    expect(minutesToCover(90)).toBe(90);
  });
});

describe("generateTimetable on uniform slots", () => {
  const week = [1, 2, 3, 4, 5].flatMap((d) => day(d, 480, 60, 4));

  it("places exactly the hours asked for", () => {
    const result = generateTimetable(input(week, [demand({ minutes: 240 })]));

    expect(result.shortfalls).toEqual([]);
    expect(result.placedMinutes).toBe(240);
    expect(result.overshootMinutes).toBe(0);
    expect(minutesOf(result.placements)).toBe(240);
  });

  it("keeps a subject off one day beyond the daily limit", () => {
    const result = generateTimetable(
      input(week, [demand({ minutes: 300, maxMinutesPerDay: 60 })]),
    );

    const perDay = new Map<number, number>();
    for (const placement of result.placements) {
      const slot = week.find((s) => s.id === placement.timeSlotIds[0])!;
      perDay.set(slot.dayOfWeek, (perDay.get(slot.dayOfWeek) ?? 0) + placement.minutes);
    }
    for (const total of perDay.values()) expect(total).toBeLessThanOrEqual(60);
  });
});

describe("generateTimetable on a mixed week", () => {
  // Monday to Thursday: two 1h30 slots. Friday: two 1h slots.
  const week = [
    ...[1, 2, 3, 4].flatMap((d) => day(d, 480, 90, 2)),
    ...day(5, 480, 60, 2),
  ];

  it("covers a 3h subject with real slot lengths, not a count of periods", () => {
    const result = generateTimetable(input(week, [demand({ minutes: 180 })]));

    expect(result.shortfalls).toEqual([]);
    expect(minutesOf(result.placements)).toBeGreaterThanOrEqual(180 - SLACK_MINUTES);
    expect(result.placedMinutes).toBe(180);
  });

  it("gives a 1h subject the Friday-length slot rather than overshooting", () => {
    // Only one Friday slot is on offer, alongside 90-minute ones — a period
    // count would have had no way to tell them apart.
    const slots = [...day(1, 480, 90, 1), ...day(5, 480, 60, 1)];
    const result = generateTimetable(input(slots, [demand({ minutes: 60 })]));

    expect(result.overshootMinutes).toBe(0);
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].minutes).toBe(60);
  });

  it("fills a whole mixed week without ever booking a class twice", () => {
    const subjects = ["a", "b", "c", "d"].map((subjectId) =>
      demand({ subjectId, minutes: 180, candidateTeachers: [`t-${subjectId}`] }),
    );
    const result = generateTimetable(input(week, subjects));

    const seen = new Set<string>();
    for (const placement of result.placements) {
      for (const id of placement.timeSlotIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });
});

describe("generateTimetable on 45-minute slots", () => {
  const week = [1, 2, 3, 4, 5].flatMap((d) => day(d, 480, 45, 4));

  it("meets 90 minutes with two slots", () => {
    const result = generateTimetable(input(week, [demand({ minutes: 90 })]));
    expect(result.placedMinutes).toBe(90);
    expect(minutesOf(result.placements)).toBe(90);
    expect(result.shortfalls).toEqual([]);
  });

  it("meets 135 minutes with three", () => {
    const result = generateTimetable(input(week, [demand({ minutes: 135 })]));
    expect(minutesOf(result.placements)).toBe(135);
    expect(result.overshootMinutes).toBe(0);
  });
});

describe("overshoot and slack", () => {
  const ninety = day(1, 480, 90, 3);

  it("treats a shortfall within the slack as complete", () => {
    const result = generateTimetable(input(ninety, [demand({ minutes: 105 })]));
    expect(result.shortfalls).toEqual([]);
    expect(result.overshootMinutes).toBe(0);
    expect(minutesOf(result.placements)).toBe(90);
  });

  it("reports the overrun when the slots cannot divide the programme", () => {
    const result = generateTimetable(input(ninety, [demand({ minutes: 120 })]));
    expect(result.shortfalls).toEqual([]);
    expect(minutesOf(result.placements)).toBe(180);
    expect(result.overshootMinutes).toBe(60);
  });
});

describe("blockMinutes", () => {
  const monday = day(1, 480, 90, 2);

  it("joins consecutive slots into one lesson when the block allows it", () => {
    const result = generateTimetable(
      input(monday, [demand({ minutes: 180, blockMinutes: 180 })]),
    );
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].timeSlotIds).toHaveLength(2);
    expect(result.placements[0].minutes).toBe(180);
  });

  it("never joins slots at 0, whatever their length", () => {
    const result = generateTimetable(
      input(monday, [demand({ minutes: 180, blockMinutes: 0 })]),
    );
    expect(result.placements).toHaveLength(2);
    for (const placement of result.placements) {
      expect(placement.timeSlotIds).toHaveLength(1);
    }
  });

  it("does not join across a gap, so a double cannot straddle the break", () => {
    const split = [...day(1, 480, 90, 1), ...day(1, 600, 90, 1)].map((slot, i) => ({
      ...slot,
      id: `s${i}`,
    }));
    const result = generateTimetable(
      input(split, [demand({ minutes: 180, blockMinutes: 180 })]),
    );
    for (const placement of result.placements) {
      expect(placement.timeSlotIds).toHaveLength(1);
    }
  });
});

describe("hard constraints across mixed lengths", () => {
  const week = [
    ...[1, 2, 3, 4].flatMap((d) => day(d, 480, 90, 2)),
    ...day(5, 480, 60, 2),
  ];

  it("never books one teacher into two classes at once", () => {
    const result = generateTimetable(
      input(week, [
        demand({ schoolClassId: "c1", subjectId: "a", minutes: 270 }),
        demand({ schoolClassId: "c2", subjectId: "a", minutes: 270 }),
      ]),
    );

    const seen = new Set<string>();
    for (const placement of result.placements) {
      for (const id of placement.timeSlotIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  it("stays out of a teacher's unavailable slots", () => {
    const blocked = week.filter((slot) => slot.dayOfWeek === 1).map((slot) => slot.id);
    const result = generateTimetable(
      input(week, [demand({ minutes: 270 })], { unavailableTeacher: { t1: blocked } }),
    );
    for (const placement of result.placements) {
      for (const id of placement.timeSlotIds) expect(blocked).not.toContain(id);
    }
  });

  it("stops at a teacher's weekly cap counted in real minutes", () => {
    const result = generateTimetable(
      input(week, [demand({ minutes: 540 })], { teacherCapacity: { t1: 180 } }),
    );
    expect(minutesOf(result.placements)).toBeLessThanOrEqual(180);
    expect(result.shortfalls).toHaveLength(1);
  });
});

describe("per-subject rules", () => {
  const week = [1, 2, 3, 4, 5].flatMap((d) => day(d, 480, 60, 4));
  const idsOf = (placements: { timeSlotIds: string[] }[]) =>
    placements.flatMap((placement) => placement.timeSlotIds);

  it("keeps a restricted subject inside its allowed slots", () => {
    const allowed = week.filter((slot) => slot.dayOfWeek >= 4).map((slot) => slot.id);
    const result = generateTimetable(
      input(week, [demand({ minutes: 240, allowedSlotIds: allowed })]),
    );

    expect(result.shortfalls).toEqual([]);
    for (const id of idsOf(result.placements)) expect(allowed).toContain(id);
  });

  it("reports a shortfall when the allowed slots cannot hold the subject", () => {
    const result = generateTimetable(
      input(week, [demand({ minutes: 240, allowedSlotIds: ["d1-0"] })]),
    );
    expect(result.shortfalls).toHaveLength(1);
    expect(result.placedMinutes).toBe(60);
  });

  it("fills exactly the pinned slots, joining adjacent ones into one lesson", () => {
    const pinned = ["d1-0", "d1-1"];
    const result = generateTimetable(
      input(week, [
        demand({
          minutes: 120,
          blockMinutes: 240,
          allowedSlotIds: pinned,
          pinned: true,
        }),
      ]),
    );

    expect(result.shortfalls).toEqual([]);
    expect(idsOf(result.placements).sort()).toEqual(pinned);
    expect(result.placements).toHaveLength(1);
  });

  it("places pins before anything else can take their slots", () => {
    // One slot in the whole week, wanted by a large subject and pinned by a
    // small one: the pin must win even though it is the smaller demand.
    const slots = day(1, 480, 60, 1);
    const result = generateTimetable(
      input(slots, [
        demand({ subjectId: "big", minutes: 60, candidateTeachers: ["t-big"] }),
        demand({
          subjectId: "pin",
          minutes: 60,
          allowedSlotIds: ["d1-0"],
          pinned: true,
          candidateTeachers: ["t-pin"],
        }),
      ]),
    );

    const pin = result.placements.find((placement) => placement.subjectId === "pin");
    expect(pin?.timeSlotIds).toEqual(["d1-0"]);
    expect(result.shortfalls.map((row) => row.subjectId)).toEqual(["big"]);
  });

  it("gives a pinned subject and the rest of it one teacher", () => {
    // Two qualified teachers; the one the pin lands on must take the remainder.
    const both = { candidateTeachers: ["t1", "t2"], teacherWasAssigned: false };
    const result = generateTimetable(
      input(week, [
        demand({ ...both, minutes: 60, allowedSlotIds: ["d1-0"], pinned: true }),
        demand({ ...both, minutes: 180 }),
      ]),
    );

    const teachers = new Set(result.placements.map((placement) => placement.teacherId));
    expect(teachers.size).toBe(1);
    // One affectation for the subject, not one per demand.
    expect(result.assignments).toHaveLength(1);
  });

  it("reports a pin its teacher cannot attend rather than moving it", () => {
    const result = generateTimetable(
      input(week, [
        demand({ minutes: 60, allowedSlotIds: ["d1-0"], pinned: true }),
      ], { unavailableTeacher: { t1: ["d1-0"] } }),
    );

    expect(result.placements).toEqual([]);
    expect(result.shortfalls).toHaveLength(1);
  });
});

describe("determinism", () => {
  const week = [
    ...[1, 2, 3, 4].flatMap((d) => day(d, 480, 90, 2)),
    ...day(5, 480, 60, 2),
  ];
  const demands = [
    demand({ subjectId: "a", minutes: 270 }),
    demand({ subjectId: "b", minutes: 180, candidateTeachers: ["t2"] }),
  ];

  it("gives the same grid for the same seed", () => {
    expect(generateTimetable(input(week, demands))).toEqual(
      generateTimetable(input(week, demands)),
    );
  });
});
