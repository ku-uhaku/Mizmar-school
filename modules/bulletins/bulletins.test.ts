import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionaryFor } from "@/lib/i18n/server";
import {
  BULLETIN_STATUSES,
  COUNCIL_DECISIONS,
  FAMILY_VISIBLE_STATUSES,
  MENTIONS,
  MENTION_THRESHOLD_BPS,
  acceptsRecompute,
  isPublished,
  rankValues,
  roundAverage,
  spreadOf,
  suggestMention,
  weightedAverage,
  yearAverageOf,
} from "@/modules/bulletins/enums";
import { councilSchema } from "@/modules/bulletins/validation";

/**
 * Le bulletin — a document, not a view.
 *
 * The whole module exists to keep one promise: what the school issued is what
 * the school issued. So what is tested here is the handful of rules that keep
 * that true, and the arithmetic a parent will check by hand —
 *
 *   * **a published bulletin is never recomputed.** A mark corrected in April
 *     must not rewrite the December document a family is holding;
 *   * **a recomputation refreshes the figures and never the words.** The
 *     appreciations, the mention and the council's note are a person's;
 *   * **only matières enter the general average.** Counting a component too
 *     would count Arabic twice — once at coefficient 6 and again as its parts;
 *   * **ties share a rank and the next one skips**, because that is how a
 *     parent will count the class list;
 *   * **a pupil with no marks is unranked, not last**, which is an assertion
 *     the school has no evidence for;
 *   * **the council's decision is theirs**, so a mention is suggested and never
 *     written on their behalf.
 */

// ─────────────────────────────────────────────────────────────────────────────

type Call = { model: string; op: string; args: Record<string, unknown> };

const calls: Call[] = [];
let answers: Record<string, unknown> = {};

const EMPTY: Record<string, unknown> = {
  findMany: [],
  count: 0,
  findFirst: null,
  findUnique: null,
  aggregate: {},
  updateMany: { count: 0 },
  deleteMany: { count: 0 },
  update: {},
  upsert: { id: "bulletin-1" },
};

const db = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_d, op: string) => async (args: Record<string, unknown>) => {
            calls.push({ model, op, args });
            const key = `${model}.${op}`;
            if (key in answers) {
              const answer = answers[key];
              return typeof answer === "function" ? answer(args) : answer;
            }
            return op in EMPTY ? EMPTY[op] : null;
          },
        },
      ),
  },
);

vi.mock("@/lib/db", () => ({ db, auditClient: {} }));

const {
  computeClassBulletins,
  saveAppreciation,
  saveCouncilDecision,
  setClassPublication,
} = await import("@/modules/bulletins/service");

const of = (model: string, op: string) =>
  calls.filter((call) => call.model === model && call.op === op);

/** Just enough AuthContext for the service, which reads the school and scale. */
const context = {
  user: { id: "user-1" },
  currentSchool: { id: "school-1" },
  settings: { gradingMaxScore: 20, passMarkBps: 5000 },
} as unknown as Parameters<typeof computeClassBulletins>[0];

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

// ── The freeze ───────────────────────────────────────────────────────────────

describe("a published bulletin is a document, not a view", () => {
  it("accepts recomputation on a draft and nowhere else", () => {
    expect(BULLETIN_STATUSES.filter(acceptsRecompute)).toEqual(["DRAFT"]);
  });

  it("shows a family the issued ones only", () => {
    expect(FAMILY_VISIBLE_STATUSES).toEqual(["PUBLISHED"]);
    expect(BULLETIN_STATUSES.filter(isPublished)).toEqual(["PUBLISHED"]);
  });

  it("says nothing about a status it has never heard of", () => {
    for (const nonsense of ["", "draft", "ISSUED", "__proto__"]) {
      expect(acceptsRecompute(nonsense), nonsense).toBe(false);
      expect(isPublished(nonsense), nonsense).toBe(false);
    }
  });

  it("refuses an appreciation once the family is holding the bulletin", async () => {
    answers["bulletinLine.findFirst"] = {
      id: "line-1",
      bulletin: { status: "PUBLISHED" },
    };

    const result = await saveAppreciation(context, "line-1", "Bon trimestre.");

    expect(result).toEqual({ ok: false, reason: "published" });
    expect(of("bulletinLine", "update")).toHaveLength(0);
  });

  it("refuses a council decision on a published bulletin", async () => {
    answers["bulletin.findFirst"] = { id: "b-1", status: "PUBLISHED" };

    const result = await saveCouncilDecision(context, "b-1", {
      mention: "FELICITATIONS",
      decision: null,
      councilComment: null,
      mainTeacherComment: null,
    });

    expect(result).toEqual({ ok: false, reason: "published" });
    expect(of("bulletin", "update")).toHaveLength(0);
  });

  it("scopes a line to the school through its bulletin", async () => {
    // BulletinLine carries no schoolId of its own, so the scope has to be
    // applied to the row that does. A crafted line id must reach nothing.
    await saveAppreciation(context, "line-from-elsewhere", null);

    const [lookup] = of("bulletinLine", "findFirst");
    expect(lookup.args).toMatchObject({
      where: { id: "line-from-elsewhere", bulletin: { schoolId: "school-1" } },
    });
  });
});

// ── What a recomputation may touch ───────────────────────────────────────────

describe("the figures are the machine's, the words are a person's", () => {
  /** A one-pupil class with one subject and one mark, ready to compute. */
  function oneClass(existing: { id: string; status: string } | null = null) {
    answers["schoolClass.findFirst"] = {
      id: "class-1",
      levelOffering: { schoolYearId: "year-1" },
    };
    // `resolveProgramme` reaches the class for its level and track separately.
    answers["schoolClass.findUnique"] = {
      levelOffering: { levelId: "level-1", trackId: null },
    };
    answers["term.findUnique"] = {
      id: "term-1",
      schoolYearId: "year-1",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-01-31"),
    };
    answers["enrollment.findMany"] = [
      { id: "enrol-1", bulletins: existing ? [existing] : [] },
    ];
    answers["levelSubject.findMany"] = [
      {
        trackId: null,
        coefficient: 4,
        subject: { id: "maths", code: "MATH", name: "Mathématiques", parentId: null },
      },
    ];
    answers["assessmentGrade.findMany"] = [
      {
        enrollmentId: "enrol-1",
        score: 15,
        assessment: { subjectId: "maths", maxScore: 20, coefficient: 1 },
      },
    ];
    answers["teachingAssignment.findMany"] = [];
    answers["studentAttendance.findMany"] = [];
  }

  it("writes the figures without touching what anybody wrote", async () => {
    oneClass({ id: "b-1", status: "DRAFT" });

    const result = await computeClassBulletins(context, "class-1", "term-1");
    expect(result).toEqual({ ok: true, computed: 1, skipped: 0 });

    const [upsert] = of("bulletin", "upsert");
    const written = {
      ...(upsert.args.create as Record<string, unknown>),
      ...(upsert.args.update as Record<string, unknown>),
    };

    // The four columns a person owns are absent from both halves of the upsert.
    for (const owned of [
      "mention",
      "decision",
      "councilComment",
      "mainTeacherComment",
    ]) {
      expect(written, owned).not.toHaveProperty(owned);
    }
    // And the figures are there.
    expect(written).toMatchObject({ generalAverage: 15, rank: 1, classSize: 1 });
  });

  it("leaves a line's appreciation alone when it recomputes the mark", async () => {
    oneClass({ id: "b-1", status: "DRAFT" });
    await computeClassBulletins(context, "class-1", "term-1");

    const [upsert] = of("bulletinLine", "upsert");
    const written = {
      ...(upsert.args.create as Record<string, unknown>),
      ...(upsert.args.update as Record<string, unknown>),
    };

    expect(written).not.toHaveProperty("appreciation");
    expect(written).toMatchObject({ average: 15, coefficient: 4, markCount: 1 });
  });

  it("skips a published pupil and still counts them in the class", async () => {
    oneClass({ id: "b-1", status: "PUBLISHED" });

    const result = await computeClassBulletins(context, "class-1", "term-1");

    expect(result).toEqual({ ok: true, computed: 0, skipped: 1 });
    expect(of("bulletin", "upsert")).toHaveLength(0);
  });

  it("copies the subject's name onto the line rather than joining it", async () => {
    oneClass();
    await computeClassBulletins(context, "class-1", "term-1");

    const [upsert] = of("bulletinLine", "upsert");
    expect(upsert.args.create).toMatchObject({
      subjectName: "Mathématiques",
      subjectId: "maths",
    });
  });

  it("drops a line whose subject has left the programme", async () => {
    oneClass();
    await computeClassBulletins(context, "class-1", "term-1");

    const [cleanup] = of("bulletinLine", "deleteMany");
    expect(cleanup.args).toMatchObject({
      where: { bulletinId: "bulletin-1", subjectId: { notIn: ["maths"] } },
    });
  });

  it("refuses a term belonging to another year", async () => {
    oneClass();
    answers["term.findUnique"] = {
      id: "term-1",
      schoolYearId: "another-year",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-01-31"),
    };

    const result = await computeClassBulletins(context, "class-1", "term-1");

    expect(result).toEqual({ ok: false, reason: "term-mismatch" });
    expect(of("bulletin", "upsert")).toHaveLength(0);
  });

  it("re-derives the school from the session, never from the request", async () => {
    oneClass();
    await computeClassBulletins(context, "class-from-elsewhere", "term-1");

    const [lookup] = of("schoolClass", "findFirst");
    expect(lookup.args).toMatchObject({
      where: { id: "class-from-elsewhere", schoolId: "school-1" },
    });
  });

  it("publishes and withdraws a whole class at a time", async () => {
    answers["schoolClass.findFirst"] = { id: "class-1" };
    answers["bulletin.updateMany"] = { count: 3 };

    await setClassPublication(context, "class-1", "term-1", true);
    const [publish] = of("bulletin", "updateMany");
    expect(publish.args).toMatchObject({
      where: { schoolClassId: "class-1", termId: "term-1", status: "DRAFT" },
      data: { status: "PUBLISHED", publishedById: "user-1" },
    });

    calls.length = 0;
    await setClassPublication(context, "class-1", "term-1", false);
    const [withdraw] = of("bulletin", "updateMany");
    expect(withdraw.args).toMatchObject({
      where: { status: "PUBLISHED" },
      // Cleared rather than kept: a stamp left on a draft would be read by the
      // print header as an issue date.
      data: { status: "DRAFT", publishedAt: null, publishedById: null },
    });
  });
});

// ── Components, and the double-counting they invite ──────────────────────────

describe("a matière marked through its components", () => {
  /**
   * 3AP: اللغة العربية at coefficient 6, marked through القراءة (2) and
   * الإملاء (1), plus Mathématiques at coefficient 4 marked directly.
   */
  function withComponents() {
    answers["schoolClass.findFirst"] = {
      id: "class-1",
      levelOffering: { schoolYearId: "year-1" },
    };
    answers["schoolClass.findUnique"] = {
      levelOffering: { levelId: "level-1", trackId: null },
    };
    answers["term.findUnique"] = {
      id: "term-1",
      schoolYearId: "year-1",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-01-31"),
    };
    answers["enrollment.findMany"] = [{ id: "enrol-1", bulletins: [] }];
    answers["levelSubject.findMany"] = [
      {
        trackId: null,
        coefficient: 6,
        subject: { id: "ar", code: "AR", name: "اللغة العربية", parentId: null },
      },
      {
        trackId: null,
        coefficient: 2,
        subject: { id: "read", code: "AR-L", name: "القراءة", parentId: "ar" },
      },
      {
        trackId: null,
        coefficient: 1,
        subject: { id: "dict", code: "AR-D", name: "الإملاء", parentId: "ar" },
      },
      {
        trackId: null,
        coefficient: 4,
        subject: { id: "maths", code: "MATH", name: "Mathématiques", parentId: null },
      },
    ];
    answers["assessmentGrade.findMany"] = [
      {
        enrollmentId: "enrol-1",
        score: 12,
        assessment: { subjectId: "read", maxScore: 20, coefficient: 1 },
      },
      {
        enrollmentId: "enrol-1",
        score: 18,
        assessment: { subjectId: "dict", maxScore: 20, coefficient: 1 },
      },
      {
        enrollmentId: "enrol-1",
        score: 10,
        assessment: { subjectId: "maths", maxScore: 20, coefficient: 1 },
      },
    ];
    answers["teachingAssignment.findMany"] = [];
    answers["studentAttendance.findMany"] = [];
  }

  /** The line written for one subject, out of the upsert calls. */
  const lineFor = (subjectId: string) => {
    const call = of("bulletinLine", "upsert").find(
      (entry) =>
        (entry.args.create as { subjectId: string }).subjectId === subjectId,
    );
    return call?.args.create as Record<string, unknown> | undefined;
  };

  it("builds the matière's mark out of its components' coefficients", async () => {
    withComponents();
    await computeClassBulletins(context, "class-1", "term-1");

    // (12 × 2 + 18 × 1) ÷ 3 = 14 — the components' own weights, not equal ones,
    // which would give 15.
    expect(lineFor("ar")).toMatchObject({ average: 14, coefficient: 6 });
  });

  it("counts a component's marks toward its matière's tally", async () => {
    withComponents();
    await computeClassBulletins(context, "class-1", "term-1");

    // "14, out of 2 marks" — the two papers actually sat, under whichever
    // heading. A matière reporting nought marks beside an average is the sort
    // of thing a parent rings up about.
    expect(lineFor("ar")).toMatchObject({ markCount: 2 });
  });

  it("keeps a component's coefficient out of the general average", async () => {
    withComponents();
    await computeClassBulletins(context, "class-1", "term-1");

    // Only the two matières weigh: (14 × 6 + 10 × 4) ÷ 10 = 12.4.
    //
    // Were the components added too, the divisor would be 13 and Arabic would
    // be counted twice — once at coefficient 6 and again as its parts. That is
    // exactly what the note on LevelSubject forbids, and it is invisible in the
    // result unless somebody checks the number.
    const [upsert] = of("bulletin", "upsert");
    expect(upsert.args.create).toMatchObject({ generalAverage: 12.4 });
  });

  it("still writes a line for each component, for the printed page", async () => {
    withComponents();
    await computeClassBulletins(context, "class-1", "term-1");

    // They are shown, indented under their matière — they simply do not weigh
    // at the top level. `parentSubjectId` is what the page indents on.
    expect(lineFor("read")).toMatchObject({
      average: 12,
      parentSubjectId: "ar",
    });
    expect(lineFor("dict")).toMatchObject({
      average: 18,
      parentSubjectId: "ar",
    });
    expect(of("bulletinLine", "upsert")).toHaveLength(4);
  });
});

// ── The arithmetic ───────────────────────────────────────────────────────────

describe("the weighted average", () => {
  it("weights by coefficient", () => {
    // 15 at coefficient 4 and 10 at coefficient 1 → 14, not 12.5.
    expect(
      weightedAverage([
        { value: 15, weight: 4 },
        { value: 10, weight: 1 },
      ]),
    ).toBe(14);
  });

  it("is null when nothing carries any weight", () => {
    expect(weightedAverage([])).toBeNull();
    expect(weightedAverage([{ value: 15, weight: 0 }])).toBeNull();
  });

  it("rounds to two decimals, like every other mark in the app", () => {
    expect(
      weightedAverage([
        { value: 13.333333, weight: 1 },
        { value: 14, weight: 2 },
      ]),
    ).toBe(13.78);
    expect(roundAverage(13.250000000000002)).toBe(13.25);
  });
});

describe("counting a class", () => {
  it("averages the pupils, not their papers", () => {
    // Unweighted: a pupil is one pupil however many papers they sat.
    expect(spreadOf([10, 20])).toEqual({
      average: 15,
      lowest: 10,
      highest: 20,
    });
  });

  it("ignores pupils with no average rather than reading them as zero", () => {
    expect(spreadOf([12, null, 16])).toEqual({
      average: 14,
      lowest: 12,
      highest: 16,
    });
    expect(spreadOf([null, null])).toEqual({
      average: null,
      lowest: null,
      highest: null,
    });
  });
});

describe("the rank", () => {
  it("orders best first", () => {
    expect(rankValues([12, 18, 15])).toEqual([3, 1, 2]);
  });

  it("shares a rank on a tie and skips the next", () => {
    // Two pupils second equal, and the next one is fourth — which is what a
    // parent counting down the class list will find.
    expect(rankValues([16, 15.4, 15.4, 15.1])).toEqual([1, 2, 2, 4]);
  });

  it("ties on the figure that is printed, not the one in memory", () => {
    // Both print as 15.40. Ranking them apart is a distinction the document
    // cannot show and the office cannot defend.
    expect(rankValues([15.404, 15.396])).toEqual([1, 1]);
  });

  it("leaves a pupil with no average unranked rather than last", () => {
    expect(rankValues([14, null, 12])).toEqual([1, null, 2]);
    expect(rankValues([null, null])).toEqual([null, null]);
  });
});

describe("the year average", () => {
  it("is the mean of the terms, not of every mark", () => {
    // A pupil who sat twice as many papers in the second semester must not have
    // it count twice as much.
    expect(
      yearAverageOf([{ generalAverage: 12 }, { generalAverage: 16 }]),
    ).toBe(14);
  });

  it("is null when no term has an average", () => {
    expect(yearAverageOf([])).toBeNull();
    expect(yearAverageOf([{ generalAverage: null }])).toBeNull();
  });
});

// ── The council's own decisions ──────────────────────────────────────────────

describe("a mention is awarded, not calculated", () => {
  it("suggests one from the ratio, so any scale works", () => {
    expect(suggestMention(16, 20)).toBe("FELICITATIONS");
    expect(suggestMention(8, 10)).toBe("FELICITATIONS");
    expect(suggestMention(80, 100)).toBe("FELICITATIONS");
  });

  it("walks the bands best first", () => {
    expect(suggestMention(15.9, 20)).toBe("ENCOURAGEMENTS");
    expect(suggestMention(13.9, 20)).toBe("TABLEAU_HONNEUR");
    expect(suggestMention(11.9, 20)).toBeNull();
  });

  it("never proposes a warning", () => {
    // AVERTISSEMENT is a judgement about a term's work, not a band an average
    // falls into — proposing it would put one on a bulletin because a pupil was
    // ill for two papers.
    expect(MENTION_THRESHOLD_BPS.AVERTISSEMENT).toBeUndefined();
    for (const average of [0, 4, 9.9]) {
      expect(suggestMention(average, 20), String(average)).toBeNull();
    }
  });

  it("proposes nothing without an average, or on a broken scale", () => {
    expect(suggestMention(null, 20)).toBeNull();
    expect(suggestMention(14, 0)).toBeNull();
  });

  it("only ever names a mention the catalogue holds", () => {
    for (const average of [0, 5, 12, 14, 16, 20]) {
      const mention = suggestMention(average, 20);
      if (mention !== null) expect(MENTIONS).toContain(mention);
    }
  });
});

describe("what the council may submit", () => {
  const t = getDictionaryFor("en");

  it("takes a blank mention and a blank decision as real answers", () => {
    // "No mention" and "not decided" are states, not omissions — only the last
    // term asks the second question at all.
    const parsed = councilSchema(t).safeParse({
      id: "b-1",
      mention: "",
      decision: "",
      councilComment: "",
      mainTeacherComment: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ mention: null, decision: null });
  });

  it("refuses a mention or a decision outside the catalogue", () => {
    for (const field of ["mention", "decision"]) {
      const parsed = councilSchema(t).safeParse({
        id: "b-1",
        mention: "",
        decision: "",
        councilComment: "",
        mainTeacherComment: "",
        [field]: "PROMOTED_BY_POST",
      });
      expect(parsed.success, field).toBe(false);
    }
  });

  it("will not accept a status, so a mention cannot issue the bulletin", () => {
    // Publishing is a separate action behind a separate permission. A crafted
    // POST must not smuggle it in beside a mention.
    const parsed = councilSchema(t).safeParse({
      id: "b-1",
      mention: "FELICITATIONS",
      decision: "",
      councilComment: "",
      mainTeacherComment: "",
      status: "PUBLISHED",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("status");
  });

  it("names every decision the enum holds in all three languages", () => {
    for (const locale of ["en", "fr", "ar"] as const) {
      const dictionary = getDictionaryFor(locale);
      for (const decision of COUNCIL_DECISIONS) {
        expect(dictionary.bulletinOptions.decisions[decision], decision).toBeTruthy();
      }
      for (const mention of MENTIONS) {
        expect(dictionary.bulletinOptions.mentions[mention], mention).toBeTruthy();
      }
      for (const status of BULLETIN_STATUSES) {
        expect(dictionary.bulletinOptions.statuses[status], status).toBeTruthy();
      }
    }
  });
});
