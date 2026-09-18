import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolId, currentSchoolYearId } from "@/lib/scope";
import { readWorkbook, writeSheet, type CellEdit } from "@/lib/xlsx";
import {
  assessmentScopeKey,
  defaultAssessmentTitle,
  gradingDefaults,
  roundScore,
} from "@/modules/assessments/enums";
// Marks are written through the module that owns the invariant, never around
// it: the scale, the "may this paper be marked at all" rule and the roster
// matching are the mark sheet's, and a second copy here would be a second
// answer to the same question.
import { saveMarks } from "@/modules/assessments/service";
import type { MassarReconciliation } from "@/modules/massar/queries";

/**
 * The three things a school does with a reconciled MASSAR sheet, and the one
 * that makes the rest possible.
 *
 * Every function here takes a `MassarReconciliation` the caller has just built
 * from the uploaded bytes — never a verdict from the browser — and refuses to
 * act unless that report says it may. See `reconcileNotesFile`.
 */

export type MassarWriteResult =
  | { ok: true; count: number; assessmentId: string }
  | { ok: false; reason: "blocked" | "no-rows" | "no-type" | "locked" | "out-of-range" | "not-found" };

/**
 * Create — or find — the contrôle this sheet is about, and stamp MASSAR's id on
 * it.
 *
 * ── Why this is idempotent rather than a create ─────────────────────────────
 * The same sheet gets uploaded twice: once to check it, once after somebody
 * fixed a name. A plain create would leave two contrôles for one paper and the
 * class average would count it twice. So the lookup is the assessment's own
 * unique key — class, subject, term, kind, sequence — and the second run finds
 * what the first made.
 *
 * The paper is created PUBLISHED rather than DRAFT. A DRAFT means "planned, not
 * sat", and this one demonstrably was: the ministry has already sent its marks.
 * `saveMarks` would refuse a DRAFT anyway, and creating a row the very next step
 * cannot write to is not a state worth passing through.
 */
export async function generateControle(
  context: AuthContext,
  reconciliation: MassarReconciliation,
  assessmentTypeId: string,
): Promise<MassarWriteResult> {
  const { file, db: held, report } = reconciliation;
  if (!report.canProceed) return { ok: false, reason: "blocked" };
  if (held.schoolClass === null || held.subject === null || held.term === null) {
    return { ok: false, reason: "blocked" };
  }

  const schoolId = currentSchoolId(context);
  const type = await db.assessmentType.findFirst({
    where: { id: assessmentTypeId, schoolId },
    select: {
      id: true,
      name: true,
      defaultCoefficient: true,
      defaultMaxScore: true,
      countsTowardAverage: true,
    },
  });
  if (!type) return { ok: false, reason: "no-type" };

  // The niveau's own barème when one is set, the kind's default otherwise —
  // see GradingRule and `gradingDefaults`. Resolved before the file's own
  // scale so a sheet that declares none still files against what this school
  // actually marks this niveau out of, rather than the type's raw default.
  const gradingRules = await db.gradingRule.findMany({
    where: {
      schoolYearId: currentSchoolYearId(context),
      assessmentTypeId: type.id,
      isActive: true,
    },
    select: { assessmentTypeId: true, scopeKey: true, maxScore: true, coefficient: true },
  });
  const scale = gradingDefaults(
    gradingRules,
    { assessmentTypeId: type.id, levelId: held.level?.id ?? null, subjectId: held.subject.id },
    type,
  );

  const sequence = file.sequence ?? 1;
  // The file's own scale wins over the resolved default. A NotesCC sheet
  // marked out of 10 that we file as a paper out of 20 turns every mark into
  // half of itself, and nothing downstream could ever tell.
  const maxScore = file.maxScore ?? scale.maxScore;
  const scopeKey = assessmentScopeKey(null);

  const existing = await db.assessment.findFirst({
    where: {
      schoolClassId: held.schoolClass.id,
      subjectId: held.subject.id,
      termId: held.term.id,
      assessmentTypeId: type.id,
      sequence,
      scopeKey,
    },
    select: { id: true },
  });

  if (existing) {
    await db.assessment.update({
      where: { id: existing.id },
      // Only the identity is adopted. Re-importing must not quietly rescale a
      // paper somebody has already marked by hand.
      data: { massarCode: file.exportId ?? undefined },
    });
    return { ok: true, count: 0, assessmentId: existing.id };
  }

  const created = await db.assessment.create({
    data: {
      schoolId,
      schoolClassId: held.schoolClass.id,
      classGroupId: null,
      subjectId: held.subject.id,
      termId: held.term.id,
      assessmentTypeId: type.id,
      sequence,
      title: file.assessmentLabel?.trim() || defaultAssessmentTitle(type.name, sequence),
      maxScore,
      coefficient: scale.coefficient,
      // Copied from the resolved kind like the weight beside it, so
      // re-configuring the kind or its niveau's rule later cannot rescore a
      // ministry sheet already imported under it.
      countsTowardAverage: type.countsTowardAverage,
      status: "PUBLISHED",
      massarCode: file.exportId,
      scopeKey,
      createdById: context.user.id,
    },
    select: { id: true },
  });

  return { ok: true, count: 1, assessmentId: created.id };
}

/**
 * Excel → the database: the marks MASSAR sent, onto the contrôle.
 *
 * Rejected rows never reach `saveMarks`. `report.matched` is only the children
 * that resolved to an enrolment in this class and passed every per-row check, so
 * a class with one unmapped transfer-in still gets its other twenty-five marks —
 * which was the point of rejecting rows individually.
 */
export async function importNotes(
  context: AuthContext,
  reconciliation: MassarReconciliation,
  assessmentId: string,
): Promise<MassarWriteResult> {
  const { report } = reconciliation;
  if (!report.canProceed) return { ok: false, reason: "blocked" };
  if (report.matched.length === 0) return { ok: false, reason: "no-rows" };

  // Re-scoped from the session: an assessment id from the request that is not
  // this school's must reach nothing.
  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, schoolId: currentSchoolId(context) },
    select: { id: true, maxScore: true },
  });
  if (!assessment) return { ok: false, reason: "not-found" };

  /*
    MASSAR's scale onto the paper's. A contrôle continu comes out of MASSAR
    marked on 10 and the school's own paper is on 20, so 8 has to become 16 —
    writing it raw would record a fail as a pass. Reported as `MAX_SCORE` before
    anybody presses the button, never done quietly.

    A generated paper takes the file's own scale, so the ratio is 1 and this is
    a no-op for every import that created its own contrôle.
  */
  const from = reconciliation.file.maxScore;
  const rescale = (score: number): number =>
    from === null || from === 0 || from === assessment.maxScore
      ? roundScore(score)
      : roundScore((score / from) * assessment.maxScore);

  const result = await saveMarks(
    assessment.id,
    report.matched.map((row) => ({
      enrollmentId: row.enrollmentId,
      score: row.score === null ? null : rescale(row.score),
      isAbsent: row.isAbsent,
      isExcused: row.isExcused,
      comment: row.comment,
    })),
    context.user.id,
  );

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, count: result.saved, assessmentId: assessment.id };
}

/**
 * The database → Excel: the same workbook back, with our marks in it.
 *
 * The uploaded file is the template. Nothing is generated from scratch, because
 * MASSAR will only accept its own workbook — its protection, its hidden keys and
 * its printer settings are what the portal recognises on re-upload. So the bytes
 * that arrived are the bytes that leave, with two columns changed.
 *
 * Only rows that reconciled are touched. A line the report rejected keeps
 * whatever MASSAR had in it: writing a mark against a row we could not identify
 * is exactly the mistake the checks exist to prevent.
 */
export async function exportNotes(
  context: AuthContext,
  reconciliation: MassarReconciliation,
  buffer: Buffer,
  assessmentId: string,
): Promise<{ ok: true; file: Buffer; count: number } | { ok: false; reason: "blocked" | "not-found" }> {
  const { file, report } = reconciliation;
  if (report.blocking.length > 0) return { ok: false, reason: "blocked" };

  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, schoolId: currentSchoolId(context) },
    select: {
      id: true,
      maxScore: true,
      grades: {
        select: { enrollmentId: true, score: true, isAbsent: true, isExcused: true, comment: true },
      },
    },
  });
  if (!assessment) return { ok: false, reason: "not-found" };

  const grades = new Map(assessment.grades.map((grade) => [grade.enrollmentId, grade]));

  const edits: CellEdit[] = [];
  let count = 0;

  for (const row of report.matched) {
    const grade = grades.get(row.enrollmentId);
    if (!grade) continue;

    // MASSAR's scale, not ours, in case a school marked the paper out of 20 and
    // the sheet came out of 10. Rounded to the quarter a barème is written in.
    const scale = file.maxScore ?? assessment.maxScore;
    const score =
      grade.score === null
        ? null
        : Math.round((grade.score / assessment.maxScore) * scale * 100) / 100;

    edits.push({ ref: `${file.noteColumn}${row.sheetRow}`, value: grade.isAbsent ? null : score });
    edits.push({
      ref: `${file.absenceColumn}${row.sheetRow}`,
      // The absence column's dropdown offers one value; anything else would be
      // rejected by the sheet's own validation.
      value: grade.isAbsent && grade.isExcused ? "مبرر" : null,
    });
    if (file.commentColumn !== null) {
      edits.push({ ref: `${file.commentColumn}${row.sheetRow}`, value: grade.comment });
    }
    count += 1;
  }

  return {
    ok: true,
    file: writeSheet(readWorkbook(buffer), file.sheetName, edits),
    count,
  };
}

export type AdoptionResult = {
  school: boolean;
  schoolClass: boolean;
  subject: boolean;
  term: boolean;
  assessment: boolean;
  pupils: number;
};

/**
 * Cloning the file's identity into the school — what "adopt from MASSAR" means.
 *
 * Only ever fills blanks. Every one of these is an `ADOPTABLE` check, which is
 * to say the school holds nothing there; a field that already disagreed came
 * back as an ERROR and blocked the whole reconciliation long before this ran.
 * So this cannot overwrite a mapping somebody made deliberately, and running it
 * twice does nothing the second time.
 *
 * This is the step that makes every later import cheap: once the class, the
 * subject and the pupils carry their MASSAR keys, the next sheet matches on
 * codes instead of on names and birth dates.
 */
export async function adoptFromFile(
  context: AuthContext,
  reconciliation: MassarReconciliation,
  assessmentId: string | null,
): Promise<AdoptionResult> {
  const { file, db: held, report } = reconciliation;
  const schoolId = currentSchoolId(context);
  const result: AdoptionResult = {
    school: false,
    schoolClass: false,
    subject: false,
    term: false,
    assessment: false,
    pupils: 0,
  };

  const adoptable = (id: string) =>
    report.header.some((check) => check.id === id && check.severity === "ADOPTABLE");

  if (file.schoolCode && held.school.massarCode === null && adoptable("SCHOOL_CODE")) {
    await db.school.update({ where: { id: schoolId }, data: { massarCode: file.schoolCode } });
    result.school = true;
  }

  if (file.classLabel && held.schoolClass && held.schoolClass.massarCode === null) {
    await db.schoolClass.update({
      where: { id: held.schoolClass.id },
      data: { massarCode: file.classLabel },
    });
    result.schoolClass = true;
  }

  if (file.subjectCode && held.subject && held.subject.massarCode === null) {
    await db.subject.update({
      where: { id: held.subject.id },
      data: { massarCode: file.subjectCode },
    });
    result.subject = true;
  }

  if (file.termNumber !== null && held.term && held.term.massarCode === null) {
    await db.term.update({
      where: { id: held.term.id },
      data: { massarCode: String(file.termNumber) },
    });
    result.term = true;
  }

  if (assessmentId !== null && file.exportId) {
    const paper = await db.assessment.findFirst({
      where: { id: assessmentId, schoolId, massarCode: null },
      select: { id: true },
    });
    if (paper) {
      await db.assessment.update({
        where: { id: paper.id },
        data: { massarCode: file.exportId },
      });
      result.assessment = true;
    }
  }

  // MASSAR's pupil numbers, for the children who reconciled without one. Each is
  // scoped by school on the way in, so a number from the file cannot land on
  // another tenant's row.
  for (const row of report.matched) {
    if (row.adoptMassarNumber === null) continue;
    await db.student.updateMany({
      where: { id: row.studentId, schoolId, massarNumber: null },
      data: { massarNumber: row.adoptMassarNumber },
    });
    result.pupils += 1;
  }

  return result;
}
