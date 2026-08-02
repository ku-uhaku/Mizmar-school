import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import {
  COUNTED_STATUSES,
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
  /**
   * One paper for the whole matière rather than one per component — see
   * AssessmentType.gradesWholeSubject. Carried into the picker so switching the
   * kind switches which rows are ticked by default.
   */
  gradesWholeSubject: boolean;
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
      gradesWholeSubject: true,
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
  /** Which level offering it belongs to — what the "a level" scope groups on. */
  levelOfferingId: string;
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
      levelOfferingId: true,
      levelOffering: { select: { level: { select: { code: true, name: true } } } },
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    name: schoolClass.name,
    levelLabel: schoolClass.levelOffering.level.code,
    levelOfferingId: schoolClass.levelOfferingId,
  }));
}

export type ProgrammeEntry = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  /**
   * The matière this row is a component of — القراءة under اللغة العربية — or
   * null when it is a subject in its own right.
   *
   * Carried so the picker can group the components under their parent. A flat
   * list of leaf names is unreadable on a primary programme: half a dozen rows
   * called "القراءة", "التعبير الكتابي", "الإملاء" with nothing saying which
   * matière they belong to is exactly how the wrong paper gets ticked.
   */
  parentSubjectId: string | null;
  parentSubjectName: string | null;
  /**
   * How many components of this matière are on the same programme — 0 for a
   * component, and for a matière marked as one paper.
   *
   * What tells the picker whether this row *stands for* its components. A
   * contrôle is sat on اللغة العربية as a whole, so that row is the one ticked
   * and its four components sit under it as the exception; a devoir is sat on
   * الإملاء, so the components are the rows and the matière is not offered at
   * all. See AssessmentType.gradesWholeSubject.
   */
  componentCount: number;
  /**
   * Who would answer for the marks, resolved the same way the generator
   * resolves it — the primary TeachingAssignment for the subject, falling back
   * to the parent's for a component.
   *
   * Null means no post is filled, and the generator refuses the subject. Shown
   * in the picker so that refusal is visible *before* pressing Generate rather
   * than reported afterwards.
   */
  teacherName: string | null;
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

  // Who holds each subject in each class. Only the primary holder: a co-taught
  // subject still produces one paper, answerable to one person — the same rule
  // `generateAssessments` applies when it writes them.
  const assignments = await db.teachingAssignment.findMany({
    where: {
      schoolClassId: { in: classes.map((schoolClass) => schoolClass.id) },
      isPrimary: true,
    },
    select: {
      schoolClassId: true,
      subjectId: true,
      teacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const teacherByClassSubject = new Map(
    assignments.map((assignment) => [
      `${assignment.schoolClassId}:${assignment.subjectId}`,
      displayName(assignment.teacher),
    ]),
  );

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

    // Same rule 1 as `resolveProgramme` in the service — this one exists to
    // *show* the list, that one to write it, and they must agree.
    const forClass = rows.filter(
      (row) =>
        row.levelId === levelId &&
        (row.trackId === null || row.trackId === trackId),
    );

    /*
      Both halves of a split matière are offered, unlike the service's rule 2,
      which resolves the programme for one kind of paper at a time.

      The picker does not know which kind is being generated until the operator
      picks it, and switching from a contrôle to a devoir must not cost a round
      trip. So the list carries the matière *and* its components, `componentCount`
      says which is which, and the dialog shows the half that kind is sat on.
    */
    const componentCounts = new Map<string, number>();
    for (const row of forClass) {
      const parentId = row.subject.parentId;
      if (parentId === null) continue;
      componentCounts.set(parentId, (componentCounts.get(parentId) ?? 0) + 1);
    }

    // Parent names, for the component rows to be grouped under. Read off the
    // programme itself rather than fetched: a component's parent is on it by
    // construction.
    const nameById = new Map(
      forClass.map((row) => [row.subject.id, row.subject.name]),
    );

    result[schoolClass.id] = forClass.map((row) => {
      const parentId = row.subject.parentId;
      return {
        subjectId: row.subject.id,
        subjectCode: row.subject.code,
        subjectName: row.subject.name,
        coefficient: row.coefficient,
        parentSubjectId: parentId,
        parentSubjectName: parentId ? (nameById.get(parentId) ?? null) : null,
        componentCount: componentCounts.get(row.subject.id) ?? 0,
        // Same fallback as the generator's `teacherFor`: assignments are made
        // against the matière as taught, while the papers are per component.
        teacherName:
          teacherByClassSubject.get(`${schoolClass.id}:${row.subject.id}`) ??
          (parentId
            ? (teacherByClassSubject.get(`${schoolClass.id}:${parentId}`) ??
              null)
            : null),
      };
    });
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

// ── One pupil's marks ────────────────────────────────────────────────────────

export type PupilMark = {
  id: string;
  title: string;
  typeName: string;
  termName: string;
  scheduledOn: string | null;
  score: number | null;
  maxScore: number;
  /** The paper's weight inside its subject. */
  coefficient: number;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
  /** Whether this paper's kind moves the subject's average at all. */
  counts: boolean;
};

export type PupilSubjectMarks = {
  subjectId: string;
  subjectName: string;
  /** The subject's weight in the overall average, from the programme. */
  coefficient: number;
  marks: PupilMark[];
  /**
   * Weighted mean of the counted marks, on the school's own scale. Null when
   * nothing counted has been marked yet.
   */
  average: number | null;
};

export type PupilMarks = {
  subjects: PupilSubjectMarks[];
  /** Weighted by each subject's programme coefficient. Null when empty. */
  overall: number | null;
  /** The scale everything above is expressed on — the school's. */
  outOf: number;
  markedCount: number;
};

/**
 * A pupil's marks for the year, grouped by subject, with averages.
 *
 * ── What counts, and why ─────────────────────────────────────────────────────
 * Three filters, and each one is a decision a school actually makes:
 *
 *   * only papers in a `COUNTED_STATUSES` state — a draft nobody has sat is not
 *     a zero;
 *   * only kinds whose `countsTowardAverage` is on — a school marks work it
 *     shows the family but never averages;
 *   * absences are excluded rather than averaged as zero, exactly as
 *     `markStatistics` does under a mark sheet. A child who was not there has
 *     not demonstrated a zero.
 *
 * Every mark is normalised onto the school's scale before it is averaged, so a
 * paper set out of 10 does not silently count half. See SchoolSettings.
 *
 * Computed, never stored. A published bulletin would have to be frozen — that
 * is a different thing, and it is not this.
 */
export async function loadPupilMarks(
  context: AuthContext,
  enrollmentId: string,
): Promise<PupilMarks> {
  const outOf = context.settings.gradingMaxScore;

  const grades = await db.assessmentGrade.findMany({
    where: {
      enrollmentId,
      // The enrolment id comes from the URL; the school does not.
      enrollment: { schoolYear: schoolScope(context) },
      assessment: { status: { in: [...COUNTED_STATUSES] } },
    },
    orderBy: [{ assessment: { scheduledOn: "asc" } }],
    include: {
      assessment: {
        include: {
          subject: { select: { id: true, name: true } },
          assessmentType: { select: { name: true, countsTowardAverage: true } },
          term: { select: { name: true, number: true } },
        },
      },
    },
  });

  // The programme decides what each subject is worth overall. A subject with no
  // programme row still shows its marks — it just weighs 1, rather than
  // vanishing from a list the family expects to be complete.
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      levelOffering: {
        select: {
          levelId: true,
          trackId: true,
          level: {
            select: {
              subjects: {
                select: { subjectId: true, coefficient: true, trackId: true },
              },
            },
          },
        },
      },
    },
  });

  const weightOf = new Map<string, number>();
  for (const row of enrolment?.levelOffering.level.subjects ?? []) {
    // A track-specific weight wins over the level-wide one for that track.
    const applies =
      row.trackId === null || row.trackId === enrolment?.levelOffering.trackId;
    if (applies) weightOf.set(row.subjectId, row.coefficient);
  }

  const bySubject = new Map<string, PupilSubjectMarks>();

  for (const grade of grades) {
    const { assessment } = grade;
    const key = assessment.subject.id;

    let bucket = bySubject.get(key);
    if (!bucket) {
      bucket = {
        subjectId: key,
        subjectName: assessment.subject.name,
        coefficient: weightOf.get(key) ?? 1,
        marks: [],
        average: null,
      };
      bySubject.set(key, bucket);
    }

    bucket.marks.push({
      id: grade.id,
      title: assessment.title,
      typeName: assessment.assessmentType.name,
      termName: assessment.term.name,
      scheduledOn: assessment.scheduledOn?.toISOString() ?? null,
      score: grade.score,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      isAbsent: grade.isAbsent,
      isExcused: grade.isExcused,
      comment: grade.comment,
      counts: assessment.assessmentType.countsTowardAverage,
    });
  }

  for (const bucket of bySubject.values()) {
    bucket.average = weightedAverage(
      bucket.marks
        .filter((mark) => mark.counts && !mark.isAbsent && mark.score !== null)
        .map((mark) => ({
          // Normalised onto the school's scale before weighting.
          value: ((mark.score as number) / mark.maxScore) * outOf,
          weight: mark.coefficient,
        })),
    );
  }

  const subjects = [...bySubject.values()].sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName),
  );

  return {
    subjects,
    overall: weightedAverage(
      subjects
        .filter((subject) => subject.average !== null)
        .map((subject) => ({
          value: subject.average as number,
          weight: subject.coefficient,
        })),
    ),
    outOf,
    markedCount: grades.filter(
      (grade) => grade.score !== null || grade.isAbsent,
    ).length,
  };
}

/** Rounded to two decimals, like every other mark in the app. */
function weightedAverage(
  entries: readonly { value: number; weight: number }[],
): number | null {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return null;

  const total = entries.reduce(
    (sum, entry) => sum + entry.value * entry.weight,
    0,
  );
  return Math.round((total / totalWeight) * 100) / 100;
}
