import type { GradingRule } from "./types";

/**
 * A niveau's own barème, resolved the same way the web app does.
 *
 * Hand-mirrored from `gradingRuleScopeKey`, `resolveGradingRule` and
 * `gradingDefaults` in modules/assessments/enums.ts, for the same reason the
 * DTO types beside it are: importing the module would drag `server-only` and
 * Prisma into a phone bundle. Keep the two in step — the default a teacher
 * sees on the phone and the one they see in the browser have to be the same
 * figure.
 *
 * Display only, here as everywhere: `createDevoir` on the server writes
 * whatever the form posts, so a wrong default costs a teacher one retype, not
 * a wrong mark.
 */
function scopeKey(
  levelId: string | null | undefined,
  subjectId: string | null | undefined,
): string {
  return `${levelId ?? ""}:${subjectId ?? ""}`;
}

function resolveGradingRule(
  rows: readonly GradingRule[],
  target: { assessmentTypeId: string; levelId: string | null; subjectId: string | null },
): GradingRule | null {
  const keys = [
    scopeKey(target.levelId, target.subjectId),
    scopeKey(null, target.subjectId),
    scopeKey(target.levelId, null),
    scopeKey(null, null),
  ];
  for (const key of keys) {
    const hit = rows.find(
      (row) => row.assessmentTypeId === target.assessmentTypeId && row.scopeKey === key,
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * What a new paper of this kind is set on — the rule if there is one, the
 * kind's own defaults if there is not. See `resolveGradingRule` above.
 */
export function gradingDefaults(
  rows: readonly GradingRule[],
  target: { assessmentTypeId: string; levelId: string | null; subjectId: string | null },
  type: { defaultMaxScore: number; defaultCoefficient: number },
): { maxScore: number; coefficient: number } {
  const rule = resolveGradingRule(rows, target);
  return {
    maxScore: rule?.maxScore ?? type.defaultMaxScore,
    coefficient: rule?.coefficient ?? type.defaultCoefficient,
  };
}
