/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/assessments/*.prisma`. Labels live in `i18n/*.ts`
 * under `assessmentOptions`.
 *
 * Pure data: no server imports, no React. The mark sheet is a client component
 * and computes its own totals from these helpers, so they must cross the
 * boundary.
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

/** The most papers of one kind a term can hold — guards the sequence field. */
export const MAX_SEQUENCE = 20;

/**
 * Mirror for the nullable `classGroupId`, so the unique index on Assessment
 * actually fires.
 *
 * SQLite treats NULLs as distinct in a unique index, so two "whole class" rows
 * for the same subject and sequence would both be accepted and the generator
 * would stop being idempotent. Writing a sentinel instead of NULL is what makes
 * the constraint real. See lib/db-keys.ts for the same pattern elsewhere.
 */
export function assessmentScopeKey(classGroupId: string | null): string {
  return classGroupId ?? "__class__";
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
