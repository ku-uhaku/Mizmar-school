import { nullableKey } from "@/lib/db-keys";

/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/assessments/*.prisma`. Labels live in `i18n/*.ts`
 * under `assessmentOptions`.
 *
 * Pure data: no server imports, no React. The mark sheet is a client component
 * and computes its own totals from these helpers, so they must cross the
 * boundary. `lib/db-keys.ts` is the one exception — it is pure data too.
 */

/**
 * Where a paper is in its life.
 *
 *   DRAFT      planned, not yet announced — marks may not be entered
 *   PUBLISHED  announced to the class; the mark sheet is open to its teacher
 *   SUBMITTED  the teacher says their marking is finished and hands it back
 *   GRADED     the office has accepted it; marks final
 *   CANCELLED  did not happen; counts nowhere, but the row stays so the
 *              generator does not silently recreate it
 *
 * ── Why SUBMITTED exists ─────────────────────────────────────────────────────
 * Without it, "has this been marked?" is a question only a count of empty cells
 * can answer, and a half-marked paper looks exactly like one the teacher has
 * finished and is waiting to hear about. The status is the teacher saying so.
 * It is the one transition a teacher may make, and the only one the office
 * cannot make on their behalf — that is what makes it worth anything.
 */
export const ASSESSMENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "SUBMITTED",
  "GRADED",
  "CANCELLED",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/** Statuses whose marks count toward a subject's average for the term. */
export const COUNTED_STATUSES: readonly AssessmentStatus[] = [
  "PUBLISHED",
  "SUBMITTED",
  "GRADED",
];

/**
 * Statuses a family may see a mark in — and deliberately not `COUNTED_STATUSES`.
 *
 * ── Two questions that look like one ────────────────────────────────────────
 * "Does this mark count toward the average?" and "may a parent read it?" are
 * different, and the portal used to answer the second with the first. A paper
 * goes PUBLISHED the moment the office opens it for mark entry, so a family saw
 * each mark as its teacher typed it: a half-marked sheet read as a result, a
 * correction made before validation read as a grade that had changed, and the
 * office's own validation step meant nothing to the people it was for.
 *
 * Only GRADED here. That is the school having accepted the marking — the point
 * in the workflow where the result stops being provisional, which is exactly
 * what a family is entitled to be told. Staff screens keep using
 * `COUNTED_STATUSES`, because a running average across a term genuinely should
 * include a paper still being marked.
 */
export const FAMILY_VISIBLE_STATUSES: readonly AssessmentStatus[] = ["GRADED"];

/**
 * Marks may only be entered against a paper that has actually been set.
 *
 * SUBMITTED still accepts them: handing a paper back is not a lock, and the
 * office correcting one mark before validating must not have to reopen the
 * whole sheet. What SUBMITTED changes is whose move it is, not who may type.
 */
export function acceptsMarks(status: string): boolean {
  return (
    status === "PUBLISHED" || status === "SUBMITTED" || status === "GRADED"
  );
}

/**
 * Whether the paper itself may still be rewritten — its title, its date, its
 * barème and what it covers.
 *
 * DRAFT only, and that is what DRAFT is for. Publishing is the school telling a
 * class what it sits and when; moving the date afterwards changes a fact thirty
 * families have already written down, and re-weighting a paper marks are being
 * entered against silently rescores work already marked. Both are
 * announcements rather than edits, so they are refused here instead of made
 * quietly.
 *
 * Nobody is stuck with a mistake: `setAssessmentStatus` takes a paper with no
 * marks on it back to DRAFT, which is the deliberate step that reopens this
 * form — and `cannotUnpublish` is the case where it will not.
 *
 * Checked in the action as well as by the screen that renders the form. A
 * Server Function is reachable by direct POST, so hiding the card is not a gate.
 */
export function acceptsEdits(status: string): boolean {
  return status === "DRAFT";
}

/**
 * The workflow read as "whose move is it", which is the question the office and
 * the teacher both actually open the screen with.
 *
 * A status says where a paper *is*; a stage says who has to do something about
 * it. They are not the same list, and CANCELLED is the proof: it is a real
 * status and no stage at all, because nobody is waiting on it.
 *
 *   TO_PUBLISH  drafted; the office has to open it before anybody can mark
 *   MARKING     open; the teacher is entering marks
 *   TO_VALIDATE the teacher has handed it back; the office has to accept it
 *   DONE        validated — and, from here, what a family may read
 *
 * Ordered as the work flows, so the tabs read left to right the way the term
 * does.
 */
export const ASSESSMENT_STAGES = [
  "TO_PUBLISH",
  "MARKING",
  "TO_VALIDATE",
  "DONE",
] as const;
export type AssessmentStage = (typeof ASSESSMENT_STAGES)[number];

const STAGE_OF: Partial<Record<AssessmentStatus, AssessmentStage>> = {
  DRAFT: "TO_PUBLISH",
  PUBLISHED: "MARKING",
  SUBMITTED: "TO_VALIDATE",
  GRADED: "DONE",
  // CANCELLED is deliberately absent — see above.
};

/**
 * The stage a paper sits in, or null when nobody is waiting on it.
 *
 * `Object.hasOwn` rather than a bare lookup: `STAGE_OF` is a plain object, so
 * `stageOf("constructor")` answered a function and `stageOf("__proto__")` an
 * object — both truthy, so `?? null` never fired and the return broke its own
 * type. Nothing reaches it with such a value today, because a status is checked
 * against the enum before it is ever written; this is what keeps that true if
 * something else ever calls it with an unchecked string.
 */
export function stageOf(status: string): AssessmentStage | null {
  return Object.hasOwn(STAGE_OF, status)
    ? (STAGE_OF[status as AssessmentStatus] ?? null)
    : null;
}

/**
 * The statuses a stage covers, for a screen that filters on "whose move".
 *
 * Derived from `STAGE_OF` rather than written out a second time, so a status
 * that changes stage cannot end up in one list and not the other. An unknown
 * stage — a query parameter somebody typed — yields nothing to filter on, and
 * the caller shows the unfiltered list rather than an empty one.
 */
export function statusesForStage(stage: string): AssessmentStatus[] {
  return ASSESSMENT_STATUSES.filter((status) => STAGE_OF[status] === stage);
}

/**
 * Whether the teacher has handed this paper back and is waiting on the office.
 *
 * The one thing both the teacher's list and the office's list want to know, so
 * it is derived here rather than spelled as a string comparison in each.
 */
export function awaitingValidation(status: string): boolean {
  return status === "SUBMITTED";
}

/**
 * The scale, when nobody has said otherwise.
 *
 * A school sets its own in the configuration — see SchoolSettings.gradingMaxScore
 * and passMarkBps. These stay as the fallback for the places with no school in
 * hand, and they are the values the settings columns default to, so the two can
 * never disagree.
 */
export const DEFAULT_MAX_SCORE = 20;
export const DEFAULT_PASS_BPS = 5000;

/**
 * Bounds on a barème, wherever one is typed by hand: a paper's own `maxScore`,
 * a kind's `defaultMaxScore`, a `GradingRule.maxScore`, the school's own
 * `gradingMaxScore`. One out of nothing cannot be scored, and one out of more
 * than 100 is a data-entry slip rather than a grading scale. Named here so the
 * zod field, the configuration screens and the form inputs cannot drift apart.
 */
export const MAX_SCORE_MIN = 1;
export const MAX_SCORE_MAX = 100;

/** The most papers of one kind a term can hold — guards the sequence field. */
export const MAX_SEQUENCE = 20;

/**
 * How many papers a school-wide read returns.
 *
 * The class-and-term list needs no cap — a class sits a dozen papers a term. The
 * devoirs review is the whole school's homework for the year, and every row of
 * it pulls that paper's marks to work out how far the marking has got. Uncapped,
 * opening the screen in June would be a query per paper set since September.
 *
 * The screen says when it is holding a full page, for the same reason the
 * carnet's review does: a reader working through a queue must be able to tell a
 * cap from a finished backlog.
 */
export const ASSESSMENT_PAGE_SIZE = 200;

/**
 * How long `Assessment.notes` may be — what the paper covers, in the words a
 * class is told it in: "leçon 3, p.42", "les fractions et les décimaux".
 *
 * A sentence or two, not a lesson plan. Here rather than inline in the schema
 * so the three places that bound it — the zod field, the generator's parser and
 * the `maxLength` on the boxes themselves — cannot drift apart.
 */
export const NOTES_MAX = 500;

/**
 * Mirror for the nullable `classGroupId`, so the unique index on Assessment
 * actually fires.
 *
 * MySQL treats NULLs as distinct in a unique index, so two "whole class" rows
 * for the same subject and sequence would both be accepted and the generator
 * would stop being idempotent. Writing a sentinel instead of NULL is what makes
 * the constraint real. See lib/db-keys.ts for the same pattern elsewhere.
 */
export function assessmentScopeKey(classGroupId: string | null): string {
  return classGroupId ?? "__class__";
}

// ── Per-niveau barèmes ────────────────────────────────────────────────────────

/**
 * Mirror for `GradingRule`'s two nullable scope columns — see lib/db-keys.ts.
 *
 * Four distinct keys, one per tier `resolveGradingRule` reads in order:
 * "level:subject", ":subject", "level:", ":".
 */
export function gradingRuleScopeKey(
  levelId: string | null | undefined,
  subjectId: string | null | undefined,
): string {
  return nullableKey(levelId, subjectId);
}

/** A barème rule, as the resolver needs to read it. */
export type GradingRuleRow = {
  assessmentTypeId: string;
  scopeKey: string;
  maxScore: number;
  coefficient: number | null;
};

/**
 * The barème one kind of paper is set on, for one niveau and one matière.
 *
 * Narrowest wins — the same shape as `buildScheduleLines` in
 * modules/enrolment/schedule.ts, and for the same reason: a niveau row and a
 * matière row are not competing prices, one is a default the other refines.
 *
 *   level + subject   the oral in اللغة العربية in 1AP
 *   subject only      the oral in اللغة العربية, wherever it is taught
 *   level only        everything sat in 1AP
 *   nothing           null — the caller falls back to the kind's own defaults
 *
 * Null rather than a thrown error or a fabricated 20: "this school has said
 * nothing" is the commonest answer and it has a correct fallback the caller
 * already holds. Baking 20 in here would make this file disagree with
 * `AssessmentType.defaultMaxScore` for every school that changed it.
 */
export function resolveGradingRule(
  rows: readonly GradingRuleRow[],
  target: {
    assessmentTypeId: string;
    levelId: string | null;
    subjectId: string | null;
  },
): GradingRuleRow | null {
  const keys = [
    gradingRuleScopeKey(target.levelId, target.subjectId),
    gradingRuleScopeKey(null, target.subjectId),
    gradingRuleScopeKey(target.levelId, null),
    gradingRuleScopeKey(null, null),
  ];
  for (const key of keys) {
    const hit = rows.find(
      (row) =>
        row.assessmentTypeId === target.assessmentTypeId && row.scopeKey === key,
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * What a new paper of this kind is set on — the rule if there is one, the
 * kind's own defaults if there is not.
 *
 * One function rather than every writer doing its own `?? type.defaultX`: the
 * generator, the devoir form and the MASSAR import all write these two
 * columns, and a caller that forgot the fallback would silently write a
 * barème of zero.
 */
export function gradingDefaults(
  rows: readonly GradingRuleRow[],
  target: { assessmentTypeId: string; levelId: string | null; subjectId: string | null },
  type: { defaultMaxScore: number; defaultCoefficient: number },
): { maxScore: number; coefficient: number } {
  const rule = resolveGradingRule(rows, target);
  return {
    maxScore: rule?.maxScore ?? type.defaultMaxScore,
    coefficient: rule?.coefficient ?? type.defaultCoefficient,
  };
}

/** The title a generated paper starts with, e.g. "Contrôle continu n°2". */
export function defaultAssessmentTitle(
  typeName: string,
  sequence: number,
): string {
  return `${typeName} n°${sequence}`;
}

/**
 * Rounds a mark the way a mark sheet does: two decimals, never more.
 *
 * Moroccan marks carry quarters and halves, so floats are unavoidable, but
 * 13.250000000000002 on a report card is not something anybody wants to explain.
 */
export function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

/**
 * Whether a mark is a pass on its own paper.
 *
 * `maxScore` is the paper's, `passBps` the school's. A school marking out of 20
 * may still set one oral out of 10, and the mark has to be judged against the
 * paper it was earned on — the school decides the *ratio*, not the scale.
 */
export function isPassing(
  score: number,
  maxScore: number,
  passBps: number = DEFAULT_PASS_BPS,
): boolean {
  return maxScore > 0 && (score / maxScore) * 10_000 >= passBps;
}

export type GradeInput = {
  score: number | null;
  isAbsent: boolean;
};

export type MarkStatistics = {
  /** Pupils with a mark — absences and unmarked rows are not in the mean. */
  markedCount: number;
  absentCount: number;
  /** Pupils with neither a mark nor an absence. */
  pendingCount: number;
  average: number | null;
  lowest: number | null;
  highest: number | null;
  passCount: number;
  passRate: number | null;
};

/**
 * The figures under a mark sheet, computed from the marks alone.
 *
 * Absences are excluded from the mean rather than averaged as zero: a pupil who
 * was not there has not demonstrated a zero, and folding them in would drag a
 * class average down for a reason that has nothing to do with the paper. They
 * are counted separately so the exclusion is visible rather than silent.
 */
export function markStatistics(
  grades: readonly GradeInput[],
  maxScore: number,
  passBps: number = DEFAULT_PASS_BPS,
): MarkStatistics {
  const scores = grades
    .filter((grade) => !grade.isAbsent && grade.score !== null)
    .map((grade) => grade.score as number);

  const absentCount = grades.filter((grade) => grade.isAbsent).length;
  const pendingCount = grades.filter(
    (grade) => !grade.isAbsent && grade.score === null,
  ).length;

  if (scores.length === 0) {
    return {
      markedCount: 0,
      absentCount,
      pendingCount,
      average: null,
      lowest: null,
      highest: null,
      passCount: 0,
      passRate: null,
    };
  }

  const total = scores.reduce((sum, score) => sum + score, 0);
  const passCount = scores.filter((score) =>
    isPassing(score, maxScore, passBps),
  ).length;

  return {
    markedCount: scores.length,
    absentCount,
    pendingCount,
    average: roundScore(total / scores.length),
    lowest: Math.min(...scores),
    highest: Math.max(...scores),
    passCount,
    passRate: Math.round((passCount / scores.length) * 100),
  };
}

/**
 * How wide a round of contrôles is generated.
 *
 *   CLASS  one class — a make-up paper, or a class running behind
 *   LEVEL  every class of one level, which is how a round is actually set:
 *          3AP sits the same contrôle n°1 in all three of its classes
 *   YEAR   every class in the school, for a round that is school-wide
 *
 * LEVEL is the ordinary case and the reason this exists. Generating class by
 * class meant the same dialog filled in eight times, and the eighth was where
 * somebody mistyped a date.
 */
export const GENERATE_SCOPES = ["CLASS", "LEVEL", "YEAR"] as const;
export type GenerateScope = (typeof GENERATE_SCOPES)[number];

// ── The paper itself ─────────────────────────────────────────────────────────

/** Most questions one paper may carry. A longer list is a booklet, not a devoir. */
export const MAX_QUESTIONS = 40;

/** Longest one question's wording may run. */
export const QUESTION_MAX_LENGTH = 1000;

/**
 * `AssessmentQuestion.pointsQuarters` is an integer count of quarter-points.
 *
 * A Moroccan barème is written in halves and quarters — "2,5 pts", "0,75 pt" —
 * and a float column would let a question be worth 1.7333 and then round
 * differently in the total than on the page. Counting quarters makes the sum
 * exact, which is the whole reason the points are stored at all.
 */
const QUARTERS_PER_POINT = 4;

/** `2.5` → `10`. Rounds to the nearest quarter, which is the grid a barème uses. */
export function pointsToQuarters(points: number): number {
  return Math.round(points * QUARTERS_PER_POINT);
}

/** `10` → `2.5`. */
export function quartersToPoints(quarters: number): number {
  return quarters / QUARTERS_PER_POINT;
}

/**
 * What the questions add up to, in points.
 *
 * Summed in quarters and converted once, so a paper of eight questions worth
 * 2.5 each totals exactly 20 rather than 19.999999999999996.
 */
export function questionsTotal(
  questions: readonly { pointsQuarters: number }[],
): number {
  return quartersToPoints(
    questions.reduce((sum, question) => sum + question.pointsQuarters, 0),
  );
}

/**
 * The school's appréciation scale — see
 * prisma/schema/assessments/appreciation-band.prisma.
 *
 * Pure data, and deliberately: the mark sheet fills the remark in as the
 * teacher types, on the phone as well as in the browser, so the rule that turns
 * a mark into a word has to cross to the client. It is mirrored in
 * mobile/src/api/types.ts for the same reason every DTO there is.
 */
export type AppreciationBandRow = {
  id: string;
  minPercentBps: number;
  label: string;
  labelAr: string | null;
  colorHex: string | null;
};

/** Most rungs a scale may hold. Beyond this it is a mark sheet, not a scale. */
export const MAX_APPRECIATION_BANDS = 12;

/** Longest one rung's wording may run. It goes on a bulletin, not in an essay. */
export const APPRECIATION_LABEL_MAX = 60;

/**
 * The scale a school starts with, floors first.
 *
 * Deliberately the ordinary Moroccan wording rather than something neutral: a
 * school that agrees with it never opens the screen, and one that does not
 * rewrites the labels it disagrees with instead of building a scale from
 * nothing. Seeded per school — see modules/assessments/seed.ts — so editing it
 * is editing rows, never the code.
 */
export const DEFAULT_APPRECIATION_BANDS: readonly {
  minPercentBps: number;
  label: string;
  labelAr: string;
  colorHex: string;
}[] = [
  { minPercentBps: 9000, label: "Excellent", labelAr: "ممتاز", colorHex: "#15803d" },
  { minPercentBps: 8000, label: "Très bien", labelAr: "حسن جدا", colorHex: "#16a34a" },
  { minPercentBps: 7000, label: "Bien", labelAr: "حسن", colorHex: "#65a30d" },
  { minPercentBps: 6000, label: "Assez bien", labelAr: "مستحسن", colorHex: "#ca8a04" },
  { minPercentBps: 5000, label: "Passable", labelAr: "مقبول", colorHex: "#ea580c" },
  { minPercentBps: 0, label: "Insuffisant", labelAr: "غير كاف", colorHex: "#dc2626" },
];

/**
 * The rung a mark falls on, or null when the scale does not reach it.
 *
 * A band holds only its floor, so this is "the highest rung the mark clears" —
 * which is what makes the scale gapless without anybody maintaining ceilings.
 * The share is of the paper's own `maxScore`, not of 20: an oral out of 10 must
 * land on the same rung as the same performance on a paper out of 20.
 *
 * Null for a mark that has not been entered, for an absence, and for a scale
 * with no rung at the bottom — in each case there is no remark to suggest, and
 * suggesting the worst one would be a statement the school never made.
 */
export function appreciationFor<T extends { minPercentBps: number }>(
  score: number | null,
  maxScore: number,
  bands: readonly T[],
): T | null {
  if (score === null || !Number.isFinite(score) || maxScore <= 0) return null;

  const bps = (score / maxScore) * 10_000;

  let best: T | null = null;
  for (const band of bands) {
    if (band.minPercentBps > bps) continue;
    if (best === null || band.minPercentBps > best.minPercentBps) best = band;
  }
  return best;
}

/** Floors first, which is how a scale is read and how it is edited. */
export function sortBands<T extends { minPercentBps: number }>(
  bands: readonly T[],
): T[] {
  return [...bands].sort((a, b) => b.minPercentBps - a.minPercentBps);
}

// ── Following a pupil who changes class ──────────────────────────────────────

/** What makes two papers, set in two different classes, the same paper. */
export type PaperIdentity = {
  subjectId: string;
  termId: string;
  assessmentTypeId: string;
  sequence: number;
};

/**
 * The identity a mark is carried by when its pupil changes class.
 *
 * Not the title: two classes' "Contrôle n°1" are the same paper even when one
 * of them has been renamed "Les fonctions", and a school that renames a paper
 * between two moves must not thereby strand a mark.
 */
export function paperIdentity(paper: PaperIdentity): string {
  return `${paper.subjectId}:${paper.termId}:${paper.assessmentTypeId}:${paper.sequence}`;
}

/** A mark to be carried, and the paper it currently sits on. */
export type HeldGrade = { id: string; assessment: PaperIdentity };

/** A paper in the class being moved to, and whether the pupil is already on it. */
export type CandidatePaper = PaperIdentity & {
  id: string;
  classGroupId: string | null;
  /** Non-empty when the pupil already holds a mark on this paper. */
  grades: readonly unknown[];
};

/** Where each mark lands, and how many could not be placed. */
export type CarryPlan = {
  moves: { id: string; assessmentId: string }[];
  left: number;
};

/**
 * Works out which of the new class's papers each of a pupil's marks belongs on.
 *
 * Pure, and deliberately so: the same rule has to run inside the app when a
 * secretary moves a child and inside a one-shot script over the pupils who were
 * moved before the app knew to carry anything. A second copy of "which paper is
 * the same paper" is exactly the kind of thing that would drift and put a mark
 * on the wrong contrôle.
 *
 * Two marks of one pupil can never land on one paper — see the unique index on
 * AssessmentGrade — so a paper is claimed at most once per run.
 */
export function planGradeCarry(
  held: readonly HeldGrade[],
  candidates: readonly CandidatePaper[],
): CarryPlan {
  const equivalent = new Map<string, CandidatePaper>();
  for (const paper of candidates) {
    const identity = paperIdentity(paper);
    // A class may hold both a whole-class paper and a per-group one for the
    // same slot. The pupil's own group wins; the whole-class paper is the
    // fallback, which is also the only match when they have no group yet.
    if (paper.classGroupId !== null || !equivalent.has(identity)) {
      equivalent.set(identity, paper);
    }
  }

  // Nothing is overwritten and nothing is deleted on a collision: the mark
  // already on the paper is one somebody entered against it, and the mark that
  // could not move stays where it was earned and goes on counting.
  const taken = new Set(
    candidates.filter((paper) => paper.grades.length > 0).map((paper) => paper.id),
  );

  const moves: { id: string; assessmentId: string }[] = [];
  for (const grade of held) {
    const target = equivalent.get(paperIdentity(grade.assessment));
    if (target === undefined || taken.has(target.id)) continue;

    moves.push({ id: grade.id, assessmentId: target.id });
    taken.add(target.id);
  }

  return { moves, left: held.length - moves.length };
}
