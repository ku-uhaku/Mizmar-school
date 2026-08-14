import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import { resolveProgrammeRows } from "@/modules/academics/enums";
import {
  ASSESSMENT_STAGES,
  ASSESSMENT_STATUSES,
  COUNTED_STATUSES,
  DEFAULT_APPRECIATION_BANDS,
  DEFAULT_PASS_BPS,
  FAMILY_VISIBLE_STATUSES,
  MAX_APPRECIATION_BANDS,
  MAX_SEQUENCE,
  acceptsMarks,
  appreciationFor,
  assessmentScopeKey,
  awaitingValidation,
  isPassing,
  markStatistics,
  pointsToQuarters,
  quartersToPoints,
  questionsTotal,
  roundScore,
  sortBands,
  stageOf,
} from "@/modules/assessments/enums";
import {
  assessmentSchema,
  generateSchema,
  massarCodeSchema,
  statusSchema,
} from "@/modules/assessments/validation";

/**
 * Les contrôles, and the marks on them.
 *
 * A mark is the most consequential small number in the app: it goes on a report
 * card, it decides a redoublement, and a family will ask about it a year later.
 * So what is tested here is the handful of rules that keep one honest —
 *
 *   * **a mark may only be entered on a paper that was actually set.** A DRAFT
 *     has not been sat and a CANCELLED one did not happen;
 *   * **a mark lies within its own paper's scale.** `maxScore` is per paper, so
 *     an oral out of 10 must refuse a 15 that a class marked out of 20 accepts;
 *   * **an absence is not a zero.** Three different facts — not marked, sat and
 *     scored nothing, was not there — and collapsing them loses the one the
 *     family asks about;
 *   * **the roster decides who may be marked**, so a crafted enrolment id
 *     cannot write a mark onto another class's pupil;
 *   * **what counts and what a family may read are two questions**, and the
 *     second is strictly narrower.
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
  createMany: { count: 0 },
  update: {},
  upsert: {},
};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) => {
      // The mark sheet is written in one transaction; running the operations is
      // all this needs to do, since each one already records itself.
      if (model === "$transaction") {
        return async (operations: unknown[]) => Promise.all(operations);
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

const {
  carryGradesToClass,
  generateAssessments,
  resolveProgramme,
  saveMarks,
  setAssessmentStatus,
} = await import("@/modules/assessments/service");
type GenerateTarget = import("@/modules/assessments/service").GenerateTarget;

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
});

// ── The workflow ─────────────────────────────────────────────────────────────

describe("the paper's life", () => {
  it("accepts marks from PUBLISHED onward and nowhere else", () => {
    expect(ASSESSMENT_STATUSES.filter(acceptsMarks)).toEqual([
      "PUBLISHED",
      "SUBMITTED",
      "GRADED",
    ]);
  });

  it("refuses marks on a paper nobody has sat", () => {
    // DRAFT is planning. A mark against it would be a result for a paper that
    // has not happened.
    expect(acceptsMarks("DRAFT")).toBe(false);
    expect(acceptsMarks("CANCELLED")).toBe(false);
  });

  it("keeps a handed-back paper open to the office's corrections", () => {
    // SUBMITTED changes whose move it is, not who may type — the office fixing
    // one mark before validating must not have to reopen the whole sheet.
    expect(acceptsMarks("SUBMITTED")).toBe(true);
  });

  it("gives every status a stage except the one nobody is waiting on", () => {
    for (const status of ASSESSMENT_STATUSES) {
      const stage = stageOf(status);
      if (status === "CANCELLED") {
        expect(stage).toBeNull();
      } else {
        expect(ASSESSMENT_STAGES, status).toContain(stage);
      }
    }
  });

  it("maps each stage to exactly one status", () => {
    const stages = ASSESSMENT_STATUSES.map(stageOf).filter(
      (stage): stage is NonNullable<typeof stage> => stage !== null,
    );
    expect(new Set(stages).size).toBe(stages.length);
    expect(new Set(stages)).toEqual(new Set(ASSESSMENT_STAGES));
  });

  it("says nothing about a status it has never heard of", () => {
    for (const nonsense of ["", "published", "DONE", "__proto__"]) {
      expect(stageOf(nonsense), nonsense).toBeNull();
      expect(acceptsMarks(nonsense), nonsense).toBe(false);
    }
  });

  it("awaits validation on SUBMITTED alone", () => {
    expect(ASSESSMENT_STATUSES.filter(awaitingValidation)).toEqual(["SUBMITTED"]);
  });
});

// ── What counts, and what a family may read ──────────────────────────────────

describe("the family's view is narrower than the average's", () => {
  it("shows a family only what the school has accepted", () => {
    // This gate used to be `COUNTED_STATUSES`, which includes PUBLISHED — the
    // status a paper takes the moment the office opens it for mark entry. So a
    // family saw each mark as its teacher typed it: a half-marked sheet read as
    // a result, and a correction made before validation read as a grade that
    // had changed.
    expect([...FAMILY_VISIBLE_STATUSES]).toEqual(["GRADED"]);
  });

  it("is a strict subset of what counts toward the average", () => {
    for (const status of FAMILY_VISIBLE_STATUSES) {
      expect(COUNTED_STATUSES, status).toContain(status);
    }
    expect(FAMILY_VISIBLE_STATUSES.length).toBeLessThan(COUNTED_STATUSES.length);
  });

  it("counts a paper still being marked, but does not show it", () => {
    // Deliberately different answers to two questions that look like one: a
    // running average across a term genuinely should include a paper in
    // marking, and a parent should not read it yet.
    expect(COUNTED_STATUSES).toContain("PUBLISHED");
    expect(FAMILY_VISIBLE_STATUSES).not.toContain("PUBLISHED");
    expect(FAMILY_VISIBLE_STATUSES).not.toContain("SUBMITTED");
  });

  it("counts nothing that was never set or never happened", () => {
    for (const status of ["DRAFT", "CANCELLED"] as const) {
      expect(COUNTED_STATUSES, status).not.toContain(status);
      expect(FAMILY_VISIBLE_STATUSES, status).not.toContain(status);
    }
  });

  it("counts exactly the statuses that accept marks", () => {
    // A paper whose marks count but which refuses marks, or the reverse, would
    // be a state nobody could reach out of.
    expect([...COUNTED_STATUSES]).toEqual(ASSESSMENT_STATUSES.filter(acceptsMarks));
  });
});

// ── The arithmetic ───────────────────────────────────────────────────────────

describe("roundScore", () => {
  it("keeps two decimals, which is what a quarter-point needs", () => {
    expect(roundScore(13.25)).toBe(13.25);
    expect(roundScore(8.5)).toBe(8.5);
  });

  it("does not print a float's tail on a report card", () => {
    expect(roundScore(13.250000000000002)).toBe(13.25);
    expect(roundScore(0.1 + 0.2)).toBe(0.3);
  });

  it("rounds a third of a mark rather than truncating it", () => {
    expect(roundScore(40 / 3)).toBe(13.33);
    expect(roundScore(2 / 3)).toBe(0.67);
  });
});

describe("isPassing", () => {
  it("judges a mark against its own paper, not against twenty", () => {
    // A school marking out of 20 may still set one oral out of 10. Half of the
    // paper is a pass on either scale; 10 is a pass on one and full marks on
    // the other.
    expect(isPassing(10, 20)).toBe(true);
    expect(isPassing(5, 10)).toBe(true);
    expect(isPassing(9.99, 20)).toBe(false);
    expect(isPassing(4.99, 10)).toBe(false);
  });

  it("takes the threshold from the school, not from the scale", () => {
    // The school decides the ratio; the paper decides the scale.
    expect(isPassing(12, 20, 6000)).toBe(true);
    expect(isPassing(11.99, 20, 6000)).toBe(false);
    expect(isPassing(6, 10, 6000)).toBe(true);
  });

  it("passes nothing on a paper marked out of nothing", () => {
    // Rather than dividing by zero and answering NaN >= threshold, which is
    // false by accident instead of on purpose.
    expect(isPassing(0, 0)).toBe(false);
    expect(isPassing(10, 0)).toBe(false);
  });

  it("defaults to half marks", () => {
    expect(DEFAULT_PASS_BPS).toBe(5000);
    expect(isPassing(10, 20, DEFAULT_PASS_BPS)).toBe(isPassing(10, 20));
  });
});

describe("markStatistics", () => {
  const marked = (...scores: number[]) =>
    scores.map((score) => ({ score, isAbsent: false }));

  it("averages the marks that exist", () => {
    const stats = markStatistics(marked(10, 12, 14), 20);
    expect(stats).toMatchObject({
      markedCount: 3,
      average: 12,
      lowest: 10,
      highest: 14,
      absentCount: 0,
      pendingCount: 0,
    });
  });

  it("leaves an absence out of the mean rather than averaging it as zero", () => {
    // The rule this whole helper exists for. A pupil who was not there has not
    // demonstrated a zero, and folding them in drags a class average down for a
    // reason that has nothing to do with the paper.
    const withAbsence = markStatistics(
      [...marked(10, 12, 14), { score: null, isAbsent: true }],
      20,
    );
    expect(withAbsence.average).toBe(12);
    expect(withAbsence.absentCount).toBe(1);
    expect(withAbsence.markedCount).toBe(3);
  });

  it("ignores a score sitting on an absent row", () => {
    // Belt and braces: `saveMarks` nulls the score for an absence, but a row
    // that carried both must not quietly rejoin the mean.
    const stats = markStatistics([{ score: 20, isAbsent: true }], 20);
    expect(stats.average).toBeNull();
    expect(stats.markedCount).toBe(0);
  });

  it("counts a pupil with neither a mark nor an absence as pending", () => {
    const stats = markStatistics(
      [...marked(10), { score: null, isAbsent: false }],
      20,
    );
    expect(stats.pendingCount).toBe(1);
    expect(stats.markedCount).toBe(1);
  });

  it("answers nothing rather than zero for an unmarked sheet", () => {
    // Zero is a mark somebody earned. "Not marked yet" has to look different.
    const stats = markStatistics(
      [
        { score: null, isAbsent: false },
        { score: null, isAbsent: false },
      ],
      20,
    );
    expect(stats).toMatchObject({
      average: null,
      lowest: null,
      highest: null,
      passRate: null,
      passCount: 0,
      pendingCount: 2,
    });
  });

  it("answers nothing for a sheet where everybody was absent", () => {
    const stats = markStatistics(
      [
        { score: null, isAbsent: true },
        { score: null, isAbsent: true },
      ],
      20,
    );
    expect(stats.average).toBeNull();
    expect(stats.absentCount).toBe(2);
    expect(stats.pendingCount).toBe(0);
  });

  it("distinguishes a genuine zero from an absence", () => {
    const zeros = markStatistics(marked(0, 0), 20);
    expect(zeros.average).toBe(0);
    expect(zeros.markedCount).toBe(2);
    expect(zeros.passRate).toBe(0);
  });

  it("reports the pass rate against the paper's own scale", () => {
    const stats = markStatistics(marked(4, 6, 12), 10);
    expect(stats.passCount).toBe(2);
    expect(stats.passRate).toBe(67);
  });

  it("keeps the counts adding up to the roster", () => {
    const grades = [
      ...marked(10, 12),
      { score: null, isAbsent: true },
      { score: null, isAbsent: false },
    ];
    const stats = markStatistics(grades, 20);
    expect(stats.markedCount + stats.absentCount + stats.pendingCount).toBe(
      grades.length,
    );
  });

  it("rounds the average the way a mark sheet does", () => {
    expect(markStatistics(marked(10, 11), 20).average).toBe(10.5);
    expect(markStatistics(marked(10, 11, 13), 20).average).toBe(11.33);
  });
});

// ── The barème ───────────────────────────────────────────────────────────────

describe("question points", () => {
  it("counts in quarters, so a barème of halves adds up exactly", () => {
    // Eight questions at 2.5 must total 20, not 19.999999999999996 — which is
    // the whole reason the points are stored as integers.
    const questions = Array.from({ length: 8 }, () => ({
      pointsQuarters: pointsToQuarters(2.5),
    }));
    expect(questionsTotal(questions)).toBe(20);
  });

  it("round-trips every value a Moroccan barème actually uses", () => {
    for (const points of [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4.75]) {
      expect(quartersToPoints(pointsToQuarters(points)), String(points)).toBe(
        points,
      );
    }
  });

  it("snaps to the nearest quarter rather than storing a stray float", () => {
    expect(pointsToQuarters(1.7333)).toBe(7);
    expect(quartersToPoints(7)).toBe(1.75);
  });

  it("totals an empty paper as nothing", () => {
    // A contrôle planned by the office before anybody has written it.
    expect(questionsTotal([])).toBe(0);
  });

  it("sums a mixed barème without drifting", () => {
    const points = [2.5, 3.25, 0.75, 1.5, 2, 4, 6];
    const total = questionsTotal(
      points.map((value) => ({ pointsQuarters: pointsToQuarters(value) })),
    );
    expect(total).toBe(20);
  });
});

// ── The scope key ────────────────────────────────────────────────────────────

describe("assessmentScopeKey", () => {
  it("gives a whole-class paper a real value rather than NULL", () => {
    // SQLite treats NULLs as distinct in a unique index, so two "whole class"
    // rows for the same subject and sequence would both be accepted and the
    // generator would stop being idempotent.
    expect(assessmentScopeKey(null)).toBe("__class__");
  });

  it("keys a group's paper on the group", () => {
    expect(assessmentScopeKey("group-1")).toBe("group-1");
  });

  it("never collides a group with the whole class", () => {
    expect(assessmentScopeKey("group-1")).not.toBe(assessmentScopeKey(null));
  });
});

// ── The programme: a track's row overrides the level's ───────────────────────

describe("resolveProgrammeRows", () => {
  const row = (subjectId: string, trackId: string | null, coefficient: number) =>
    ({ subjectId, trackId, coefficient });

  it("lets the track's own declaration win over the level-wide one", () => {
    // Maths is 4 across 2BAC and 7 in Sciences Maths. Both rows are legal — the
    // unique index is on (level, subject, scopeKey) — so somebody has to decide,
    // and the more specific declaration is the only answer that means anything.
    const resolved = resolveProgrammeRows(
      [row("maths", null, 4), row("maths", "sm", 7)],
      "sm",
    );
    expect(resolved).toEqual([row("maths", "sm", 7)]);
  });

  it("wins regardless of the order the rows came back in", () => {
    // The bug this closes: the resolution used to be a last-write-wins loop
    // over an unordered query, so the coefficient depended on what the database
    // felt like returning second and a pupil's average was not reproducible.
    const resolved = resolveProgrammeRows(
      [row("maths", "sm", 7), row("maths", null, 4)],
      "sm",
    );
    expect(resolved).toEqual([row("maths", "sm", 7)]);
  });

  it("returns one row per subject, never two", () => {
    const resolved = resolveProgrammeRows(
      [row("maths", null, 4), row("maths", "sm", 7), row("arabe", null, 2)],
      "sm",
    );
    const ids = resolved.map((entry) => entry.subjectId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["arabe", "maths"]);
  });

  it("keeps the level-wide row for a class whose track has none", () => {
    // The common subjects — Arabic, éducation islamique, EPS — are declared
    // once for every track rather than repeated per stream.
    expect(
      resolveProgrammeRows([row("maths", null, 4), row("maths", "sm", 7)], "lettres"),
    ).toEqual([row("maths", null, 4)]);
  });

  it("keeps the level-wide row for a class with no track at all", () => {
    // Every primary class: the cycle has no streams.
    expect(
      resolveProgrammeRows([row("arabe", null, 2), row("maths", "sm", 7)], null),
    ).toEqual([row("arabe", null, 2)]);
  });

  it("leaves another track's rows out of the programme entirely", () => {
    expect(
      resolveProgrammeRows([row("philo", "lettres", 4)], "sm"),
    ).toEqual([]);
  });

  it("preserves the order it was given, which is the position order", () => {
    const rows = [
      row("arabe", null, 2),
      row("maths", null, 4),
      row("svt", null, 3),
    ];
    expect(resolveProgrammeRows(rows, "sm")).toEqual(rows);
  });

  it("answers nothing for an empty programme", () => {
    expect(resolveProgrammeRows([], "sm")).toEqual([]);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("validation", () => {
  const t = getDictionaryFor("en");

  describe("statusSchema", () => {
    it("accepts every status the module declares", () => {
      for (const status of ASSESSMENT_STATUSES) {
        expect(statusSchema(t).safeParse({ status }).success, status).toBe(true);
      }
    });

    it("refuses anything else, so no free string reaches the column", () => {
      // `setAssessmentStatus` writes what it is handed. The enum here is the
      // only thing between a request and a paper in a status nothing recognises.
      for (const status of ["", "published", "DONE", "GRADED ", "__proto__"]) {
        expect(statusSchema(t).safeParse({ status }).success, status).toBe(false);
      }
    });
  });

  describe("assessmentSchema", () => {
    const paper = (extra: Record<string, unknown> = {}) => ({
      title: "Contrôle n°1 — Les fonctions",
      sequence: 1,
      scheduledOn: "2026-01-15",
      maxScore: 20,
      coefficient: 1,
      // Always posted: the edit form renders the switch on every paper, so the
      // schema requires it rather than defaulting a weighting decision.
      countsTowardAverage: true,
      notes: "",
      ...extra,
    });

    it("accepts an ordinary paper", () => {
      expect(assessmentSchema(t).safeParse(paper()).success).toBe(true);
    });

    it("refuses a paper marked out of nothing", () => {
      expect(assessmentSchema(t).safeParse(paper({ maxScore: 0 })).success).toBe(
        false,
      );
    });

    it("refuses a scale that is a data-entry slip rather than a grading scale", () => {
      expect(assessmentSchema(t).safeParse(paper({ maxScore: 101 })).success).toBe(
        false,
      );
      expect(assessmentSchema(t).safeParse(paper({ maxScore: 20.5 })).success).toBe(
        false,
      );
    });

    it("bounds the coefficient the way a Moroccan one is written", () => {
      expect(assessmentSchema(t).safeParse(paper({ coefficient: 0 })).success).toBe(
        false,
      );
      expect(assessmentSchema(t).safeParse(paper({ coefficient: 21 })).success).toBe(
        false,
      );
      expect(assessmentSchema(t).safeParse(paper({ coefficient: 9 })).success).toBe(
        true,
      );
    });

    it("bounds the sequence, so a term cannot hold a thousand contrôles", () => {
      expect(assessmentSchema(t).safeParse(paper({ sequence: 0 })).success).toBe(
        false,
      );
      expect(
        assessmentSchema(t).safeParse(paper({ sequence: MAX_SEQUENCE })).success,
      ).toBe(true);
      expect(
        assessmentSchema(t).safeParse(paper({ sequence: MAX_SEQUENCE + 1 })).success,
      ).toBe(false);
    });

    it("carries whether the paper weighs on the term", () => {
      const off = assessmentSchema(t).safeParse(
        paper({ countsTowardAverage: false }),
      );
      expect(off.success).toBe(true);
      if (off.success) expect(off.data.countsTowardAverage).toBe(false);

      // Required rather than defaulted: the form always posts it, and silently
      // defaulting a weighting decision is how a paper drifts in or out of the
      // average without anybody choosing.
      const missing = assessmentSchema(t).safeParse({
        ...paper(),
        countsTowardAverage: undefined,
      });
      expect(missing.success).toBe(false);
    });

    it("strips anything the form did not declare", () => {
      const parsed = assessmentSchema(t).safeParse({
        ...paper(),
        status: "GRADED",
        schoolId: "another-school",
        teacherId: "somebody-else",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        // Editing a paper must not be a way to publish it, move it to another
        // school, or hand somebody else the marking.
        expect(parsed.data).not.toHaveProperty("status");
        expect(parsed.data).not.toHaveProperty("schoolId");
        expect(parsed.data).not.toHaveProperty("teacherId");
      }
    });
  });

  describe("generateSchema", () => {
    const run = (extra: Record<string, unknown> = {}) => ({
      scope: "CLASS",
      schoolClassId: "class-1",
      levelOfferingId: "",
      termId: "term-1",
      assessmentTypeId: "type-1",
      sequence: 1,
      scheduledOn: "",
      ...extra,
    });

    it("accepts each declared scope and refuses the rest", () => {
      for (const scope of ["CLASS", "LEVEL", "YEAR"]) {
        expect(generateSchema(t).safeParse(run({ scope })).success, scope).toBe(
          true,
        );
      }
      for (const scope of ["", "SCHOOL", "class", "ALL"]) {
        expect(generateSchema(t).safeParse(run({ scope })).success, scope).toBe(
          false,
        );
      }
    });

    it("requires the term and the kind, which nothing can be derived without", () => {
      expect(generateSchema(t).safeParse(run({ termId: "" })).success).toBe(false);
      expect(
        generateSchema(t).safeParse(run({ assessmentTypeId: "" })).success,
      ).toBe(false);
    });
  });
});

// ── Recording a mark sheet ───────────────────────────────────────────────────

const PAPER: {
  id: string;
  maxScore: number;
  status: string;
  schoolClassId: string;
  classGroupId: string | null;
} = {
  id: "paper-1",
  maxScore: 20,
  status: "PUBLISHED",
  schoolClassId: "class-1",
  classGroupId: null,
};

const ROSTER = [{ id: "enrol-1" }, { id: "enrol-2" }, { id: "enrol-3" }];

const mark = (extra: Partial<Parameters<typeof saveMarks>[1][number]> = {}) => ({
  enrollmentId: "enrol-1",
  score: 13.25,
  isAbsent: false,
  isExcused: false,
  comment: null,
  ...extra,
});

/** What one upsert was asked to write. */
const written = () =>
  of("assessmentGrade", "upsert").map(
    (call) =>
      (call.args as { create: Record<string, unknown> }).create,
  );

describe("saveMarks", () => {
  const open = (paper: Partial<typeof PAPER> = {}) => {
    answers = {
      "assessment.findUnique": { ...PAPER, ...paper },
      "enrollment.findMany": ROSTER,
    };
  };

  it("writes a mark against the paper and the pupil", async () => {
    open();
    const result = await saveMarks("paper-1", [mark()], "user-1");

    expect(result).toEqual({ ok: true, saved: 1 });
    expect(written()[0]).toMatchObject({
      assessmentId: "paper-1",
      enrollmentId: "enrol-1",
      score: 13.25,
      gradedById: "user-1",
    });
  });

  it("refuses a paper that does not exist", async () => {
    expect(await saveMarks("nowhere", [mark()], "user-1")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(of("assessmentGrade", "upsert")).toEqual([]);
  });

  it("refuses a paper nobody has sat", async () => {
    for (const status of ["DRAFT", "CANCELLED"]) {
      calls.length = 0;
      open({ status });
      expect(await saveMarks("paper-1", [mark()], "user-1"), status).toEqual({
        ok: false,
        reason: "locked",
      });
      expect(of("assessmentGrade", "upsert"), status).toEqual([]);
    }
  });

  it("accepts every status that accepts marks", async () => {
    for (const status of ASSESSMENT_STATUSES.filter(acceptsMarks)) {
      calls.length = 0;
      open({ status });
      expect(await saveMarks("paper-1", [mark()], "user-1"), status).toEqual({
        ok: true,
        saved: 1,
      });
    }
  });

  // ── The paper's own scale ──────────────────────────────────────────────────

  it("refuses a mark above the paper's own maximum", async () => {
    // 15 is an ordinary mark out of 20 and impossible on an oral out of 10.
    open({ maxScore: 10 });
    expect(await saveMarks("paper-1", [mark({ score: 15 })], "user-1")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("accepts a mark exactly on the maximum", async () => {
    open({ maxScore: 10 });
    expect(await saveMarks("paper-1", [mark({ score: 10 })], "user-1")).toEqual({
      ok: true,
      saved: 1,
    });
  });

  it("refuses a negative mark", async () => {
    open();
    expect(await saveMarks("paper-1", [mark({ score: -1 })], "user-1")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("refuses a mark that is not a number at all", async () => {
    for (const score of [Number.NaN, Infinity, -Infinity]) {
      calls.length = 0;
      open();
      expect(
        await saveMarks("paper-1", [mark({ score })], "user-1"),
        String(score),
      ).toEqual({ ok: false, reason: "out-of-range" });
    }
  });

  it("refuses the whole sheet when one mark is out of range", async () => {
    // Rather than writing the valid ones and reporting a partial success: a
    // teacher fixes the typo and presses save again, and a half-written sheet
    // is how one pupil ends up with last week's mark.
    open();
    const result = await saveMarks(
      "paper-1",
      [mark(), mark({ enrollmentId: "enrol-2", score: 99 })],
      "user-1",
    );
    expect(result).toEqual({ ok: false, reason: "out-of-range" });
    expect(of("assessmentGrade", "upsert")).toEqual([]);
  });

  it("accepts a blank cell, which is a pupil not marked yet", async () => {
    open();
    const result = await saveMarks(
      "paper-1",
      [mark({ score: null })],
      "user-1",
    );
    expect(result).toEqual({ ok: true, saved: 1 });
    expect(written()[0]).toMatchObject({ score: null, isAbsent: false });
  });

  it("rounds a mark to two decimals on the way in", async () => {
    open();
    await saveMarks("paper-1", [mark({ score: 13.250000000000002 })], "user-1");
    expect(written()[0]!["score"]).toBe(13.25);
  });

  // ── An absence is not a zero ───────────────────────────────────────────────

  it("clears the score of a pupil marked absent", async () => {
    // Not stored as zero: a child who was not there has not demonstrated a
    // zero, and `markStatistics` excludes them from the mean on that basis.
    open();
    await saveMarks(
      "paper-1",
      [mark({ score: 12, isAbsent: true })],
      "user-1",
    );
    expect(written()[0]).toMatchObject({ score: null, isAbsent: true });
  });

  it("drops a justification from a pupil who was actually there", async () => {
    // `isExcused` only means anything alongside an absence. Left on a present
    // pupil it is a note about a rattrapage decision that was never made.
    open();
    await saveMarks(
      "paper-1",
      [mark({ isAbsent: false, isExcused: true })],
      "user-1",
    );
    expect(written()[0]!["isExcused"]).toBe(false);
  });

  it("keeps a justification on an absence", async () => {
    open();
    await saveMarks(
      "paper-1",
      [mark({ score: null, isAbsent: true, isExcused: true })],
      "user-1",
    );
    expect(written()[0]).toMatchObject({ isAbsent: true, isExcused: true });
  });

  // ── The roster decides ─────────────────────────────────────────────────────

  it("writes nothing for a pupil who is not on this paper's roster", async () => {
    // The crafted-id case. A mark must not be writable onto another class's
    // pupil, so the roster — not the request — decides which rows exist.
    open();
    const result = await saveMarks(
      "paper-1",
      [mark({ enrollmentId: "enrol-from-another-class" })],
      "user-1",
    );

    expect(result).toEqual({ ok: true, saved: 0 });
    expect(of("assessmentGrade", "upsert")).toEqual([]);
  });

  it("writes the seated pupils and silently drops the rest", async () => {
    open();
    const result = await saveMarks(
      "paper-1",
      [mark(), mark({ enrollmentId: "smuggled", score: 20 })],
      "user-1",
    );

    expect(result).toEqual({ ok: true, saved: 1 });
    expect(written().map((row) => row["enrollmentId"])).toEqual(["enrol-1"]);
  });

  it("reads the roster off the paper's own class, never off the request", async () => {
    open();
    await saveMarks("paper-1", [mark()], "user-1");
    expect(only("enrollment", "findMany").args).toMatchObject({
      where: { schoolClassId: "class-1" },
    });
  });

  it("narrows the roster to the group for a paper set on one", async () => {
    // A language or lab subject taught in halves gets its own paper per group,
    // and the other half must not appear on it.
    open({ classGroupId: "group-a" });
    await saveMarks("paper-1", [mark()], "user-1");
    expect(only("enrollment", "findMany").args).toMatchObject({
      where: { schoolClassId: "class-1", classGroupId: "group-a" },
    });
  });

  it("does not narrow by group for a whole-class paper", async () => {
    open();
    await saveMarks("paper-1", [mark()], "user-1");
    const where = (only("enrollment", "findMany").args as {
      where: Record<string, unknown>;
    }).where;
    expect(where).not.toHaveProperty("classGroupId");
  });

  // ── The trail ──────────────────────────────────────────────────────────────

  it("stamps who marked it and when", async () => {
    // A mark that changes after a report card has gone out is exactly the thing
    // somebody will later ask about.
    open();
    await saveMarks("paper-1", [mark()], "user-7");

    const row = written()[0]!;
    expect(row["gradedById"]).toBe("user-7");
    expect(row["gradedAt"]).toBeInstanceOf(Date);
  });

  it("stamps one time across the whole sheet", async () => {
    open();
    await saveMarks(
      "paper-1",
      [mark(), mark({ enrollmentId: "enrol-2", score: 15 })],
      "user-1",
    );
    const times = written().map((row) => (row["gradedAt"] as Date).getTime());
    expect(new Set(times).size).toBe(1);
  });

  it("writes the same data whether it creates or updates", async () => {
    // One mark per pupil per paper — the second save edits the first. A create
    // and an update that differ is how the two come to disagree.
    open();
    await saveMarks("paper-1", [mark()], "user-1");

    const call = only("assessmentGrade", "upsert").args as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      where: unknown;
    };
    for (const [key, value] of Object.entries(call.update)) {
      expect(call.create[key], key).toEqual(value);
    }
    expect(call.where).toEqual({
      assessmentId_enrollmentId: {
        assessmentId: "paper-1",
        enrollmentId: "enrol-1",
      },
    });
  });

  it("writes an empty sheet without complaint", async () => {
    open();
    expect(await saveMarks("paper-1", [], "user-1")).toEqual({
      ok: true,
      saved: 0,
    });
  });
});

// ── Moving a paper's status ──────────────────────────────────────────────────

// ── Following a pupil who changes class ──────────────────────────────────────

describe("carryGradesToClass", () => {
  /** A mark held on the old class's paper, and the paper's identity. */
  const heldGrade = (
    id: string,
    subjectId: string,
    sequence = 1,
  ): Record<string, unknown> => ({
    id,
    assessment: {
      subjectId,
      termId: "term-1",
      assessmentTypeId: "type-1",
      sequence,
    },
  });

  /** A paper in the new class, with whatever the pupil already holds on it. */
  const paper = (
    id: string,
    subjectId: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id,
    subjectId,
    termId: "term-1",
    assessmentTypeId: "type-1",
    sequence: 1,
    classGroupId: null,
    grades: [],
    ...extra,
  });

  const seatingIn = (to: string) =>
    carryGradesToClass({
      enrollmentId: "enrol-1",
      toClassId: to,
      toClassGroupId: null,
    });

  it("re-points a mark at the same paper in the new class", async () => {
    // The regression this whole function exists for. A mark is keyed on the
    // enrolment but the contrôle it is a mark *on* is keyed on the class, so a
    // pupil who moves in March arrives in 3AP-B with an empty term and a report
    // card computed from the day they walked in.
    answers = {
      "assessmentGrade.findMany": [heldGrade("grade-1", "maths")],
      "assessment.findMany": [paper("paper-b", "maths")],
    };

    expect(await seatingIn("class-b")).toEqual({ moved: 1, left: 0 });
    expect(only("assessmentGrade", "update").args).toMatchObject({
      where: { id: "grade-1" },
      data: { assessmentId: "paper-b" },
    });
  });

  it("matches on the paper's identity, not on its title", async () => {
    // Two schools' contrôles n°1 are the same paper when they are the same
    // subject, term, kind and sequence. Nothing else may decide it — a class
    // that renamed "Contrôle n°1" to "Les fonctions" still holds it.
    answers = {
      "assessmentGrade.findMany": [heldGrade("grade-1", "maths", 2)],
      "assessment.findMany": [paper("paper-b", "maths", { sequence: 1 })],
    };

    // Sequence 2 against a class that has only set n°1: no equivalent yet.
    expect(await seatingIn("class-b")).toEqual({ moved: 0, left: 1 });
    expect(of("assessmentGrade", "update")).toEqual([]);
  });

  it("leaves a mark whose paper the new class never set", async () => {
    // Generating the missing paper would put a contrôle nobody set on the new
    // class's calendar and show every other pupil in it as unmarked. The mark
    // stays where it was earned and goes on counting — see loadClassTermMarks.
    answers = {
      "assessmentGrade.findMany": [
        heldGrade("grade-1", "maths"),
        heldGrade("grade-2", "arabic"),
      ],
      "assessment.findMany": [paper("paper-b", "maths")],
    };

    expect(await seatingIn("class-b")).toEqual({ moved: 1, left: 1 });
    expect(of("assessmentGrade", "update")).toHaveLength(1);
  });

  it("does not overwrite a mark the pupil already holds in the new class", async () => {
    // A pupil coming back to a class they once sat in. The row already on the
    // paper is one somebody entered against it, so nothing is overwritten and
    // nothing is deleted.
    answers = {
      "assessmentGrade.findMany": [heldGrade("grade-1", "maths")],
      "assessment.findMany": [
        paper("paper-b", "maths", { grades: [{ id: "grade-already" }] }),
      ],
    };

    expect(await seatingIn("class-b")).toEqual({ moved: 0, left: 1 });
    expect(of("assessmentGrade", "update")).toEqual([]);
  });

  it("prefers the pupil's own group's paper over the whole-class one", async () => {
    // A subject taught in halves has a paper per group. The pupil sat their
    // group's, not the class-wide one.
    answers = {
      "assessmentGrade.findMany": [heldGrade("grade-1", "french")],
      "assessment.findMany": [
        paper("paper-whole", "french"),
        paper("paper-group", "french", { classGroupId: "group-b1" }),
      ],
    };

    await carryGradesToClass({
      enrollmentId: "enrol-1",
      toClassId: "class-b",
      toClassGroupId: "group-b1",
    });

    expect(only("assessmentGrade", "update").args).toMatchObject({
      data: { assessmentId: "paper-group" },
    });
  });

  it("only ever offers papers of the pupil's own group", async () => {
    // A paper set for a group the pupil is not in is not their paper.
    answers = { "assessmentGrade.findMany": [heldGrade("grade-1", "french")] };
    await carryGradesToClass({
      enrollmentId: "enrol-1",
      toClassId: "class-b",
      toClassGroupId: "group-b1",
    });

    expect(only("assessment", "findMany").args).toMatchObject({
      where: {
        schoolClassId: "class-b",
        OR: [{ classGroupId: null }, { classGroupId: "group-b1" }],
      },
    });
  });

  it("looks nothing up for a pupil with no marks", async () => {
    answers = {};
    expect(await seatingIn("class-b")).toEqual({ moved: 0, left: 0 });
    expect(of("assessment", "findMany")).toEqual([]);
  });
});

describe("setAssessmentStatus", () => {
  it("refuses to validate a sheet that is not finished", async () => {
    // Accepting a paper is the office agreeing the marking is done.
    answers = {
      "assessment.findUnique": {
        schoolClassId: "class-1",
        classGroupId: null,
        term: { schoolYearId: "year-1" },
        grades: [{ enrollmentId: "enrol-1" }],
      },
      "enrollment.findMany": [
        { id: "enrol-1" },
        { id: "enrol-2" },
        { id: "enrol-3" },
      ],
    };

    expect(await setAssessmentStatus("paper-1", "GRADED")).toEqual({
      ok: false,
      reason: "incomplete",
    });
    expect(of("assessment", "update")).toEqual([]);
  });

  it("validates a sheet where everybody is accounted for", async () => {
    answers = {
      "assessment.findUnique": {
        schoolClassId: "class-1",
        classGroupId: null,
        term: { schoolYearId: "year-1" },
        grades: [{ enrollmentId: "a" }, { enrollmentId: "b" }],
      },
      "enrollment.findMany": [{ id: "a" }, { id: "b" }],
    };

    expect(await setAssessmentStatus("paper-1", "GRADED")).toEqual({ ok: true });
    expect(only("assessment", "update").args).toMatchObject({
      where: { id: "paper-1" },
      data: { status: "GRADED" },
    });
  });

  it("counts an absence as accounted for", async () => {
    // A pupil who did not sit the paper has been dealt with — the sheet is
    // finished, and holding validation for them would never resolve.
    answers = {
      "assessment.findUnique": {
        schoolClassId: "class-1",
        classGroupId: null,
        term: { schoolYearId: "year-1" },
        // The query filters on score-or-absent; both rows come back.
        grades: [{ enrollmentId: "a" }, { enrollmentId: "b" }],
      },
      "enrollment.findMany": [{ id: "a" }, { id: "b" }],
    };
    expect(await setAssessmentStatus("paper-1", "GRADED")).toEqual({ ok: true });
  });

  it("counts pending against the roster, not against the rows that exist", async () => {
    // A pupil enrolled after the paper was set has no grade row at all, and is
    // exactly the gap "is this finished?" has to catch.
    answers = {
      "assessment.findUnique": {
        schoolClassId: "class-1",
        classGroupId: null,
        term: { schoolYearId: "year-1" },
        grades: [{ enrollmentId: "a" }],
      },
      "enrollment.findMany": [{ id: "a" }, { id: "b" }],
    };
    expect(await setAssessmentStatus("paper-1", "GRADED")).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });

  it("refuses to send a marked paper back to DRAFT", async () => {
    // DRAFT means "not sat". A paper that is not sat with marks against it is a
    // contradiction somebody would have to unpick later.
    answers = { "assessmentGrade.count": 4 };

    expect(await setAssessmentStatus("paper-1", "DRAFT")).toEqual({
      ok: false,
      reason: "has-marks",
    });
    expect(of("assessment", "update")).toEqual([]);
  });

  it("allows DRAFT again while nothing has been entered", async () => {
    answers = { "assessmentGrade.count": 0 };
    expect(await setAssessmentStatus("paper-1", "DRAFT")).toEqual({ ok: true });
  });

  it("cancels a paper whatever has been marked on it", async () => {
    // Cancelling keeps the row and the marks — it says the paper counts
    // nowhere, not that it never existed. Which is also what stops the
    // generator silently recreating it.
    answers = { "assessmentGrade.count": 30 };
    expect(await setAssessmentStatus("paper-1", "CANCELLED")).toEqual({ ok: true });
    expect(only("assessment", "update").args).toMatchObject({
      data: { status: "CANCELLED" },
    });
  });

  it("checks nothing for the moves that lose nothing", async () => {
    // PUBLISHED and SUBMITTED neither discard marks nor claim the sheet is
    // finished, so they need no guard — and a guard there would make handing a
    // paper back a two-step ceremony.
    for (const status of ["PUBLISHED", "SUBMITTED"]) {
      calls.length = 0;
      expect(await setAssessmentStatus("paper-1", status), status).toEqual({
        ok: true,
      });
      expect(of("assessmentGrade", "count"), status).toEqual([]);
    }
  });
});

// ── Generating a round ───────────────────────────────────────────────────────

const CLASS = { id: "class-1", schoolId: "school-1" };
const TYPE = {
  id: "type-1",
  name: "Contrôle continu",
  defaultCoefficient: 2,
  defaultMaxScore: 20,
  gradesWholeSubject: false,
};

const subjectRow = (
  id: string,
  { parentId = null as string | null, trackId = null as string | null } = {},
) => ({
  trackId,
  coefficient: 4,
  subject: { id, code: id.toUpperCase(), name: id, parentId },
});

describe("generateAssessments", () => {
  const setup = ({
    subjects = [subjectRow("maths")],
    assignments = [{ subjectId: "maths", teacherId: "teacher-1" }],
    existing = [] as { subjectId: string; scopeKey: string }[],
    type = TYPE,
  } = {}) => {
    answers = {
      "schoolClass.findUnique": {
        ...CLASS,
        levelOffering: { levelId: "level-1", trackId: null },
      },
      "assessmentType.findFirst": type,
      "levelSubject.findMany": subjects,
      "assessment.findMany": existing,
      "teachingAssignment.findMany": assignments,
    };
  };

  const run = (targets: GenerateTarget[]) =>
    generateAssessments({
      schoolClassId: "class-1",
      termId: "term-1",
      assessmentTypeId: "type-1",
      sequence: 1,
      targets,
      createdById: "user-1",
    });

  const target = (subjectId: string, notes: string | null = null) => ({
    subjectId,
    scheduledOn: null,
    notes,
  });

  it("writes one paper for a subject on the programme", async () => {
    setup();
    const result = await run([target("maths")]);

    expect(result).toMatchObject({ created: 1, skipped: 0, unstaffed: [] });
    const rows = (only("assessment", "createMany").args as {
      data: Record<string, unknown>[];
    }).data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      schoolClassId: "class-1",
      subjectId: "maths",
      termId: "term-1",
      sequence: 1,
      status: "DRAFT",
      teacherId: "teacher-1",
    });
  });

  it("takes the school from the class, never from the request", async () => {
    // The invariant on Assessment.schoolId. Taken from the form it would be the
    // way to file a paper into another tenant.
    setup();
    await run([target("maths")]);
    const rows = (only("assessment", "createMany").args as {
      data: Record<string, unknown>[];
    }).data;
    expect(rows[0]!["schoolId"]).toBe("school-1");
  });

  it("copies the scale and the weight off the type rather than referencing it", async () => {
    // So that re-weighting the type next year cannot silently rescore marks
    // already entered against it.
    setup();
    await run([target("maths")]);
    const rows = (only("assessment", "createMany").args as {
      data: Record<string, unknown>[];
    }).data;
    expect(rows[0]).toMatchObject({ maxScore: 20, coefficient: 2 });
  });

  it("creates papers as DRAFT, because generating is planning", async () => {
    setup();
    await run([target("maths")]);
    const rows = (only("assessment", "createMany").args as {
      data: Record<string, unknown>[];
    }).data;
    expect(rows[0]!["status"]).toBe("DRAFT");
  });

  it("writes nothing for a subject that is not on the class's programme", async () => {
    // The picker offers the programme, so anything else was crafted.
    setup();
    const result = await run([target("astrophysique")]);

    expect(result.created).toBe(0);
    expect(of("assessment", "createMany")).toEqual([]);
  });

  it("refuses a subject nobody teaches rather than writing it unattributed", async () => {
    // A paper with no teacher shows on the calendar, opens no mark sheet, and
    // leaves the subject short at moyenne time. Refusing is louder.
    setup({ assignments: [] });
    const result = await run([target("maths")]);

    expect(result).toMatchObject({ created: 0, unstaffed: ["maths"] });
    expect(of("assessment", "createMany")).toEqual([]);
  });

  it("writes what it can and names what it could not", async () => {
    setup({
      subjects: [subjectRow("maths"), subjectRow("svt")],
      assignments: [{ subjectId: "maths", teacherId: "teacher-1" }],
    });
    const result = await run([target("maths"), target("svt")]);

    expect(result).toMatchObject({ created: 1, unstaffed: ["svt"] });
    expect(result.subjects).toEqual(["maths"]);
  });

  it("is a no-op on a second run", async () => {
    // The unique index makes it safe; reporting it as skipped is what lets a
    // head of studies who is unsure simply run it again.
    setup({ existing: [{ subjectId: "maths", scopeKey: "__class__" }] });
    const result = await run([target("maths")]);

    expect(result).toMatchObject({ created: 0, skipped: 1, unstaffed: [] });
    expect(of("assessment", "createMany")).toEqual([]);
  });

  it("does not count an existing group paper as the whole class's", async () => {
    // A paper for one half of a split subject is not the class's paper.
    setup({ existing: [{ subjectId: "maths", scopeKey: "group-a" }] });
    const result = await run([target("maths")]);
    expect(result.created).toBe(1);
  });

  it("does not report an unstaffed subject as skipped", async () => {
    // Two different outcomes needing two different next actions: "already
    // generated" and "go and fill the post".
    setup({ assignments: [] });
    const result = await run([target("maths")]);
    expect(result.skipped).toBe(0);
    expect(result.unstaffed).toEqual(["maths"]);
  });

  it("keeps a paper already generated even if the post has since been vacated", async () => {
    // Undoing that is a deletion, and deletions are somebody's explicit
    // decision.
    setup({
      existing: [{ subjectId: "maths", scopeKey: "__class__" }],
      assignments: [],
    });
    const result = await run([target("maths")]);
    expect(result).toMatchObject({ created: 0, skipped: 1, unstaffed: [] });
  });

  // ── A matière and its components ───────────────────────────────────────────

  it("offers the matière and its components, whatever the kind", async () => {
    /*
      Both halves, always.

      It used to depend on the kind: a devoir resolved the components and a
      contrôle the matières, so whichever half the kind was not sat on was not
      merely unticked but absent — a school running one contrôle on الإملاء
      alone had no way to say so, and the picker showed a heading nobody could
      tick. Which half is ticked *by default* is still the kind's business, and
      that lives in the dialog.
    */
    setup({
      subjects: [
        subjectRow("arabe"),
        subjectRow("imla", { parentId: "arabe" }),
      ],
      assignments: [{ subjectId: "arabe", teacherId: "teacher-1" }],
    });

    const programme = await resolveProgramme("class-1");
    expect(programme.map((entry) => entry.subjectId).sort()).toEqual([
      "arabe",
      "imla",
    ]);
  });

  it("writes what each paper covers, per subject", async () => {
    /*
      Per subject, not per round.

      One round is one week on the calendar but six different chapters, so a
      note carried on the run rather than the target would be true of none of
      the papers it landed on.
    */
    setup({
      subjects: [subjectRow("maths"), subjectRow("svt")],
      assignments: [
        { subjectId: "maths", teacherId: "teacher-1" },
        { subjectId: "svt", teacherId: "teacher-1" },
      ],
    });

    await run([
      target("maths", "Leçon 3, p.42"),
      target("svt", "La respiration"),
    ]);

    const written = (only("assessment", "createMany").args as {
      data: { subjectId: string; notes: string | null }[];
    }).data;
    expect(
      Object.fromEntries(written.map((row) => [row.subjectId, row.notes])),
    ).toEqual({ maths: "Leçon 3, p.42", svt: "La respiration" });
  });

  it("leaves the note null when none was typed", async () => {
    setup();
    await run([target("maths")]);

    const written = (only("assessment", "createMany").args as {
      data: { notes: string | null }[];
    }).data;
    expect(written[0].notes).toBeNull();
  });

  it("writes a component's paper on its own when that is what was ticked", async () => {
    // The case the widening exists for: one contrôle on الإملاء alone, with the
    // matière left alone.
    setup({
      subjects: [
        subjectRow("arabe"),
        subjectRow("imla", { parentId: "arabe" }),
      ],
      assignments: [{ subjectId: "arabe", teacherId: "teacher-1" }],
      type: { ...TYPE, gradesWholeSubject: true },
    });

    const result = await run([target("imla")]);
    expect(result.subjects).toEqual(["imla"]);
    expect(result.created).toBe(1);
  });

  it("never marks a matière and its own component in one run", async () => {
    // The picker keeps them exclusive, but a Server Function is reachable by
    // direct POST and the consequence of trusting the request is a
    // double-counted matière at moyenne time. The matière wins.
    setup({
      subjects: [
        subjectRow("arabe"),
        subjectRow("imla", { parentId: "arabe" }),
      ],
      assignments: [{ subjectId: "arabe", teacherId: "teacher-1" }],
      type: { ...TYPE, gradesWholeSubject: true },
    });

    const result = await run([target("arabe"), target("imla")]);
    expect(result.subjects).toEqual(["arabe"]);
    expect(result.created).toBe(1);
  });

  it("falls back to the matière's teacher for a component's paper", async () => {
    // Assignments are made against the subject as taught — "Karim teaches
    // Arabic to 1AP-A" — while the papers are per component. Without the
    // fallback every component paper in the school comes out unattributed.
    setup({
      subjects: [
        subjectRow("arabe"),
        subjectRow("imla", { parentId: "arabe" }),
      ],
      assignments: [{ subjectId: "arabe", teacherId: "teacher-1" }],
    });

    await run([target("imla")]);
    const rows = (only("assessment", "createMany").args as {
      data: Record<string, unknown>[];
    }).data;
    expect(rows[0]).toMatchObject({ subjectId: "imla", teacherId: "teacher-1" });
  });

  // ── Cross-tenant ──────────────────────────────────────────────────────────

  it("writes nothing for a class that does not exist", async () => {
    expect(await run([target("maths")])).toMatchObject({ created: 0 });
    expect(of("assessment", "createMany")).toEqual([]);
  });

  it("refuses a kind of paper belonging to another school", async () => {
    // Looked up under the class's own school, so one school's weighting cannot
    // leak into another's marks.
    setup();
    answers["assessmentType.findFirst"] = null;

    expect(await run([target("maths")])).toMatchObject({ created: 0 });
    expect(only("assessmentType", "findFirst").args).toMatchObject({
      where: { id: "type-1", schoolId: "school-1" },
    });
  });

  it("takes only the primary holder, so a co-taught subject gets one paper", async () => {
    setup();
    await run([target("maths")]);
    expect(only("teachingAssignment", "findMany").args).toMatchObject({
      where: { schoolClassId: "class-1", isPrimary: true },
    });
  });
});

// ── The programme, resolved for a class ──────────────────────────────────────

describe("resolveProgramme", () => {
  it("takes this track's rows and the ones that apply to every track", async () => {
    answers = {
      "schoolClass.findUnique": {
        levelOffering: { levelId: "level-1", trackId: "sm" },
      },
      "levelSubject.findMany": [
        subjectRow("arabe"),
        subjectRow("maths", { trackId: "sm" }),
      ],
    };

    const programme = await resolveProgramme("class-1");
    expect(programme.map((entry) => entry.subjectId)).toEqual(["arabe", "maths"]);
    expect(only("levelSubject", "findMany").args).toMatchObject({
      where: {
        levelId: "level-1",
        isGraded: true,
        OR: [{ trackId: null }, { trackId: "sm" }],
      },
    });
  });

  it("asks for no track's rows when the class has no track", async () => {
    answers = {
      "schoolClass.findUnique": {
        levelOffering: { levelId: "level-1", trackId: null },
      },
    };
    await resolveProgramme("class-1");
    expect(only("levelSubject", "findMany").args).toMatchObject({
      where: { OR: [{ trackId: null }] },
    });
  });

  it("lists a subject declared both ways exactly once", async () => {
    // The unique index permits a level-wide row and a track row for the same
    // subject. Left as a union the generator's picker showed it twice.
    answers = {
      "schoolClass.findUnique": {
        levelOffering: { levelId: "level-1", trackId: "sm" },
      },
      "levelSubject.findMany": [
        { ...subjectRow("maths"), coefficient: 4 },
        { ...subjectRow("maths", { trackId: "sm" }), coefficient: 7 },
      ],
    };

    const programme = await resolveProgramme("class-1");
    expect(programme).toHaveLength(1);
    expect(programme[0]).toMatchObject({ subjectId: "maths", coefficient: 7 });
  });

  it("leaves out the ungraded slots that are timetabled but never averaged", async () => {
    answers = {
      "schoolClass.findUnique": {
        levelOffering: { levelId: "level-1", trackId: null },
      },
    };
    await resolveProgramme("class-1");
    expect(only("levelSubject", "findMany").args).toMatchObject({
      where: { isGraded: true, subject: { isActive: true } },
    });
  });

  it("answers nothing for a class that does not exist", async () => {
    expect(await resolveProgramme("nowhere")).toEqual([]);
    expect(of("levelSubject", "findMany")).toEqual([]);
  });
});

/**
 * The appréciation scale — the word that goes next to the mark.
 *
 * What matters about it is that it is gapless and denominator-independent: a
 * rung holds only its floor and takes its ceiling from the rung above, and the
 * mark is compared as a *share* of the paper, because `maxScore` is per paper.
 * Both are the sort of thing that looks right on a scale out of 20 and turns
 * out to be wrong the first time somebody marks an oral out of 10.
 */
describe("the appréciation scale", () => {
  const scale = DEFAULT_APPRECIATION_BANDS;

  it("puts a mark on the highest rung it clears", () => {
    expect(appreciationFor(19, 20, scale)?.label).toBe("Excellent");
    expect(appreciationFor(16.5, 20, scale)?.label).toBe("Très bien");
    expect(appreciationFor(12, 20, scale)?.label).toBe("Assez bien");
    expect(appreciationFor(4, 20, scale)?.label).toBe("Insuffisant");
  });

  it("lands a rung exactly on its own floor", () => {
    // 90% of 20 is 18, and the rung starting at 90% must claim it rather than
    // leave it to the one below.
    expect(appreciationFor(18, 20, scale)?.label).toBe("Excellent");
    expect(appreciationFor(17.9, 20, scale)?.label).toBe("Très bien");
  });

  it("reads the same rung whatever the paper is marked out of", () => {
    // The same performance — 85% — on an oral out of 10 and a paper out of 20.
    expect(appreciationFor(8.5, 10, scale)?.label).toBe(
      appreciationFor(17, 20, scale)?.label,
    );
    expect(appreciationFor(85, 100, scale)?.label).toBe("Très bien");
  });

  it("suggests nothing for a pupil who has no mark", () => {
    expect(appreciationFor(null, 20, scale)).toBeNull();
  });

  it("suggests nothing when the scale does not reach the mark", () => {
    // A scale whose lowest rung starts at 50% says nothing about a 4/20 —
    // inventing the bottom rung would be a statement the school never made.
    const partial = [{ minPercentBps: 5000, label: "Passable" }];
    expect(appreciationFor(4, 20, partial)).toBeNull();
    expect(appreciationFor(14, 20, partial)?.label).toBe("Passable");
  });

  it("says nothing rather than dividing by a paper marked out of nothing", () => {
    expect(appreciationFor(0, 0, scale)).toBeNull();
  });

  it("ships a scale that covers every mark from 0 up", () => {
    // The floor at 0 is what makes the scale gapless — without it the weakest
    // marks silently get no remark. Guarded because it is one edited constant
    // away from being untrue.
    expect(scale.some((band) => band.minPercentBps === 0)).toBe(true);
    expect(new Set(scale.map((band) => band.minPercentBps)).size).toBe(
      scale.length,
    );
    expect(scale.length).toBeLessThanOrEqual(MAX_APPRECIATION_BANDS);
  });

  it("reads a scale highest first, however it was stored", () => {
    const shuffled = [...scale].sort((a, b) => a.minPercentBps - b.minPercentBps);
    expect(sortBands(shuffled).map((band) => band.minPercentBps)).toEqual(
      scale.map((band) => band.minPercentBps),
    );
    // The order it is read in must not change which rung a mark lands on.
    expect(appreciationFor(19, 20, shuffled)?.label).toBe("Excellent");
  });
});

// ── Pairing a paper with a MASSAR sheet ──────────────────────────────────────

describe("massarCodeSchema", () => {

  it("accepts the id off a NotesCC sheet", () => {
    const parsed = massarCodeSchema().safeParse({
      massarCode: "9f1c0b6e-1f4a-4e2c-9a77-0b1d2e3f4a5b",
    });
    expect(parsed.success && parsed.data.massarCode).toBe(
      "9f1c0b6e-1f4a-4e2c-9a77-0b1d2e3f4a5b",
    );
  });

  it("reads a blank box as no code rather than as an empty one", () => {
    // Load-bearing: null is the ADOPTABLE state that lets the next import claim
    // the paper, and "" would be a code no sheet will ever carry — see the
    // ASSESSMENT_IDENTITY check in modules/massar/checks.ts.
    const parsed = massarCodeSchema().safeParse({ massarCode: "" });
    expect(parsed.success && parsed.data.massarCode).toBeNull();
  });

  it("refuses something longer than any ministry id", () => {
    const parsed = massarCodeSchema().safeParse({
      massarCode: "x".repeat(65),
    });
    expect(parsed.success).toBe(false);
  });
});
