import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, passMarkOf } from "@/lib/school-settings";
import {
  COEFFICIENT_MAX,
  COEFFICIENT_MIN,
  CYCLE_GRADE_COUNT,
  EDUCATION_CYCLES,
  cycleHasTracks,
  levelSubjectScopeKey,
  resolveProgrammeRows,
} from "@/modules/academics/enums";
import { RESOURCES } from "@/modules/configuration/resources";

/**
 * Le cursus: the four cycles, the levels inside them, the filières that stream
 * out of one of them, and which subject is taught where with what weight.
 *
 * The module owns no actions and no queries — its tables are edited under
 * `/configuration` — so what there is to get wrong is entirely in the rules it
 * declares and in whether anything actually reads them.
 *
 * The one that carries real weight is `resolveProgrammeRows`. A level may
 * legitimately declare a subject twice, once for every track and once for one
 * of them, and the unique index on (level, subject, scopeKey) says so. Read as
 * a bare union both rows survive, and everything downstream then guesses: the
 * generator's picker offered the subject twice, and a pupil's overall average
 * took whichever coefficient the database happened to return last. That is the
 * bug this function was written to close, and these are the cases it turns on.
 */

// ── The cycles ───────────────────────────────────────────────────────────────

describe("the four cycles", () => {
  it("lists them in progression order", () => {
    // Fixed, unlike filières: the cycles are set by the Ministry and a school
    // picks from them rather than inventing its own.
    expect([...EDUCATION_CYCLES]).toEqual([
      "PRESCHOOL",
      "PRIMARY",
      "SECONDARY_COLLEGE",
      "SECONDARY_QUALIFYING",
    ]);
  });

  it("streams only the qualifying cycle into filières", () => {
    // Which is why every `trackId` in the schema is nullable.
    expect(EDUCATION_CYCLES.filter(cycleHasTracks)).toEqual([
      "SECONDARY_QUALIFYING",
    ]);
  });

  it("says no to a cycle it has never heard of", () => {
    for (const nonsense of ["", "SECONDARY", "primary", "__proto__"]) {
      expect(
        cycleHasTracks(nonsense as (typeof EDUCATION_CYCLES)[number]),
        nonsense,
      ).toBe(false);
    }
  });

  it("gives every cycle a grade count", () => {
    for (const cycle of EDUCATION_CYCLES) {
      expect(CYCLE_GRADE_COUNT[cycle], cycle).toBeGreaterThan(0);
    }
    expect(Object.keys(CYCLE_GRADE_COUNT).sort()).toEqual(
      [...EDUCATION_CYCLES].sort(),
    );
  });

  it("counts the grades the Moroccan system actually runs", () => {
    // 1AP…6AP, 1AC…3AC, and TC/1BAC/2BAC.
    expect(CYCLE_GRADE_COUNT.PRIMARY).toBe(6);
    expect(CYCLE_GRADE_COUNT.SECONDARY_COLLEGE).toBe(3);
    expect(CYCLE_GRADE_COUNT.SECONDARY_QUALIFYING).toBe(3);
    expect(CYCLE_GRADE_COUNT.PRESCHOOL).toBe(2);
  });
});

// ── The nullable mirror ──────────────────────────────────────────────────────

describe("levelSubjectScopeKey", () => {
  it("stops the same subject being declared twice for every track", () => {
    // MySQL treats NULLs as distinct in a unique index, so two "all tracks"
    // rows would both be accepted and the subject's coefficient counted twice
    // in every average.
    expect(levelSubjectScopeKey(null)).toBe(levelSubjectScopeKey(undefined));
    expect(levelSubjectScopeKey(null)).not.toBe(levelSubjectScopeKey("sm"));
  });

  it("keys a track's own row on the track", () => {
    expect(levelSubjectScopeKey("sm")).not.toBe(levelSubjectScopeKey("lettres"));
    expect(levelSubjectScopeKey("sm")).toBe(levelSubjectScopeKey("sm"));
  });
});

// ── The programme ────────────────────────────────────────────────────────────

describe("resolveProgrammeRows", () => {
  const row = (subjectId: string, trackId: string | null, coefficient = 1) => ({
    subjectId,
    trackId,
    coefficient,
  });

  it("lets a track's own declaration beat the level-wide one", () => {
    // Maths is 4 across 2BAC and 7 in Sciences Maths. Both rows are legal, so
    // somebody has to decide, and the more specific one is the only answer that
    // means anything.
    expect(
      resolveProgrammeRows([row("maths", null, 4), row("maths", "sm", 7)], "sm"),
    ).toEqual([row("maths", "sm", 7)]);
  });

  it("decides the same way whichever order the rows arrive in", () => {
    // The bug this closes: the resolution used to be a last-write-wins loop
    // over a query with no `orderBy`, so the coefficient depended on what the
    // database felt like returning second.
    expect(
      resolveProgrammeRows([row("maths", "sm", 7), row("maths", null, 4)], "sm"),
    ).toEqual([row("maths", "sm", 7)]);
  });

  it("keeps the level-wide row for a track that declares none", () => {
    // The common subjects — Arabic, éducation islamique, EPS — are declared
    // once for every filière rather than repeated per stream.
    expect(
      resolveProgrammeRows(
        [row("arabe", null, 2), row("maths", "sm", 7)],
        "lettres",
      ),
    ).toEqual([row("arabe", null, 2)]);
  });

  it("keeps it for a class with no track at all", () => {
    // Every primary class: the cycle has no filières.
    expect(
      resolveProgrammeRows([row("arabe", null, 2), row("maths", "sm", 7)], null),
    ).toEqual([row("arabe", null, 2)]);
  });

  it("leaves another track's rows out of the programme entirely", () => {
    expect(resolveProgrammeRows([row("philo", "lettres", 4)], "sm")).toEqual([]);
  });

  it("answers one row per subject, never two", () => {
    const resolved = resolveProgrammeRows(
      [
        row("arabe", null, 2),
        row("maths", null, 4),
        row("maths", "sm", 7),
        row("svt", "sm", 5),
        row("philo", "lettres", 4),
      ],
      "sm",
    );

    const ids = resolved.map((entry) => entry.subjectId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(["arabe", "maths", "svt"]);
  });

  it("preserves the order it was given, which is the position order", () => {
    // Every caller reads the programme in `position` order, and the picker
    // draws it in that order.
    const rows = [row("arabe", null), row("maths", null), row("svt", null)];
    expect(resolveProgrammeRows(rows, "sm")).toEqual(rows);
  });

  it("keeps the track's row in the general one's place, not at the end", () => {
    // A subject does not move down the list because its filière prices it.
    const resolved = resolveProgrammeRows(
      [row("arabe", null), row("maths", null, 4), row("maths", "sm", 7), row("svt", null)],
      "sm",
    );
    expect(resolved.map((entry) => entry.subjectId)).toEqual([
      "arabe",
      "maths",
      "svt",
    ]);
  });

  it("answers nothing for an empty programme", () => {
    expect(resolveProgrammeRows([], "sm")).toEqual([]);
    expect(resolveProgrammeRows([], null)).toEqual([]);
  });

  it("returns the very rows it was handed, not copies", () => {
    // Callers map straight off the result onto their own shapes; a copy would
    // silently drop whatever fields they select beyond these three.
    const rows = [row("maths", "sm", 7)];
    expect(resolveProgrammeRows(rows, "sm")[0]).toBe(rows[0]);
  });

  it("survives a subject declared twice for the same track", () => {
    // The unique index makes it impossible, but the resolver must not double it
    // if a seed or an import ever managed to.
    const resolved = resolveProgrammeRows(
      [row("maths", "sm", 7), row("maths", "sm", 9)],
      "sm",
    );
    expect(resolved).toHaveLength(1);
  });
});

// ── Bounds that are read rather than repeated ────────────────────────────────

describe("the coefficient bounds", () => {
  it("bounds data entry to the small integers a coefficient actually is", () => {
    expect(COEFFICIENT_MIN).toBe(1);
    expect(COEFFICIENT_MAX).toBe(20);
    expect(COEFFICIENT_MIN).toBeLessThan(COEFFICIENT_MAX);
  });

  it("is what the programme form is bounded by", () => {
    // They used to be literals on the form and constants here — two answers to
    // one question, and nothing to notice if they parted company.
    const programme = RESOURCES.find((resource) => resource.id === "programme")!;
    const coefficient = programme.fields.find(
      (field) => field.name === "coefficient",
    )!;

    expect(coefficient.min).toBe(COEFFICIENT_MIN);
    expect(coefficient.max).toBe(COEFFICIENT_MAX);
  });

  it("admits every coefficient a Moroccan programme uses", () => {
    // Maths at 7 in Sciences Maths, 3 in Lettres; nothing reaches 20.
    for (const coefficient of [1, 3, 4, 6, 7, 9]) {
      expect(coefficient, String(coefficient)).toBeGreaterThanOrEqual(
        COEFFICIENT_MIN,
      );
      expect(coefficient, String(coefficient)).toBeLessThanOrEqual(
        COEFFICIENT_MAX,
      );
    }
  });
});

// ── The scale this module no longer claims to own ────────────────────────────

describe("the mark scale", () => {
  it("lives with the school's own settings, not with the curriculum", () => {
    // This module used to declare MARK_SCALE_MAX and MARK_PASS_THRESHOLD as
    // fixed. The grading module arrived and wanted something else: a school
    // sets its own scale and its own pass ratio, and every reader goes through
    // `context.settings`. The pair here asserted as fixed the two numbers the
    // app had made configurable.
    expect(DEFAULT_SETTINGS.gradingMaxScore).toBe(20);
    expect(passMarkOf(DEFAULT_SETTINGS)).toBe(10);
  });

  it("defaults to exactly what the curriculum expects", () => {
    // Which is why removing the constants changed nothing: the defaults *are*
    // the Moroccan scale, and a school that runs it need say nothing.
    expect(passMarkOf(DEFAULT_SETTINGS)).toBe(
      DEFAULT_SETTINGS.gradingMaxScore / 2,
    );
  });
});
