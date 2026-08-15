import {
  DEFAULT_APPRECIATION_BANDS,
  assessmentScopeKey,
  defaultAssessmentTitle,
} from "@/modules/assessments/enums";
import { ASSESSMENT_TYPE_SEEDS } from "@/modules/assessments/presets";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The kinds of evaluation written for one school, the appréciation scale, and
 * the demonstration's papers. The catalogue itself is presets.ts.
 *
 * Idempotent: upserts on `(schoolId, code)`.
 */

export async function seedAssessmentTypes(
  db: SeedDb,
  schoolId: string,
): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of ASSESSMENT_TYPE_SEEDS) {
    const type = await db.assessmentType.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      update: {
        name: seed.name,
        nameAr: seed.nameAr,
        defaultCoefficient: seed.defaultCoefficient,
        defaultMaxScore: seed.defaultMaxScore,
        countsTowardAverage: seed.countsTowardAverage,
        gradesWholeSubject: seed.gradesWholeSubject,
        allowTeacherCreate: seed.allowTeacherCreate,
        colorHex: seed.colorHex,
        position: seed.position,
      },
      create: {
        schoolId,
        code: seed.code,
        name: seed.name,
        nameAr: seed.nameAr,
        defaultCoefficient: seed.defaultCoefficient,
        defaultMaxScore: seed.defaultMaxScore,
        countsTowardAverage: seed.countsTowardAverage,
        gradesWholeSubject: seed.gradesWholeSubject,
        allowTeacherCreate: seed.allowTeacherCreate,
        colorHex: seed.colorHex,
        position: seed.position,
      },
      select: { id: true },
    });
    idByCode.set(seed.code, type.id);
  }

  log("assessment types", idByCode.size);
  return idByCode;
}

/**
 * The appréciation scale a school starts with — see
 * `DEFAULT_APPRECIATION_BANDS`.
 *
 * ── Why this one seed does not upsert ───────────────────────────────────────
 * The wording is the whole point of the table: a school opens the screen and
 * rewrites "Assez bien" to whatever it says on its own bulletins. An upsert
 * would put the default back on every re-seed and quietly undo that, which is
 * exactly what the "a school you added by hand survives a re-seed" rule is
 * about. So the scale is written only into a school that has none, and a school
 * that deleted every rung has said it wants no suggested remark — leaving it
 * empty is the honest answer, not a gap to fill.
 *
 * Still idempotent: a second run finds rows and writes nothing.
 */
export async function seedAppreciationBands(
  db: SeedDb,
  schoolId: string,
): Promise<number> {
  const existing = await db.appreciationBand.count({ where: { schoolId } });
  if (existing > 0) return 0;

  await db.appreciationBand.createMany({
    data: DEFAULT_APPRECIATION_BANDS.map((band) => ({
      schoolId,
      minPercentBps: band.minPercentBps,
      label: band.label,
      labelAr: band.labelAr,
      colorHex: band.colorHex,
    })),
  });

  log("appreciation bands", DEFAULT_APPRECIATION_BANDS.length);
  return DEFAULT_APPRECIATION_BANDS.length;
}

// ── The papers themselves, and the marks on them ─────────────────────────────

/**
 * A deterministic 0..1 from a string.
 *
 * The whole point of the marks below is that a re-seed writes the same ones.
 * `Math.random()` would give a school whose averages moved every time somebody
 * ran the seed, and a trend chart that told a different story each morning —
 * which is not a demonstration, it is noise.
 */
function unitOf(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

/** Which papers a term holds, and roughly when in it each is sat. */
const TERM_PAPERS = [
  { typeCode: "CC", sequence: 1, at: 0.25 },
  { typeCode: "DS", sequence: 1, at: 0.5 },
  { typeCode: "CC", sequence: 2, at: 0.8 },
] as const;

/** A day `fraction` of the way through a range, at midnight. */
function dayWithin(startsOn: Date, endsOn: Date, fraction: number): Date {
  const span = endsOn.getTime() - startsOn.getTime();
  const at = new Date(startsOn.getTime() + span * fraction);
  at.setHours(0, 0, 0, 0);
  return at;
}

export type SeedAssessmentsInput = {
  schoolId: string;
  /** The staffed classes, as `seedClasses` returns them. */
  classes: {
    id: string;
    assignments: { subjectId: string; teacherId: string }[];
  }[];
  /** The year's terms, by id — their dates are read here. */
  termIds: string[];
  /** Assessment type code → id, as `seedAssessmentTypes` returns. */
  typeIdByCode: Map<string, string>;
  /** Who the office recorded as having set them. */
  createdById: string;
};

/**
 * A year of contrôles, and every pupil's mark on each.
 *
 * ── Why these are seeded when the types alone used to be ────────────────────
 * The note above says the calendar is set through the screen, and for a school
 * *running* the app that is right. But it left the demonstration with no marks
 * at all — so the pupil dashboard's averages, its subject columns and its
 * marks-over-time line were empty for every child in the database, and the one
 * screen a parent is shown at a rentrée demo showed nothing. A school seeded
 * with a timetable, a roster and a year of receipts but no marks is not a
 * school anybody can look at.
 *
 * ── Why it stays idempotent ─────────────────────────────────────────────────
 * Papers upsert on the same unique key the generator uses, so running the seed
 * twice corrects the same papers rather than raising a second set — exactly
 * what the `sequence` column exists for. The marks are derived from a hash of
 * the pupil and the paper, never from `Math.random()`, so the second run writes
 * the figures the first one did and nothing moves.
 *
 * Whole-class papers only. A subject split between two teachers by group would
 * need one paper per group, which is a real case the screen handles and a
 * needless complication here — so the first teacher of each subject takes it.
 */
export async function seedAssessments(
  db: SeedDb,
  input: SeedAssessmentsInput,
): Promise<{ papers: number; grades: number }> {
  const terms = await db.term.findMany({
    where: { id: { in: input.termIds } },
    orderBy: { number: "asc" },
    select: { id: true, startDate: true, endDate: true },
  });
  if (terms.length === 0) return { papers: 0, grades: 0 };

  const types = await db.assessmentType.findMany({
    where: { id: { in: [...input.typeIdByCode.values()] } },
    select: {
      id: true,
      name: true,
      defaultMaxScore: true,
      defaultCoefficient: true,
      countsTowardAverage: true,
    },
  });
  const typeById = new Map(types.map((type) => [type.id, type]));

  let papers = 0;
  let grades = 0;

  for (const schoolClass of input.classes) {
    const roster = await db.enrollment.findMany({
      where: {
        schoolClassId: schoolClass.id,
        status: { in: [...LIVE_ENROLMENT_STATUSES] },
      },
      select: { id: true },
    });
    if (roster.length === 0) continue;

    // One teacher per subject: a group-split subject would need a paper per
    // group, which the screen does and this deliberately does not.
    const bySubject = new Map<string, string>();
    for (const assignment of schoolClass.assignments) {
      if (!bySubject.has(assignment.subjectId)) {
        bySubject.set(assignment.subjectId, assignment.teacherId);
      }
    }

    for (const [subjectId, teacherId] of bySubject) {
      for (const term of terms) {
        for (const plan of TERM_PAPERS) {
          const assessmentTypeId = input.typeIdByCode.get(plan.typeCode);
          const type = assessmentTypeId ? typeById.get(assessmentTypeId) : null;
          if (!assessmentTypeId || !type) continue;

          const scopeKey = assessmentScopeKey(null);
          const scheduledOn = dayWithin(term.startDate, term.endDate, plan.at);

          const paper = await db.assessment.upsert({
            where: {
              schoolClassId_subjectId_termId_assessmentTypeId_sequence_scopeKey:
                {
                  schoolClassId: schoolClass.id,
                  subjectId,
                  termId: term.id,
                  assessmentTypeId,
                  sequence: plan.sequence,
                  scopeKey,
                },
            },
            update: { scheduledOn, teacherId, status: "GRADED" },
            create: {
              schoolId: input.schoolId,
              schoolClassId: schoolClass.id,
              classGroupId: null,
              subjectId,
              termId: term.id,
              assessmentTypeId,
              sequence: plan.sequence,
              title: defaultAssessmentTitle(type.name, plan.sequence),
              scheduledOn,
              // Copied from the type, never read through it — see the note on
              // the columns.
              maxScore: type.defaultMaxScore,
              coefficient: type.defaultCoefficient,
              countsTowardAverage: type.countsTowardAverage,
              status: "GRADED",
              teacherId,
              createdById: input.createdById,
              scopeKey,
            },
            select: { id: true, maxScore: true },
          });
          papers += 1;

          /*
            Written in one statement per paper rather than one per pupil.

            An upsert apiece was correct and took four and a half minutes over a
            seeded school — the marks never change on a re-run, so the rows that
            already exist need no write at all. Read what is there, insert the
            rest. The same shape as `markDayInBulk` in the RH module, and for
            the same reason: the SQLite connector has no `skipDuplicates`.
          */
          const marked = await db.assessmentGrade.findMany({
            where: { assessmentId: paper.id },
            select: { enrollmentId: true },
          });
          const already = new Set(marked.map((row) => row.enrollmentId));

          const fresh = roster
            .filter((enrolment) => !already.has(enrolment.id))
            .map((enrolment) => {
              /*
                A pupil keeps roughly the same level all year, with a paper-by-
                paper wobble around it — which is what makes the marks-over-time
                line read as a person rather than as static.
              */
              const ability = 7 + unitOf(`${enrolment.id}:ability`) * 10;
              const wobble = (unitOf(`${enrolment.id}:${paper.id}`) - 0.5) * 5.5;
              const raw = Math.min(paper.maxScore, Math.max(0, ability + wobble));

              // A few genuine absences, so the dashboard's "absent" cell and
              // the rule that an absence is not a nought both have something
              // to show.
              const isAbsent =
                unitOf(`${enrolment.id}:${paper.id}:absent`) < 0.03;

              return {
                assessmentId: paper.id,
                enrollmentId: enrolment.id,
                // Half points, as a Moroccan mark sheet actually carries.
                score: isAbsent ? null : Math.round(raw * 2) / 2,
                isAbsent,
                isExcused: isAbsent,
                gradedById: teacherId,
                gradedAt: scheduledOn,
              };
            });

          if (fresh.length > 0) {
            const written = await db.assessmentGrade.createMany({ data: fresh });
            grades += written.count;
          }
        }
      }
    }
  }

  log("assessments", `${papers} papers, ${grades} marks`);
  return { papers, grades };
}
