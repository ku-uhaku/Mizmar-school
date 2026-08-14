import { describe, expect, it } from "vitest";

import {
  coveredLevels,
  coversLevel,
  qualifiedTeachers,
  type LevelCycle,
  type Qualification,
} from "@/modules/hr/qualifications";

/**
 * Qui peut prendre quoi, et où.
 *
 * The rule the timetable generator staffs a grid from. What is worth testing is
 * not the happy path but the three ways a school can say "here and nowhere
 * else", and the one way it can say nothing at all — because the generator
 * treats silence and refusal completely differently, and getting them the wrong
 * way round either offers a lycée class to the primaire's maths teacher or
 * leaves a class nobody can teach.
 */

/** Un groupe scolaire: two cycles, three niveaux each. */
const LEVELS: LevelCycle[] = [
  { id: "2ap", educationLevelId: "primaire" },
  { id: "3ap", educationLevelId: "primaire" },
  { id: "4ap", educationLevelId: "primaire" },
  { id: "1ac", educationLevelId: "college" },
  { id: "2ac", educationLevelId: "college" },
  { id: "3ac", educationLevelId: "college" },
];

const ahmad: Qualification = {
  teacherId: "ahmad",
  educationLevelId: null,
  levelIds: [],
};

describe("coveredLevels", () => {
  it("reads the niveaux a row names, and nothing else", () => {
    expect(
      coveredLevels({ ...ahmad, levelIds: ["2ap", "3ap"] }, LEVELS),
    ).toEqual(new Set(["2ap", "3ap"]));
  });

  it("expands a cycle to the niveaux it holds", () => {
    expect(coveredLevels({ ...ahmad, educationLevelId: "college" }, LEVELS)).toEqual(
      new Set(["1ac", "2ac", "3ac"]),
    );
  });

  it("lets the niveaux win over the cycle when both are set", () => {
    // Narrowest first. A row naming 2AP *and* le collège is a school that
    // narrowed an existing declaration; honouring the cycle as well would undo
    // the edit they just made.
    expect(
      coveredLevels(
        { ...ahmad, educationLevelId: "college", levelIds: ["2ap"] },
        LEVELS,
      ),
    ).toEqual(new Set(["2ap"]));
  });

  it("says null — not every niveau — for a school-wide row", () => {
    // Null on purpose: a school-wide qualification has to still be school-wide
    // after September opens a new niveau, which a list computed today would not.
    expect(coveredLevels(ahmad, LEVELS)).toBeNull();
  });
});

describe("coversLevel", () => {
  it("reaches every niveau when the row names none", () => {
    for (const level of LEVELS) {
      expect(coversLevel(ahmad, level.id, LEVELS)).toBe(true);
    }
  });

  it("keeps a cycle's teacher out of the other cycle", () => {
    const primaire = { ...ahmad, educationLevelId: "primaire" };
    expect(coversLevel(primaire, "3ap", LEVELS)).toBe(true);
    expect(coversLevel(primaire, "3ac", LEVELS)).toBe(false);
  });

  it("reaches a niveau the school has not opened as nothing at all", () => {
    expect(coversLevel({ ...ahmad, levelIds: ["2ap"] }, "6ap", LEVELS)).toBe(false);
  });
});

describe("qualifiedTeachers", () => {
  /*
    Ahmad prend les maths en 2AP et 3AP, Fatima au collège, Youssef partout.
    The case from the requirement: one teacher, several niveaux, one row.
  */
  const maths: Qualification[] = [
    { teacherId: "ahmad", educationLevelId: null, levelIds: ["2ap", "3ap"] },
    { teacherId: "fatima", educationLevelId: "college", levelIds: [] },
    { teacherId: "youssef", educationLevelId: null, levelIds: [] },
  ];

  it("offers only the teachers whose scope reaches the niveau", () => {
    expect(qualifiedTeachers(maths, "2ap", LEVELS)).toEqual(["ahmad", "youssef"]);
    expect(qualifiedTeachers(maths, "4ap", LEVELS)).toEqual(["youssef"]);
    expect(qualifiedTeachers(maths, "2ac", LEVELS)).toEqual(["fatima", "youssef"]);
  });

  it("keeps the order it was given, which is preference rank", () => {
    // The loader sorts on `preferenceRank`, so a specialist arrives before
    // somebody merely covering and must still be offered first.
    expect(qualifiedTeachers(maths, "3ap", LEVELS)).toEqual(["ahmad", "youssef"]);
  });

  it("counts a teacher declared twice as one candidate", () => {
    const twice: Qualification[] = [
      { teacherId: "ahmad", educationLevelId: null, levelIds: ["2ap"] },
      { teacherId: "ahmad", educationLevelId: "primaire", levelIds: [] },
    ];
    expect(qualifiedTeachers(twice, "2ap", LEVELS)).toEqual(["ahmad"]);
  });

  it("comes back empty when everything declared is scoped elsewhere", () => {
    // Not the same as "nothing declared", and the caller must not fall back to
    // inference here: a school that named a maths teacher for the primaire has
    // said something about the collège, and it is "nobody yet".
    const primaireOnly: Qualification[] = [
      { teacherId: "ahmad", educationLevelId: "primaire", levelIds: [] },
    ];
    expect(qualifiedTeachers(primaireOnly, "1ac", LEVELS)).toEqual([]);
  });
});
