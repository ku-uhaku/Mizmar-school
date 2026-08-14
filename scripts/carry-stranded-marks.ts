import { db } from "@/prisma/seed/client";
import { planGradeCarry } from "@/modules/assessments/enums";

/**
 * Carries over the marks of pupils who changed class before the app knew to.
 *
 * A mark is keyed on the enrolment; the contrôle it is a mark *on* is keyed on
 * the class. `assignClass` now carries on every seating, but every pupil moved
 * before that carried nothing — their marks are still sitting on their old
 * class's papers, where the new class's mark sheet reads "18 notes sur 19" and
 * the missing one is theirs.
 *
 * Nothing here is needed for a move made through the app: seating a pupil
 * already does all of this. This is only for the history.
 *
 * This is the one-shot that catches those up. It runs the same rule the app
 * runs — `planGradeCarry` is shared, not re-implemented — so a mark lands here
 * exactly where it would have landed had it been carried at the time.
 *
 * Idempotent, like the seeds: a second run finds nothing stranded and changes
 * nothing. It never deletes, and it never creates a paper — a mark whose paper
 * the new class never set stays where it was earned and goes on counting
 * through `loadClassTermMarks`.
 *
 *   npm run db:carry-marks          # report only, writes nothing
 *   npm run db:carry-marks -- --write
 */
async function main(): Promise<void> {
  const write = process.argv.includes("--write");

  /*
    Stranded = the mark's paper belongs to a class the pupil is not in.

    Prisma cannot compare two columns across a relation in a `where`, so the
    candidates are narrowed to seated pupils in the query and the comparison
    itself is done here. A school's marks fit in memory comfortably; the whole
    point of the pass is that it runs once.
  */
  const grades = await db.assessmentGrade.findMany({
    where: { enrollment: { schoolClassId: { not: null } } },
    select: {
      id: true,
      enrollmentId: true,
      enrollment: {
        select: {
          schoolClassId: true,
          classGroupId: true,
          student: { select: { code: true, firstName: true, lastName: true } },
        },
      },
      assessment: {
        select: {
          schoolClassId: true,
          subjectId: true,
          termId: true,
          assessmentTypeId: true,
          sequence: true,
        },
      },
    },
  });

  const stranded = grades.filter(
    (grade) =>
      grade.assessment.schoolClassId !== grade.enrollment.schoolClassId,
  );

  if (stranded.length === 0) {
    console.log("Nothing stranded — every mark is on its pupil's own class.");
    return;
  }

  // One pass per pupil, exactly as `carryGradesToClass` does it: every mark of
  // theirs that is not already on their own class, wherever it drifted to and
  // however many moves it took to get there.
  const passes = new Map<string, typeof stranded>();
  for (const grade of stranded) {
    passes.set(grade.enrollmentId, [
      ...(passes.get(grade.enrollmentId) ?? []),
      grade,
    ]);
  }

  console.log(
    `${stranded.length} marks stranded across ${passes.size} pupils.` +
      (write ? "" : " Nothing written — pass --write to carry them."),
  );

  let moved = 0;
  let left = 0;

  for (const held of passes.values()) {
    const [first] = held;
    // Non-null: `stranded` was filtered to seated pupils.
    const toClassId = first.enrollment.schoolClassId as string;

    const candidates = await db.assessment.findMany({
      where: {
        schoolClassId: toClassId,
        termId: { in: [...new Set(held.map((g) => g.assessment.termId))] },
        OR: [
          { classGroupId: null },
          { classGroupId: first.enrollment.classGroupId },
        ],
      },
      select: {
        id: true,
        subjectId: true,
        termId: true,
        assessmentTypeId: true,
        sequence: true,
        classGroupId: true,
        grades: {
          where: { enrollmentId: first.enrollmentId },
          select: { id: true },
        },
      },
    });

    const plan = planGradeCarry(held, candidates);
    moved += plan.moves.length;
    left += plan.left;

    const pupil = first.enrollment.student;
    console.log(
      `  ${pupil.code} ${pupil.lastName} ${pupil.firstName}: ` +
        `${plan.moves.length} carried, ${plan.left} left behind`,
    );

    if (!write || plan.moves.length === 0) continue;

    await db.$transaction(
      plan.moves.map((move) =>
        db.assessmentGrade.update({
          where: { id: move.id },
          data: { assessmentId: move.assessmentId },
        }),
      ),
    );
  }

  console.log(
    `${write ? "Carried" : "Would carry"} ${moved} marks; ` +
      `${left} stay on papers their new class never set, still counting.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
