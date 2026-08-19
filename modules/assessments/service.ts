import "server-only";

import { displayName } from "@/lib/dal";
import { db } from "@/lib/db";
import { resolveProgrammeRows } from "@/modules/academics/enums";
import {
  acceptsMarks,
  assessmentScopeKey,
  defaultAssessmentTitle,
  MAX_APPRECIATION_BANDS,
  planGradeCarry,
  pointsToQuarters,
  roundScore,
} from "@/modules/assessments/enums";
import { ASSESSMENT_PERMISSIONS } from "@/modules/assessments/permissions";
import {
  dispatch,
  guardiansOfClass,
  notify,
  staffHolding,
} from "@/modules/notifications/service";

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
 * 2. Where a subject is split into components at that level, **both halves are
 *    on the programme** — اللغة العربية itself and القراءة، الإملاء،
 *    التعبير الكتابي، الصرف والتحويل under it.
 *
 *    This used to depend on the kind of paper: a contrôle resolved the matières
 *    and a devoir the components, so whichever half the kind was not sat on was
 *    not merely unticked but absent. A school that ran one contrôle on
 *    الإملاء alone, or a devoir on the matière as a whole, had no way to say
 *    so — and the picker showing four component rows under a heading nobody
 *    could tick reads as a bug rather than a rule.
 *
 *    Offering both is safe because it only widens what may be *asked for*.
 *    Asking for both halves at once is settled in `generateAssessments`, which
 *    drops a component whose matière is in the same run rather than marking the
 *    same work twice. What the *kind* decides is only which half is ticked when
 *    the dialog opens — see AssessmentType.gradesWholeSubject.
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
      levelOffering: {
        select: { schoolYearId: true, levelId: true, trackId: true },
      },
    },
  });
  if (!schoolClass) return [];

  const { schoolYearId, levelId, trackId } = schoolClass.levelOffering;

  const declared = await db.levelSubject.findMany({
    where: {
      // The programme of the class's own year — a paper set in a past year is
      // weighted the way that year weighted it. See LevelSubject.
      schoolYearId,
      levelId,
      isGraded: true,
      // Rule 1: this track's rows plus the ones that apply to every track.
      OR: [{ trackId: null }, ...(trackId ? [{ trackId }] : [])],
      subject: { isActive: true },
    },
    orderBy: [{ position: "asc" }],
    select: {
      trackId: true,
      coefficient: true,
      subject: {
        select: { id: true, code: true, name: true, parentId: true },
      },
    },
  });

  // A subject declared both level-wide and for this track is one subject, not
  // two — the track's row wins. Left as a bare union it appeared twice on the
  // generator's picker, and the second tick wrote nothing but confused the
  // count. See `resolveProgrammeRows`.
  const rows = resolveProgrammeRows(
    declared.map((row) => ({ ...row, subjectId: row.subject.id })),
    trackId,
  );

  // Rule 2: both halves of a split matière, and the caller picks.
  return rows.map((row) => ({
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
  /**
   * What the paper covers — "leçon 3, p.42", "les fractions".
   *
   * Per subject for the same reason the date is: one round is one date on the
   * calendar but six different chapters, and a note written once for the whole
   * round would be true of none of them.
   */
  notes: string | null;
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
  /**
   * Subjects refused because no teacher holds them in this class, by name.
   *
   * A paper nobody answers for is not a plan, it is a gap: it appears on the
   * class's calendar, no mark sheet ever opens against it, and the subject's
   * average is quietly short one component at the end of term. Refusing is
   * louder than a null `teacherId`, and the fix — assign the post — is
   * something a head of studies can do in the next screen along.
   */
  unstaffed: string[];
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
 * generation time, and a subject with no holder is **refused** rather than
 * written unattributed — see `unstaffed` on the result.
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
  if (!schoolClass) return { created: 0, skipped: 0, subjects: [], unstaffed: [] };

  const type = await db.assessmentType.findFirst({
    // Confined to the class's own school: the type and the class must belong
    // together, or one school's weighting would leak into another's marks.
    where: { id: input.assessmentTypeId, schoolId: schoolClass.schoolId },
    select: {
      id: true,
      name: true,
      defaultCoefficient: true,
      defaultMaxScore: true,
      countsTowardAverage: true,
    },
  });
  if (!type) return { created: 0, skipped: 0, subjects: [], unstaffed: [] };

  const programme = await resolveProgramme(input.schoolClassId);
  if (programme.length === 0) return { created: 0, skipped: 0, subjects: [], unstaffed: [] };

  // Only subjects that are genuinely on this class's programme. A subject id
  // from the request that is not on it is dropped rather than written: the
  // picker offers the programme, so anything else was crafted.
  const onProgramme = new Map(
    programme.map((subject) => [subject.subjectId, subject]),
  );
  const onProgrammeTargets = input.targets.filter((target) =>
    onProgramme.has(target.subjectId),
  );

  /*
    A matière and its own component cannot both be marked in one round.

    Load-bearing, not a nicety: both halves are always on the programme now, so
    this is the only thing standing between a round and a double-counted matière
    at moyenne time. The picker keeps the two mutually exclusive, but a Server
    Function is reachable by direct POST — so the matière wins and the component
    is dropped, rather than the whole run being refused over a tick the operator
    cannot see.
  */
  const markedWhole = new Set(
    onProgrammeTargets
      .map((target) => onProgramme.get(target.subjectId)!)
      .filter((subject) => subject.parentSubjectId === null)
      .map((subject) => subject.subjectId),
  );
  const requested = onProgrammeTargets.filter((target) => {
    const parentId = onProgramme.get(target.subjectId)!.parentSubjectId;
    return parentId === null || !markedWhole.has(parentId);
  });

  if (requested.length === 0) return { created: 0, skipped: 0, subjects: [], unstaffed: [] };

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

  /*
    No teacher, no paper.

    A contrôle with a null `teacherId` looks planned and behaves like a hole:
    it shows on the class's calendar, no mark sheet ever opens against it, and
    the subject comes up short at moyenne time. So an unstaffed subject is
    refused and named back to the caller, rather than written and forgotten.

    Checked against what is *about* to be written, not against the whole
    programme: a subject already generated in an earlier run keeps its paper
    even if the post has since been vacated — undoing that is a deletion, and
    deletions are somebody's explicit decision.
  */
  const wanted = requested.filter((target) => !alreadySet.has(target.subjectId));

  const unstaffed = wanted.filter(
    (target) => teacherFor(onProgramme.get(target.subjectId)!) === null,
  );
  const missing = wanted.filter(
    (target) => teacherFor(onProgramme.get(target.subjectId)!) !== null,
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
          notes: target.notes,
          maxScore: type.defaultMaxScore,
          coefficient: type.defaultCoefficient,
          // Copied like the two above it, so re-configuring the kind later
          // cannot rescore a round already sat. See Assessment.
          countsTowardAverage: type.countsTowardAverage,
          status: "DRAFT",
          // Non-null: `missing` is exactly the targets that resolved a teacher.
          teacherId: teacherFor(subject),
          createdById: input.createdById,
          scopeKey: wholeClassKey,
        };
      }),
    });
  }

  return {
    created: missing.length,
    // Already had this paper. An unstaffed subject is *not* skipped — it was
    // refused, and it is reported separately so the message can say why.
    skipped: requested.length - wanted.length,
    subjects: missing.map(
      (target) => onProgramme.get(target.subjectId)!.subjectName,
    ),
    unstaffed: unstaffed.map(
      (target) => onProgramme.get(target.subjectId)!.subjectName,
    ),
  };
}

export type CreateDevoirInput = {
  /** From the session, never the form. */
  authorId: string;
  schoolId: string;
  schoolYearId: string;
  /**
   * Relaxes *which class* to the whole school — the office half of the pair,
   * `assessment.manage`. A head of studies covering for an absent colleague
   * sets work for a class they do not teach; a teacher without it is confined
   * to their own assignments exactly as before.
   */
  actsForSchool: boolean;
  schoolClassId: string;
  subjectId: string;
  termId: string;
  assessmentTypeId: string;
  title: string;
  notes: string | null;
  scheduledOn: Date;
  maxScore: number;
  coefficient: number;
  /**
   * Whether the marks move the subject's average. Undefined takes the kind's
   * own setting, which is what every caller that does not offer the choice —
   * the mobile route — wants.
   */
  countsTowardAverage?: boolean;
  questions: { text: string; points: number }[];
};

export type CreateDevoirResult =
  | { ok: true; assessmentId: string }
  | {
      ok: false;
      reason: "not-teaching" | "not-found" | "term-closed" | "kind-not-allowed";
    };

/**
 * A devoir, set by the teacher for their own class.
 *
 * The counterpart to `generateAssessments`: that one is a head of studies
 * planning a round across every subject, this one is a teacher setting a single
 * piece of work. Both write the same `Assessment` table — the difference is who
 * may, which is `AssessmentType.allowTeacherCreate`, and that the teaching
 * assignment is re-derived here rather than taken from the caller.
 *
 * Lives in the service rather than in the action because two surfaces set a
 * devoir now — the web form and the native app — and a rule enforced in one
 * caller is a rule the other silently does without.
 *
 * ── Created DRAFT, and why that is not ceremony ─────────────────────────────
 * It used to be created PUBLISHED, on the reasoning that a teacher setting a
 * devoir has already told the class about it. That reasoning was about the
 * *class*; the code it justified told the *families*, because PUBLISHED is what
 * fires `announceScheduled`. So a teacher on a phone could put a line on every
 * parent's lock screen with nobody at the school having seen it, and the office
 * was not told either — the paper existed, addressed to the families, and the
 * only party who could not see it was the direction.
 *
 * DRAFT is the stage the workflow already had a name for: TO_PUBLISH, "the
 * office has to open it before anybody can mark". Opening it is what announces
 * it to the families, so the school says it rather than the teacher, and it is
 * the same single decision that lets the marking start. The teacher is not left
 * waiting on a second decision later — there is one gate, not two.
 */
export async function createDevoir(
  input: CreateDevoirInput,
): Promise<CreateDevoirResult> {
  // The teacher's own assignment is the authority for both the class and the
  // subject — holding the permission is not enough to set work for a class
  // somebody else teaches.
  const assignment = await db.teachingAssignment.findFirst({
    where: {
      ...(input.actsForSchool ? {} : { teacherId: input.authorId }),
      schoolClassId: input.schoolClassId,
      subjectId: input.subjectId,
      schoolClass: {
        schoolId: input.schoolId,
        levelOffering: { schoolYearId: input.schoolYearId },
      },
    },
    select: {
      classGroupId: true,
      teacherId: true,
      schoolClass: { select: { id: true } },
    },
  });
  if (!assignment) return { ok: false, reason: "not-teaching" };

  const [term, type] = await Promise.all([
    db.term.findFirst({
      where: { id: input.termId, schoolYearId: input.schoolYearId },
      select: { id: true, status: true },
    }),
    db.assessmentType.findFirst({
      // Only a kind the school lets teachers set. Checked here and not only in
      // the picker, because the picker is client-side.
      where: {
        id: input.assessmentTypeId,
        schoolId: input.schoolId,
        allowTeacherCreate: true,
        isActive: true,
      },
      select: { id: true, countsTowardAverage: true },
    }),
  ]);

  if (!term) return { ok: false, reason: "not-found" };
  if (term.status === "CLOSED") return { ok: false, reason: "term-closed" };
  if (!type) return { ok: false, reason: "kind-not-allowed" };

  // The next free sequence for this kind, so two devoirs in one term do not
  // collide on the unique index.
  const last = await db.assessment.findFirst({
    where: {
      schoolClassId: assignment.schoolClass.id,
      subjectId: input.subjectId,
      termId: term.id,
      assessmentTypeId: type.id,
    },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  const created = await db.assessment.create({
    data: {
      schoolId: input.schoolId,
      schoolClassId: assignment.schoolClass.id,
      classGroupId: assignment.classGroupId,
      subjectId: input.subjectId,
      termId: term.id,
      assessmentTypeId: type.id,
      sequence: (last?.sequence ?? 0) + 1,
      title: input.title,
      notes: input.notes,
      scheduledOn: input.scheduledOn,
      maxScore: input.maxScore,
      coefficient: input.coefficient,
      // The kind's setting unless the form overrode it — a school running one
      // devoir kind that counts still has to be able to set a piece of revision
      // that does not. See Assessment.countsTowardAverage.
      countsTowardAverage:
        input.countsTowardAverage ?? type.countsTowardAverage,
      status: "DRAFT",
      // Answerable to whoever holds the class, not to whoever typed it in: an
      // office user setting work for a colleague must not end up owning the
      // mark sheet. Falls back to the author when the post is vacant.
      teacherId: assignment.teacherId ?? input.authorId,
      createdById: input.authorId,
      scopeKey: assessmentScopeKey(assignment.classGroupId),
      // Numbered here, from the order they were typed in — `position` is the
      // paper's own order and must not depend on how the rows come back.
      questions: {
        create: input.questions.map((question, index) => ({
          position: index + 1,
          text: question.text,
          pointsQuarters: pointsToQuarters(question.points),
        })),
      },
    },
    select: { id: true },
  });

  /*
    The office, and deliberately not the families.

    A devoir is written DRAFT — see the note above — so nothing has been said to
    anybody yet, and this is the line that stops that from meaning "nothing
    happens". The families are told by `announceScheduled` when the office opens
    it, which is the same road a generated contrôle takes.
  */
  await dispatch("ASSESSMENT_CREATED", () =>
    tellTheOfficeAboutNewDevoir(created.id, input.authorId),
  );

  return { ok: true, assessmentId: created.id };
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

/** What moving a pupil did to their marks. */
export type CarriedGrades = {
  /** Re-pointed at the new class's equivalent paper. */
  moved: number;
  /** Left on the old class's paper because the new class has no equivalent. */
  left: number;
};

/**
 * Carries a pupil's marks over to their new class when they change class.
 *
 * ── Why the marks have to move at all ────────────────────────────────────────
 * A mark is keyed on the enrolment but the paper it is a mark *on* is keyed on
 * the class, so a pupil who moves in March leaves every mark they have earned
 * behind on papers their new class will never read. Left alone that is not a
 * tidiness problem, it is a wrong report card: `computeClassBulletins` reads
 * the term's marks for the class it is computing, and the child arrives in
 * 3AP-B with an empty term and a general average built out of whatever they
 * have sat since the move.
 *
 * So each mark is re-pointed at the paper in the new class that is *the same
 * paper*: same subject, same term, same kind, same sequence. Both classes sit
 * under one level offering — `assignClass` refuses a class of another level —
 * so they share a programme and the equivalent paper almost always exists.
 *
 * ── Why it asks the marks where they are, and not the enrolment ──────────────
 * There is no `fromClassId` parameter on purpose. The class roster moves a
 * pupil in two steps — the picker offers only unseated children, so 3AP-A ends
 * with `schoolClassId: null` and 3AP-B seats them from there — and a carry that
 * read the previous value of that column saw `null` on the step that matters
 * and did nothing. The marks themselves are the honest answer to "where has
 * this child been": anything of theirs sitting on another class's paper is
 * stranded, however they got there and however many steps it took.
 *
 * ── What is deliberately not moved ───────────────────────────────────────────
 * A mark with no equivalent in the new class stays where it is rather than
 * causing a paper to be created. Generating one would put a contrôle on the new
 * class's calendar that nobody set and show every other pupil in it as
 * unmarked. Those marks keep counting instead: `loadClassTermMarks` and
 * `loadPupilMarks` both read a pupil's marks by enrolment, wherever the paper
 * sits.
 *
 * Bulletins do not move and are not touched. A bulletin freezes its own class
 * and its own figures precisely so that a mark corrected — or carried — later
 * cannot rewrite the document a family was handed. See Bulletin.schoolClassId.
 */
export async function carryGradesToClass(input: {
  enrollmentId: string;
  toClassId: string;
  toClassGroupId: string | null;
}): Promise<CarriedGrades> {
  const held = await db.assessmentGrade.findMany({
    where: {
      enrollmentId: input.enrollmentId,
      // Everything of theirs that is not already on the class they now sit in.
      // A pupil who has never moved matches nothing and this costs one index
      // read, which is why seating may call it unconditionally.
      assessment: { schoolClassId: { not: input.toClassId } },
    },
    select: {
      id: true,
      assessment: {
        select: {
          subjectId: true,
          termId: true,
          assessmentTypeId: true,
          sequence: true,
        },
      },
    },
  });
  if (held.length === 0) return { moved: 0, left: 0 };

  const candidates = await db.assessment.findMany({
    where: {
      schoolClassId: input.toClassId,
      termId: { in: [...new Set(held.map((grade) => grade.assessment.termId))] },
      // A paper of a group the pupil is not in is not their paper. Whole-class
      // papers apply to everyone; the group's own only once they are in it.
      OR: [{ classGroupId: null }, { classGroupId: input.toClassGroupId }],
    },
    select: {
      id: true,
      subjectId: true,
      termId: true,
      assessmentTypeId: true,
      sequence: true,
      classGroupId: true,
      // A pupil returning to a class they once sat in may already hold the row
      // a mark would land on. Read here rather than as a second query so the
      // collision is known before anything is written.
      grades: {
        where: { enrollmentId: input.enrollmentId },
        select: { id: true },
      },
    },
  });

  const { moves, left } = planGradeCarry(held, candidates);

  if (moves.length > 0) {
    await db.$transaction(
      moves.map((move) =>
        db.assessmentGrade.update({
          where: { id: move.id },
          data: { assessmentId: move.assessmentId },
        }),
      ),
    );
  }

  return { moved: moves.length, left };
}

/**
 * Pupils on the roster with neither a mark nor an absence against them.
 *
 * Counted from the roster rather than from the grades, because a pupil enrolled
 * after the paper was set has no grade row at all and is exactly the kind of
 * gap "is this finished?" has to catch.
 *
 * Only grades belonging to pupils *still on the roster* are counted as
 * accounted for. A pupil who moved to another class since the paper was set
 * leaves the roster but may leave a mark behind on it — see
 * `carryGradesToClass` — and counting that mark against the smaller roster hid
 * a pupil who had genuinely not been marked, so the sheet reported itself
 * finished and could be accepted as GRADED with a hole in it.
 */
async function countPendingMarks(assessmentId: string): Promise<number> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      schoolClassId: true,
      classGroupId: true,
      term: { select: { schoolYearId: true } },
      grades: {
        where: { OR: [{ score: { not: null } }, { isAbsent: true }] },
        select: { enrollmentId: true },
      },
    },
  });
  if (!assessment) return 0;

  const roster = await db.enrollment.findMany({
    where: {
      schoolYearId: assessment.term.schoolYearId,
      schoolClassId: assessment.schoolClassId,
      ...(assessment.classGroupId
        ? { classGroupId: assessment.classGroupId }
        : {}),
    },
    select: { id: true },
  });
  const seated = new Set(roster.map((enrollment) => enrollment.id));

  const accounted = assessment.grades.filter((grade) =>
    seated.has(grade.enrollmentId),
  ).length;

  return Math.max(0, roster.length - accounted);
}

/**
 * Moves a paper's status, refusing the transitions that would lose marks or
 * declare a sheet finished when it is not.
 *
 * Going back to DRAFT once anything has been entered is refused rather than
 * silently allowed: DRAFT means "not sat", and a paper that is not sat with
 * marks against it is a contradiction somebody would have to unpick later.
 */
export async function setAssessmentStatus(
  assessmentId: string,
  status: string,
): Promise<{ ok: boolean; reason?: "has-marks" | "incomplete" }> {
  if (status === "GRADED") {
    /*
      Accepting a paper is the office agreeing the marking is done, so it may
      not be done over an unfinished sheet. Absences count as accounted for — a
      pupil who did not sit it has been dealt with.

      Except on a paper that counts for nothing. The completeness rule exists to
      protect the average: a hole in a counted sheet is a pupil silently left
      out of their own moyenne. A paper outside the average has no such hole to
      leave, and plenty of the work a school records this way is never marked
      pupil by pupil at all — an exercise set, returned and noted. Holding those
      in the validation queue for marks nobody intends to enter would make the
      queue mean nothing, which is the one thing it has to keep meaning.
    */
    const paper = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: { countsTowardAverage: true },
    });

    if (paper?.countsTowardAverage !== false) {
      const pending = await countPendingMarks(assessmentId);
      if (pending > 0) return { ok: false, reason: "incomplete" };
    }
  }

  if (status === "DRAFT") {
    const marked = await db.assessmentGrade.count({
      where: {
        assessmentId,
        OR: [{ score: { not: null } }, { isAbsent: true }],
      },
    });
    if (marked > 0) return { ok: false, reason: "has-marks" };
  }

  // Read before the write, because whether the families are told depends on
  // where the paper is coming *from* and not only where it lands. See below.
  const before = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { status: true },
  });

  await db.assessment.update({
    where: { id: assessmentId },
    data: { status },
  });

  if (status === "GRADED") {
    await dispatch("MARKS_PUBLISHED", () => tellAboutValidation(assessmentId));
  }

  /*
    The other half of the correction workflow.

    A teacher finishing a mark sheet hands it up — SUBMITTED — and then nothing
    happens until somebody at the office notices. That wait is the gap this
    closes, and it is the same gap `REQUEST_FILED` closes for a dossier: work
    arriving on a queue nobody has a reason to open.

    To whoever may actually validate it, which is ASSESSMENT_PUBLISH — the code
    that opens the marks to families. The teacher who pressed submit is not
    excluded: an office user who also teaches has genuinely just created work
    for themselves and should see it on the same list as the rest.
  */
  if (status === "SUBMITTED") {
    await dispatch("ASSESSMENT_SUBMITTED", () => tellTheOffice(assessmentId));
  }

  /*
    The other end of the same workflow: a paper being announced to the classes
    that will sit it. See `announceScheduled`.

    Only out of DRAFT, which is narrower than it looks and is the point. The
    other road to PUBLISHED is a teacher taking back a paper they had handed in
    — SUBMITTED → PUBLISHED — and that is a correction to their own mark sheet,
    not an announcement. Firing here would have let a teacher reach every family
    of the class directly, and `dedupeKeyFor` only hid it: the line was
    suppressed because the office's own announcement had already used the key.
    On a devoir, which is now never announced at creation, nothing would have
    used that key and the take-back would have been the first thing the families
    heard — from the teacher, with no decision behind it.
  */
  if (status === "PUBLISHED" && before?.status === "DRAFT") {
    await dispatch("ASSESSMENT_SCHEDULED", () => announceScheduled(assessmentId));
  }

  return { ok: true };
}

/**
 * Validation is the moment two different people need telling.
 *
 * The families, because GRADED is precisely what makes a mark visible to them —
 * `FAMILY_VISIBLE_STATUSES` is the one status in that list, so this event and
 * "the marks appeared on the phone" are the same event. And the teacher, whose
 * paper has just been accepted and who otherwise finds out by going back to
 * look at a list.
 *
 * Every guardian of the class is resolved through the enrolments rather than
 * the grade rows: a pupil sitting in the class with no mark yet is still one
 * whose family will see the sheet, and dedupe on the assessment id means the
 * whole thing is one line per reader however many marks it carries.
 */
async function tellAboutValidation(assessmentId: string): Promise<void> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      schoolId: true,
      schoolClassId: true,
      classGroupId: true,
      teacherId: true,
      subject: { select: { name: true } },
      school: { select: { organizationId: true } },
    },
  });
  if (!assessment) return;

  const organizationId = assessment.school.organizationId;

  await notify({
    organizationId,
    schoolId: assessment.schoolId,
    kind: "MARKS_PUBLISHED",
    subjectId: assessment.id,
    params: { subject: assessment.subject.name },
    // The group, where the paper has one: a TP mark sheet covers half the
    // class, and the other half has no mark on it to be told about.
    targets: await guardiansOfClass(
      assessment.schoolClassId,
      assessment.classGroupId,
    ),
  });

  // A paper with no teacher on it is one whose account has since been removed —
  // `Assessment.teacherId` is SetNull. Nobody to tell, and not an error.
  if (assessment.teacherId) {
    await notify({
      organizationId,
      schoolId: assessment.schoolId,
      kind: "ASSESSMENT_VALIDATED",
      subjectId: assessment.id,
      params: { assessment: assessment.title },
      targets: [{ userId: assessment.teacherId }],
    });
  }
}

/**
 * "Il y a un contrôle vendredi."
 *
 * ── Announcing, not creating ────────────────────────────────────────────────
 * Both roads into this function are the moment a paper becomes real to a class:
 * a teacher's devoir, which is created PUBLISHED because setting one *is*
 * telling the class; and a generated contrôle, which is written DRAFT by the
 * head of studies and announced later. Generating a whole term's papers must
 * not notify — that is planning, and a family would get a dozen lines about
 * dates nobody has committed to yet.
 *
 * Only when a date was given. A paper with no `scheduledOn` is a mark sheet for
 * work already handed in: there is nothing for a family to put in a diary, and
 * a line saying a paper exists without saying when only prompts the question it
 * fails to answer.
 *
 * Scoped to the group where there is one — a paper set for the TP half is sat
 * by half the class, and telling the other half is telling them something
 * untrue. Deduplicated on the paper's id, so announcing it twice tells a family
 * once.
 */
async function announceScheduled(assessmentId: string): Promise<void> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      schoolId: true,
      schoolClassId: true,
      classGroupId: true,
      scheduledOn: true,
      status: true,
      subject: { select: { name: true } },
      school: { select: { organizationId: true } },
    },
  });

  if (!assessment?.scheduledOn) return;
  // A cancelled paper is not an announcement, and a draft has not been made
  // one yet. Re-checked here rather than trusted from the caller so the two
  // roads in cannot disagree.
  if (assessment.status !== "PUBLISHED") return;

  await notify({
    organizationId: assessment.school.organizationId,
    schoolId: assessment.schoolId,
    kind: "ASSESSMENT_SCHEDULED",
    subjectId: assessment.id,
    params: {
      title: assessment.title,
      subject: assessment.subject.name,
      date: assessment.scheduledOn.toISOString(),
    },
    targets: await guardiansOfClass(
      assessment.schoolClassId,
      assessment.classGroupId,
    ),
  });
}

/**
 * Puts a teacher's new devoir in front of whoever may open it.
 *
 * The class code is on the line because that is what makes it decidable at a
 * glance — "3AP-A already has two this week" is the judgement being asked for,
 * and it cannot be made from a title alone.
 *
 * The author is excluded even when they hold the code: an office user setting
 * work for a class they teach has not created a decision for themselves. Same
 * rule as `tellTheOfficeAboutRemark`, and deliberately the opposite of
 * `tellTheOffice` below — handing marks up *is* work for whoever validates them,
 * including yourself.
 */
async function tellTheOfficeAboutNewDevoir(
  assessmentId: string,
  authorId: string,
): Promise<void> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      schoolId: true,
      subject: { select: { name: true } },
      schoolClass: { select: { code: true } },
      school: { select: { organizationId: true } },
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!assessment) return;

  const organizationId = assessment.school.organizationId;

  const targets = (
    await staffHolding(
      organizationId,
      assessment.schoolId,
      ASSESSMENT_PERMISSIONS.ASSESSMENT_PUBLISH,
    )
  ).filter((target) => target.userId !== authorId);

  await notify({
    organizationId,
    schoolId: assessment.schoolId,
    kind: "ASSESSMENT_CREATED",
    subjectId: assessment.id,
    params: {
      assessment: `${assessment.title} — ${assessment.subject.name}`,
      className: assessment.schoolClass.code,
      teacher: assessment.teacher ? displayName(assessment.teacher) : "—",
    },
    targets,
  });
}

/**
 * Puts a corrected paper on the office's list.
 *
 * The teacher's name is on it because that is what the office reads the list
 * by — "les copies de Mme Bennani sont prêtes" — and it degrades to nothing
 * rather than to a blank when the post is vacant.
 */
async function tellTheOffice(assessmentId: string): Promise<void> {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      schoolId: true,
      subject: { select: { name: true } },
      school: { select: { organizationId: true } },
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!assessment) return;

  const organizationId = assessment.school.organizationId;

  await notify({
    organizationId,
    schoolId: assessment.schoolId,
    kind: "ASSESSMENT_SUBMITTED",
    subjectId: assessment.id,
    params: {
      assessment: `${assessment.title} — ${assessment.subject.name}`,
      // Through the DAL's own helper, so a teacher with no profile row reads
      // the same here as everywhere else rather than as a blank.
      teacher: assessment.teacher ? displayName(assessment.teacher) : "—",
    },
    targets: await staffHolding(
      organizationId,
      assessment.schoolId,
      ASSESSMENT_PERMISSIONS.ASSESSMENT_PUBLISH,
    ),
  });
}

export type BandInput = {
  minPercentBps: number;
  label: string;
  labelAr: string | null;
  colorHex: string | null;
  isActive: boolean;
};

export type SaveScaleResult =
  | { ok: true; saved: number }
  | { ok: false; reason: "duplicate-floor" | "too-many" | "out-of-range" };

/**
 * Rewrites a school's appréciation scale in one transaction.
 *
 * ── Why the whole scale and not one rung at a time ──────────────────────────
 * The rungs are only meaningful against each other: a band's ceiling is the
 * next one's floor, so moving one moves its neighbour's range too. Saving them
 * one at a time would mean a scale that is briefly wrong between two writes,
 * and — worse — a floor that collides with another rung's would be refused by
 * the unique index halfway through a reshuffle the user thought was one edit.
 *
 * Rungs the form no longer carries are gone afterwards. That is safe in a way
 * it is not for most tables: nothing points at a band. A remark is copied onto
 * the mark as text when it is entered, so rewriting the scale cannot change
 * what a bulletin already said.
 *
 * Invariants the database cannot express, all enforced here:
 *
 *   * a floor lies in 0..10000 — it is a share of the paper, not a mark;
 *   * no two rungs share a floor, so a mark cannot land on two remarks (the
 *     unique index says so too, but a caught error is a 500 and this is a
 *     message the teacher can act on);
 *   * a scale is capped, because past a dozen rungs it stops being a scale.
 */
export async function saveAppreciationScale(
  schoolId: string,
  bands: BandInput[],
): Promise<SaveScaleResult> {
  if (bands.length > MAX_APPRECIATION_BANDS) {
    return { ok: false, reason: "too-many" };
  }

  for (const band of bands) {
    if (
      !Number.isInteger(band.minPercentBps) ||
      band.minPercentBps < 0 ||
      band.minPercentBps > 10_000
    ) {
      return { ok: false, reason: "out-of-range" };
    }
  }

  const floors = new Set(bands.map((band) => band.minPercentBps));
  if (floors.size !== bands.length) {
    return { ok: false, reason: "duplicate-floor" };
  }

  // Cleared and rewritten rather than reconciled row by row, and scoped by the
  // school so nothing outside it is touched. The floors carry a unique index,
  // so swapping two rungs over would collide halfway through a reconciliation
  // the user thought was one edit; writing against an empty slate cannot.
  await db.$transaction([
    db.appreciationBand.deleteMany({ where: { schoolId } }),
    db.appreciationBand.createMany({
      data: bands.map((band) => ({
        schoolId,
        minPercentBps: band.minPercentBps,
        label: band.label,
        labelAr: band.labelAr,
        colorHex: band.colorHex,
        isActive: band.isActive,
      })),
    }),
  ]);

  return { ok: true, saved: bands.length };
}
