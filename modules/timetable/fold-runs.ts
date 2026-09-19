/**
 * The part of a lesson the fold looks at — a `TeacherLesson` satisfies it.
 *
 * Pure data and pure arithmetic, no `server-only`, so the rule is testable
 * without a database and the screen and the printed sheet cannot disagree about
 * what counts as one lesson continuing.
 */
export type FoldableLesson = {
  schoolClassId: string;
  subjectId: string;
  groupLabel: string | null;
  roomCode: string | null;
};

/**
 * Whether two lessons are the same one continuing — the same class, group,
 * subject and room.
 *
 * What is written *under* the lesson is deliberately not part of the question.
 * Details say what is taught inside the hour and when; they do not make the
 * second hour a different lesson, and splitting a session in two because a line
 * was added to it is exactly what the fold exists to prevent.
 */
export function continuesLesson(a: FoldableLesson, b: FoldableLesson): boolean {
  return (
    a.schoolClassId === b.schoolClassId &&
    a.subjectId === b.subjectId &&
    a.groupLabel === b.groupLabel &&
    a.roomCode === b.roomCode
  );
}

export type FoldedCell = {
  span: number;
  covered: boolean;
  /**
   * The columns this cell stands for, in order — its own first. Lets the reader
   * gather what is under every period of the run, since each period keeps its
   * own lesson row and its own details.
   */
  keys: string[];
};

/**
 * Folds runs of the same lesson in one day into a single spanning cell, so a
 * double period reads as one lesson and not two "Maths" side by side — the same
 * thing the class grid does.
 *
 * A break column has no lesson, so it ends a run by itself: the hours either
 * side of the récréation are two lessons, and drawing them as one would span the
 * break.
 */
export function foldRuns(
  columns: { key: string }[],
  cells: Record<string, FoldableLesson | null>,
): Record<string, FoldedCell> {
  const layout: Record<string, FoldedCell> = {};
  let head: { key: string; lesson: FoldableLesson } | null = null;

  for (const column of columns) {
    const lesson = cells[column.key];
    layout[column.key] = { span: 1, covered: false, keys: [column.key] };

    if (!lesson) {
      head = null;
      continue;
    }
    if (head && continuesLesson(head.lesson, lesson)) {
      layout[head.key].span += 1;
      layout[head.key].keys.push(column.key);
      layout[column.key].covered = true;
      continue;
    }
    head = { key: column.key, lesson };
  }

  return layout;
}
