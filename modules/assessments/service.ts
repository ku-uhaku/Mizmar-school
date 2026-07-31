import "server-only";

import { db } from "@/lib/db";
import {
  acceptsMarks,
  assessmentScopeKey,
  defaultAssessmentTitle,
  roundScore,
} from "@/modules/assessments/enums";

/**
 * Writes and invariants for the assessments module.
 *
 * The centrepiece is `generateAssessments`: a head of studies says "Contrôle
 * n°1, semester 1, class 3AP-A" and gets one paper per marked subject of that
 * class's programme, already weighted and already attributed to whoever teaches
 * it. Doing it by hand is a dozen near-identical forms per class per term, which
 * is how schools end up with a subject quietly missing from a report card.
 */

/** What a subject looks like once the programme has been resolved for a class. */
export type ProgrammeSubject = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /**
   * The subject this one is a component of, when it is one. Carried because
   * teaching assignments are made against the parent — see the teacher lookup
   * in `generateAssessments`.
   */
  parentSubjectId: string | null;
  /** Weight in the level average — carried for display, not written here. */
  coefficient: number;
};

/**
 * The subjects a class is actually marked in.
 *
 * ── The two rules that matter ────────────────────────────────────────────────
 * 1. A level's programme is "rows for this class's track" ∪ "rows with no
 *    track" — that is how the common subjects (Arabic, Islamic education, EPS)
 *    are declared once instead of per stream. See LevelSubject.trackId.
 *
 * 2. Where a subject is split into components at that level, the components are
 *    what get marked and the parent does not. اللغة العربية in 3AP is not sat as
 *    one paper; القراءة and التعبير الكتابي are, and the parent's mark is
 *    computed from them. Generating for both would double the subject.
 *
 * Ungraded rows — the support and activity slots that are timetabled but never
 * averaged — are excluded outright.
 */
export async function resolveProgramme(
  schoolClassId: string,
): Promise<ProgrammeSubject[]> {
  const schoolClass = await db.schoolClass.findUnique({
    where: { id: schoolClassId },
    select: {
      levelOffering: { select: { levelId: true, trackId: true } },
    },
  });
  if (!schoolClass) return [];

  const { levelId, trackId } = schoolClass.levelOffering;

  const rows = await db.levelSubject.findMany({
    where: {
      levelId,
      isGraded: true,
      // Rule 1: this track's rows plus the ones that apply to every track.
      OR: [{ trackId: null }, ...(trackId ? [{ trackId }] : [])],
      subject: { isActive: true },
    },
    orderBy: [{ position: "asc" }],
    select: {
      coefficient: true,
      subject: {
        select: { id: true, code: true, name: true, parentId: true },
      },
    },
  });

  // Rule 2: a parent that has at least one of its components in this same
  // programme is marked through them, not directly.
  const parentsCoveredByComponents = new Set(
    rows
      .map((row) => row.subject.parentId)
      .filter((parentId): parentId is string => parentId !== null),
  );

  return rows
    .filter((row) => !parentsCoveredByComponents.has(row.subject.id))
    .map((row) => ({
      subjectId: row.subject.id,
      subjectCode: row.subject.code,
      subjectName: row.subject.name,
      parentSubjectId: row.subject.parentId,
      coefficient: row.coefficient,
    }));
}

/** One line of the generator: a subject that was ticked, and its own date. */
export type GenerateTarget = {
  subjectId: string;
  /** Per subject, because a round of contrôles is sat over a week, not a day. */
  scheduledOn: Date | null;
};

export type GenerateInput = {
  schoolClassId: string;
  termId: string;
  assessmentTypeId: string;
  sequence: number;
  /**
   * Exactly the subjects to write, each with its own date.
   *
   * Explicit rather than "the whole programme" because a round is rarely the
   * whole programme: EPS does not sit a written contrôle, a subject may have
   * been covered already, and the papers are spread across a week rather than
   * all falling on one day. The caller ticks what it wants; this only checks
   * that each one really is on the class's programme.
   */
  targets: GenerateTarget[];
  createdById: string;
};

export type GenerateResult = {
  created: number;
  /** Subjects that already had this paper — the run is idempotent. */
  skipped: number;
  subjects: string[];
};

/**
 * Writes one paper per marked subject of a class's programme.
 *
 * Idempotent by construction: the unique index on
 * (class, subject, term, type, sequence, scopeKey) is what makes a second run a
 * no-op rather than a duplicate set, so a head of studies who is unsure whether
 * they already generated semester 1 can simply run it again.
 *
 * `maxScore` and `coefficient` are copied off the type rather than referenced
 * through it, so re-weighting the type next year cannot rescore marks already
 * entered. The teacher is resolved from the primary TeachingAssignment at
 * generation time and left null when the subject has none — a programme
 * routinely exists before every post is filled.
 *
 * Papers are created as DRAFT. Generating is planning; announcing them to the
 * classes is a separate, deliberate act — see `publishAssessments`.
 */
export async function generateAssessments(
  input: GenerateInput,
): Promise<GenerateResult> {
  const schoolClass = await db.schoolClass.findUnique({
    where: { id: input.schoolClassId },
    select: { id: true, schoolId: true },
  });
  if (!schoolClass) return { created: 0, skipped: 0, subjects: [] };

  const type = await db.assessmentType.findFirst({
    // Confined to the class's own school: the type and the class must belong
    // together, or one school's weighting would leak into another's marks.
    where: { id: input.assessmentTypeId, schoolId: schoolClass.schoolId },
    select: {
      id: true,
      name: true,
      defaultCoefficient: true,
      defaultMaxScore: true,
    },
  });
  if (!type) return { created: 0, skipped: 0, subjects: [] };

  const programme = await resolveProgramme(input.schoolClassId);
  if (programme.length === 0) return { created: 0, skipped: 0, subjects: [] };

  // Only subjects that are genuinely on this class's programme. A subject id
  // from the request that is not on it is dropped rather than written: the
  // picker offers the programme, so anything else was crafted.
  const onProgramme = new Map(
    programme.map((subject) => [subject.subjectId, subject]),
  );
  const requested = input.targets.filter((target) =>
    onProgramme.has(target.subjectId),
  );
  if (requested.length === 0) return { created: 0, skipped: 0, subjects: [] };

  const [existing, assignments] = await Promise.all([
    db.assessment.findMany({
      where: {
        schoolClassId: input.schoolClassId,
        termId: input.termId,
        assessmentTypeId: type.id,
        sequence: input.sequence,
      },
      select: { subjectId: true, scopeKey: true },
    }),
    // Only the primary holder per subject — a co-taught subject still produces
    // one paper, answerable to one person.
    db.teachingAssignment.findMany({
      where: { schoolClassId: input.schoolClassId, isPrimary: true },
      select: { subjectId: true, teacherId: true },
    }),
  ]);

  const wholeClassKey = assessmentScopeKey(null);
  const alreadySet = new Set(
    existing
      .filter((assessment) => assessment.scopeKey === wholeClassKey)
      .map((assessment) => assessment.subjectId),
  );
  const teacherBySubject = new Map(
    assignments.map((assignment) => [assignment.subjectId, assignment.teacherId]),
  );

  /**
   * Who answers for a component's marks.
   *
   * Assignments are made against the subject as taught — "Karim teaches Arabic
   * to 1AP-A" — while the papers are per *component*, since that is how primary
   * report cards mark them. Falling back to the parent's assignment is what
   * stops every component paper in the school coming out unattributed; without
   * it the lookup misses on القراءة and only ever matches the leaf subjects.
   */
  const teacherFor = (subject: ProgrammeSubject): string | null =>
    teacherBySubject.get(subject.subjectId) ??
    (subject.parentSubjectId
      ? (teacherBySubject.get(subject.parentSubjectId) ?? null)
      : null);

  const missing = requested.filter(
    (target) => !alreadySet.has(target.subjectId),
  );

  if (missing.length > 0) {
    await db.assessment.createMany({
      data: missing.map((target) => {
        // Non-null: `requested` was already filtered to the programme.
        const subject = onProgramme.get(target.subjectId)!;

        return {
          // Denormalised from the class, never taken from the request — see the
          // invariant on Assessment.schoolId.
          schoolId: schoolClass.schoolId,
          schoolClassId: schoolClass.id,
          classGroupId: null,
          subjectId: subject.subjectId,
          termId: input.termId,
          assessmentTypeId: type.id,
          sequence: input.sequence,
          title: defaultAssessmentTitle(type.name, input.sequence),
          scheduledOn: target.scheduledOn,
          maxScore: type.defaultMaxScore,
          coefficient: type.defaultCoefficient,
          status: "DRAFT",
          teacherId: teacherFor(subject),
          createdById: input.createdById,
          scopeKey: wholeClassKey,
        };
      }),
    });
  }

  return {
    created: missing.length,
    skipped: requested.length - missing.length,
    subjects: missing.map(
      (target) => onProgramme.get(target.subjectId)!.subjectName,
    ),
  };
}

export type MarkInput = {
  enrollmentId: string;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
};

export type SaveMarksResult =
  | { ok: true; saved: number }
  | { ok: false; reason: "not-found" | "locked" | "out-of-range" };

/**
 * Records a whole mark sheet in one transaction.
 *
 * Two invariants the database cannot express, both enforced here:
 *
 *   * a mark may only be entered against a paper that has actually been set —
 *     a DRAFT has not been sat and a CANCELLED one did not happen;
 *   * a mark must lie within the paper's own `maxScore`, which is per paper and
 *     not always 20.
 *
 * Rows are matched against the roster rather than trusted: an `enrollmentId`
 * from the request that is not seated in this class simply does not match, so a
 * crafted id cannot write a mark onto another class's pupil.
 */
export async function saveMarks(
  assessmentId: string,
  marks: MarkInput[],
  gradedById: string,
): Promise<SaveMarksResult> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      maxScore: true,
      status: true,
      schoolClassId: true,
      classGroupId: true,
    },
  });
  if (!assessment) return { ok: false, reason: "not-found" };
  if (!acceptsMarks(assessment.status)) return { ok: false, reason: "locked" };

  for (const mark of marks) {
    if (mark.score === null) continue;
    if (
      !Number.isFinite(mark.score) ||
      mark.score < 0 ||
      mark.score > assessment.maxScore
    ) {
      return { ok: false, reason: "out-of-range" };
    }
  }

  // The roster decides which rows are writable, so an id from the request that
  // is not on this paper reaches nothing.
  const roster = await db.enrollment.findMany({
    where: {
      schoolClassId: assessment.schoolClassId,
      ...(assessment.classGroupId
        ? { classGroupId: assessment.classGroupId }
        : {}),
    },
    select: { id: true },
  });
  const seated = new Set(roster.map((enrollment) => enrollment.id));

  const writable = marks.filter((mark) => seated.has(mark.enrollmentId));
  const gradedAt = new Date();

  await db.$transaction(
    writable.map((mark) => {
      const data = {
        // An absence is not a zero — see the note on AssessmentGrade.score.
        score: mark.isAbsent || mark.score === null ? null : roundScore(mark.score),
        isAbsent: mark.isAbsent,
        isExcused: mark.isAbsent ? mark.isExcused : false,
        comment: mark.comment,
        gradedById,
        gradedAt,
      };

      return db.assessmentGrade.upsert({
        where: {
          assessmentId_enrollmentId: {
            assessmentId: assessment.id,
            enrollmentId: mark.enrollmentId,
          },
        },
        create: {
          assessmentId: assessment.id,
          enrollmentId: mark.enrollmentId,
          ...data,
        },
        update: data,
      });
    }),
  );

  return { ok: true, saved: writable.length };
}

/**
 * Moves a paper's status, refusing the transitions that would lose marks.
 *
 * Going back to DRAFT once anything has been entered is refused rather than
 * silently allowed: DRAFT means "not sat", and a paper that is not sat with
 * marks against it is a contradiction somebody would have to unpick later.
 */
export async function setAssessmentStatus(
  assessmentId: string,
  status: string,
): Promise<{ ok: boolean; reason?: "has-marks" }> {
  if (status === "DRAFT") {
    const marked = await db.assessmentGrade.count({
      where: {
        assessmentId,
        OR: [{ score: { not: null } }, { isAbsent: true }],
      },
    });
    if (marked > 0) return { ok: false, reason: "has-marks" };
  }

  await db.assessment.update({
    where: { id: assessmentId },
    data: { status },
  });
  return { ok: true };
}
