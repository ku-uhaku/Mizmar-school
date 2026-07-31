import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import {
  markStatistics,
  type MarkStatistics,
} from "@/modules/assessments/enums";

/**
 * Reads for the assessments module.
 *
 * Confined to `context.currentSchool` and, through the term, to
 * `context.currentSchoolYear`. A mark belongs to a class in a year; reading
 * outside the selected year would put last year's contrôles in front of a
 * teacher entering this year's, which is the one mistake nobody would notice
 * until a report card came out wrong.
 */

function schoolScope(context: AuthContext) {
  return { schoolId: context.currentSchool?.id ?? "__none__" };
}

function yearScope(context: AuthContext) {
  return { schoolYearId: context.currentSchoolYear?.id ?? "__none__" };
}

export type AssessmentTypeOption = {
  id: string;
  code: string;
  name: string;
  defaultCoefficient: number;
  defaultMaxScore: number;
  countsTowardAverage: boolean;
  colorHex: string | null;
};

/**
 * The kinds of paper this school runs.
 *
 * `teacherCreatableOnly` is what separates the two surfaces: the vie scolaire
 * generator offers every kind, while a teacher's own workspace only offers the
 * ones the school has said a teacher may set — devoirs, typically, and not
 * contrôles. That policy is a column, not a hard-coded list.
 */
export async function listAssessmentTypes(
  context: AuthContext,
  options: { teacherCreatableOnly?: boolean } = {},
): Promise<AssessmentTypeOption[]> {
  const types = await db.assessmentType.findMany({
    where: {
      ...schoolScope(context),
      isActive: true,
      ...(options.teacherCreatableOnly ? { allowTeacherCreate: true } : {}),
    },
    orderBy: [{ position: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      defaultCoefficient: true,
      defaultMaxScore: true,
      countsTowardAverage: true,
      colorHex: true,
    },
  });
  return types;
}

export type TermOption = {
  id: string;
  number: number;
  name: string;
  status: string;
};

/** The terms of the year in context — what a contrôle is filed under. */
export async function listTerms(context: AuthContext): Promise<TermOption[]> {
  const terms = await db.term.findMany({
    where: yearScope(context),
    orderBy: [{ number: "asc" }],
    select: { id: true, number: true, name: true, status: true },
  });
  return terms;
}

export type ClassOption = {
  id: string;
  code: string;
  name: string | null;
  levelLabel: string;
};

/** The classes of the year, for the picker and the generator. */
export async function listAssessableClasses(
  context: AuthContext,
): Promise<ClassOption[]> {
  const classes = await db.schoolClass.findMany({
    where: { levelOffering: yearScope(context), isActive: true },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      levelOffering: { select: { level: { select: { code: true, name: true } } } },
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    name: schoolClass.name,
    levelLabel: schoolClass.levelOffering.level.code,
  }));
}

export type ProgrammeEntry = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  coefficient: number;
};

/**
 * Each class's marked subjects, keyed by class id.
 *
 * Loaded for every class of the year in one pass so the generator dialog can
 * show the subject list the moment a class is picked, without a round trip. The
 * dataset is one school's classes — dozens of rows — so shipping it whole is far
 * simpler than fetching per class, and makes the picker feel instant.
 */
export async function loadProgrammesByClass(
  context: AuthContext,
): Promise<Record<string, ProgrammeEntry[]>> {
  const classes = await db.schoolClass.findMany({
    where: {
      levelOffering: yearScope(context),
      schoolId: context.currentSchool?.id ?? "__none__",
      isActive: true,
    },
    select: {
      id: true,
      levelOffering: { select: { levelId: true, trackId: true } },
    },
  });
  if (classes.length === 0) return {};

  const rows = await db.levelSubject.findMany({
    where: {
      levelId: {
        in: [...new Set(classes.map((c) => c.levelOffering.levelId))],
      },
      isGraded: true,
      subject: { isActive: true },
    },
    orderBy: [{ position: "asc" }],
    select: {
      levelId: true,
      trackId: true,
      coefficient: true,
      subject: { select: { id: true, code: true, name: true, parentId: true } },
    },
  });

  const result: Record<string, ProgrammeEntry[]> = {};

  for (const schoolClass of classes) {
    const { levelId, trackId } = schoolClass.levelOffering;

    // Same two rules as `resolveProgramme` in the service — this one exists to
    // *show* the list, that one to write it, and they must agree.
    const forClass = rows.filter(
      (row) =>
        row.levelId === levelId &&
        (row.trackId === null || row.trackId === trackId),
    );

    const parentsCoveredByComponents = new Set(
      forClass
        .map((row) => row.subject.parentId)
        .filter((parentId): parentId is string => parentId !== null),
    );

    result[schoolClass.id] = forClass
      .filter((row) => !parentsCoveredByComponents.has(row.subject.id))
      .map((row) => ({
        subjectId: row.subject.id,
        subjectCode: row.subject.code,
        subjectName: row.subject.name,
        coefficient: row.coefficient,
      }));
  }

  return result;
}

export type AssessmentRow = {
  id: string;
  title: string;
  sequence: number;
  status: string;
  /** `YYYY-MM-DD` for `<input type="date">`, null while only planned. */
  scheduledOn: string | null;
  maxScore: number;
  coefficient: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColorHex: string | null;
  typeId: string;
  typeName: string;
  typeCode: string;
  typeColorHex: string | null;
  classId: string;
  classCode: string;
  groupLabel: string | null;
  termId: string;
  termName: string;
  teacherName: string | null;
  /** Roster size for this paper — the whole class, or the group that sits it. */
  rosterCount: number;
  markedCount: number;
  absentCount: number;
  average: number | null;
};

export type AssessmentFilters = {
  classId?: string;
  termId?: string;
  /** Confines the list to one teacher's own papers — the workspace uses it. */
  teacherId?: string;
  /**
   * "CONTROLE" keeps the kinds a teacher may not set; "DEVOIR" keeps the ones
   * they may. The split is `AssessmentType.allowTeacherCreate`, so the vie
   * scolaire screen and the teacher's own list never show each other's work.
   */
  kind?: "CONTROLE" | "DEVOIR";
};

/**
 * The papers of a class and term, with how far along the marking is.
 *
 * The roster count is read per row rather than assumed from the class size,
 * because a paper set for one group is sat by that group only — reporting
 * "12/30 marked" for a half-class paper would look like a teacher was behind
 * when they had in fact finished.
 */
export async function listAssessments(
  context: AuthContext,
  filters: AssessmentFilters = {},
): Promise<AssessmentRow[]> {
  const assessments = await db.assessment.findMany({
    where: {
      ...schoolScope(context),
      // Bound to the selected year through the term, never by an id from the
      // request alone.
      term: yearScope(context),
      ...(filters.classId ? { schoolClassId: filters.classId } : {}),
      ...(filters.termId ? { termId: filters.termId } : {}),
      ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      ...(filters.kind
        ? {
            assessmentType: {
              allowTeacherCreate: filters.kind === "DEVOIR",
            },
          }
        : {}),
    },
    orderBy: [
      { term: { number: "asc" } },
      { sequence: "asc" },
      { subject: { code: "asc" } },
    ],
    select: {
      id: true,
      title: true,
      sequence: true,
      status: true,
      scheduledOn: true,
      maxScore: true,
      coefficient: true,
      classGroupId: true,
      subject: { select: { id: true, code: true, name: true, colorHex: true } },
      assessmentType: {
        select: { id: true, code: true, name: true, colorHex: true },
      },
      schoolClass: { select: { id: true, code: true } },
      classGroup: { select: { code: true, name: true } },
      term: { select: { id: true, name: true } },
      teacher: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      grades: { select: { score: true, isAbsent: true } },
    },
  });

  // One count per class/group the papers actually target, rather than a query
  // per row.
  const rosterCounts = await rosterSizes(
    context,
    assessments.map((assessment) => ({
      schoolClassId: assessment.schoolClass.id,
      classGroupId: assessment.classGroupId,
    })),
  );

  return assessments.map((assessment) => {
    const stats = markStatistics(
      assessment.grades.map((grade) => ({
        score: grade.score,
        isAbsent: grade.isAbsent,
      })),
      assessment.maxScore,
    );

    return {
      id: assessment.id,
      title: assessment.title,
      sequence: assessment.sequence,
      status: assessment.status,
      scheduledOn: assessment.scheduledOn
        ? toDateInputValue(assessment.scheduledOn)
        : null,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      subjectId: assessment.subject.id,
      subjectName: assessment.subject.name,
      subjectCode: assessment.subject.code,
      subjectColorHex: assessment.subject.colorHex,
      typeId: assessment.assessmentType.id,
      typeName: assessment.assessmentType.name,
      typeCode: assessment.assessmentType.code,
      typeColorHex: assessment.assessmentType.colorHex,
      classId: assessment.schoolClass.id,
      classCode: assessment.schoolClass.code,
      groupLabel: groupLabel(assessment.classGroup),
      termId: assessment.term.id,
      termName: assessment.term.name,
      teacherName: assessment.teacher
        ? displayName(assessment.teacher)
        : null,
      rosterCount:
        rosterCounts.get(
          rosterKey(assessment.schoolClass.id, assessment.classGroupId),
        ) ?? 0,
      markedCount: stats.markedCount,
      absentCount: stats.absentCount,
      average: stats.average,
    };
  });
}

/** A group is named by its own name when it has one, else by its code. */
function groupLabel(
  group: { code: string; name: string | null } | null | undefined,
): string | null {
  if (!group) return null;
  return group.name ?? group.code;
}

function rosterKey(schoolClassId: string, classGroupId: string | null): string {
  return `${schoolClassId}:${classGroupId ?? ""}`;
}

/** How many pupils sit each (class, group) pair, in one pass. */
async function rosterSizes(
  context: AuthContext,
  targets: { schoolClassId: string; classGroupId: string | null }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (targets.length === 0) return counts;

  const enrollments = await db.enrollment.findMany({
    where: {
      ...yearScope(context),
      schoolClassId: {
        in: [...new Set(targets.map((target) => target.schoolClassId))],
      },
      student: schoolScope(context),
    },
    select: { schoolClassId: true, classGroupId: true },
  });

  for (const target of targets) {
    const key = rosterKey(target.schoolClassId, target.classGroupId);
    if (counts.has(key)) continue;
    counts.set(
      key,
      enrollments.filter(
        (enrollment) =>
          enrollment.schoolClassId === target.schoolClassId &&
          // A whole-class paper is sat by everyone, whichever group they are in.
          (target.classGroupId === null ||
            enrollment.classGroupId === target.classGroupId),
      ).length,
    );
  }

  return counts;
}

export type MarkRow = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  groupLabel: string | null;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
};

export type MarkSheet = {
  assessment: AssessmentRow & { notes: string | null };
  rows: MarkRow[];
  statistics: MarkStatistics;
};

/**
 * One paper with its roster and whatever has been entered so far.
 *
 * The roster is the source of the rows, not the existing grades: a pupil
 * enrolled after the paper was generated must appear on the sheet waiting to be
 * marked rather than be silently missing from it.
 */
export async function findMarkSheet(
  context: AuthContext,
  assessmentId: string,
): Promise<MarkSheet | null> {
  const assessment = await db.assessment.findFirst({
    // Scoped by the school and the year in context, never by the id alone.
    where: {
      id: assessmentId,
      ...schoolScope(context),
      term: yearScope(context),
    },
    select: {
      id: true,
      title: true,
      sequence: true,
      status: true,
      scheduledOn: true,
      maxScore: true,
      coefficient: true,
      notes: true,
      classGroupId: true,
      subject: { select: { id: true, code: true, name: true, colorHex: true } },
      assessmentType: {
        select: { id: true, code: true, name: true, colorHex: true },
      },
      schoolClass: { select: { id: true, code: true } },
      classGroup: { select: { code: true, name: true } },
      term: { select: { id: true, name: true } },
      teacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      grades: {
        select: {
          enrollmentId: true,
          score: true,
          isAbsent: true,
          isExcused: true,
          comment: true,
        },
      },
    },
  });

  if (!assessment) return null;

  const roster = await db.enrollment.findMany({
    where: {
      ...yearScope(context),
      schoolClassId: assessment.schoolClass.id,
      student: schoolScope(context),
      ...(assessment.classGroupId
        ? { classGroupId: assessment.classGroupId }
        : {}),
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      classGroup: { select: { code: true, name: true } },
      student: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      },
    },
  });

  const byEnrollment = new Map(
    assessment.grades.map((grade) => [grade.enrollmentId, grade]),
  );

  const rows: MarkRow[] = roster.map((enrollment) => {
    const grade = byEnrollment.get(enrollment.id);
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.student.id,
      studentCode: enrollment.student.code,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      photoUrl: enrollment.student.photoUrl,
      groupLabel: groupLabel(enrollment.classGroup),
      score: grade?.score ?? null,
      isAbsent: grade?.isAbsent ?? false,
      isExcused: grade?.isExcused ?? false,
      comment: grade?.comment ?? null,
    };
  });

  const statistics = markStatistics(rows, assessment.maxScore);

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      sequence: assessment.sequence,
      status: assessment.status,
      scheduledOn: assessment.scheduledOn
        ? toDateInputValue(assessment.scheduledOn)
        : null,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      notes: assessment.notes,
      subjectId: assessment.subject.id,
      subjectName: assessment.subject.name,
      subjectCode: assessment.subject.code,
      subjectColorHex: assessment.subject.colorHex,
      typeId: assessment.assessmentType.id,
      typeName: assessment.assessmentType.name,
      typeCode: assessment.assessmentType.code,
      typeColorHex: assessment.assessmentType.colorHex,
      classId: assessment.schoolClass.id,
      classCode: assessment.schoolClass.code,
      groupLabel: groupLabel(assessment.classGroup),
      termId: assessment.term.id,
      termName: assessment.term.name,
      teacherName: assessment.teacher ? displayName(assessment.teacher) : null,
      rosterCount: rows.length,
      markedCount: statistics.markedCount,
      absentCount: statistics.absentCount,
      average: statistics.average,
    },
    rows,
    statistics,
  };
}

export type AssessmentSummary = {
  total: number
  /** Papers announced but not yet fully marked. */
  awaitingMarks: number;
  /** Papers still to be announced. */
  draft: number;
  /** Marks entered against the year so far. */
  gradesEntered: number;
};

/** The figures on the assessments screen and the vie scolaire dashboard. */
export async function assessmentSummary(
  context: AuthContext,
): Promise<AssessmentSummary> {
  const assessments = await db.assessment.findMany({
    where: { ...schoolScope(context), term: yearScope(context) },
    select: {
      status: true,
      classGroupId: true,
      schoolClassId: true,
      grades: { select: { score: true, isAbsent: true } },
    },
  });

  const rosterCounts = await rosterSizes(
    context,
    assessments.map((assessment) => ({
      schoolClassId: assessment.schoolClassId,
      classGroupId: assessment.classGroupId,
    })),
  );

  let awaitingMarks = 0;
  let draft = 0;
  let gradesEntered = 0;

  for (const assessment of assessments) {
    if (assessment.status === "DRAFT") draft += 1;

    const accounted = assessment.grades.filter(
      (grade) => grade.score !== null || grade.isAbsent,
    ).length;
    gradesEntered += accounted;

    const roster =
      rosterCounts.get(
        rosterKey(assessment.schoolClassId, assessment.classGroupId),
      ) ?? 0;

    if (assessment.status === "PUBLISHED" && accounted < roster) {
      awaitingMarks += 1;
    }
  }

  return {
    total: assessments.length,
    awaitingMarks,
    draft,
    gradesEntered,
  };
}
