/**
 * Who may take which subject, at which niveau — as a pure function.
 *
 * Kept out of `modules/timetable/service.ts` for the same reason `generator.ts`
 * is: the rule decides both what the generator offers a class and what a screen
 * would have to say about it, and two implementations of "is Ahmad qualified for
 * maths at 3AP?" would drift the first time one of them is corrected. No
 * database and no `server-only` — everything it needs is passed in.
 *
 * The rule itself lives on `TeacherSubject`; this is where it is applied. Read
 * narrowest first:
 *
 *   named niveaux → exactly those
 *   a cycle       → every niveau of that cycle
 *   neither       → every niveau the school runs
 */

/** One declaration, reduced to what deciding needs. */
export type Qualification = {
  teacherId: string;
  /** Null when the row names no cycle. */
  educationLevelId: string | null;
  /** The niveaux the row names. Empty is the ordinary case. */
  levelIds: string[];
};

/** A niveau and the cycle it sits in. */
export type LevelCycle = { id: string; educationLevelId: string };

/**
 * The niveaux one declaration covers, or `null` for "every one of them".
 *
 * Null rather than the full list because the two are not the same thing to a
 * reader: a school-wide qualification stays school-wide when a niveau is opened
 * next September, and a list computed once would not.
 */
export function coveredLevels(
  qualification: Qualification,
  levels: readonly LevelCycle[],
): Set<string> | null {
  if (qualification.levelIds.length > 0) {
    return new Set(qualification.levelIds);
  }

  if (qualification.educationLevelId) {
    return new Set(
      levels
        .filter(
          (level) => level.educationLevelId === qualification.educationLevelId,
        )
        .map((level) => level.id),
    );
  }

  return null;
}

/** Whether one declaration reaches a given niveau. */
export function coversLevel(
  qualification: Qualification,
  levelId: string,
  levels: readonly LevelCycle[],
): boolean {
  const covered = coveredLevels(qualification, levels);
  return covered === null || covered.has(levelId);
}

/**
 * The teachers a school has declared for one subject at one niveau, in the
 * order they were given — which is preference rank, so best first.
 *
 * Returns the empty list both when nothing is declared for the subject and when
 * everything declared is scoped elsewhere. The caller tells the two apart by
 * asking whether the subject has any declarations at all, because they mean
 * different things: nothing declared is a school that has not said, and
 * declared-but-elsewhere is a school that has said "not here".
 */
export function qualifiedTeachers(
  qualifications: readonly Qualification[],
  levelId: string,
  levels: readonly LevelCycle[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const qualification of qualifications) {
    if (!coversLevel(qualification, levelId, levels)) continue;
    // A teacher declared twice for one subject — which the unique index makes
    // impossible per year, but a caller merging two years would produce — is
    // one candidate, not two. Counting them twice would let the placer think
    // it had more staff than the school employs.
    if (seen.has(qualification.teacherId)) continue;
    seen.add(qualification.teacherId);
    result.push(qualification.teacherId);
  }

  return result;
}
