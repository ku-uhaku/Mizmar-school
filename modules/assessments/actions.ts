"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, ForbiddenError, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, listField, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { currentSchoolYearId } from "@/lib/scope";
import {
  createDevoir,
  generateAssessments,
  saveAppreciationScale,
  saveMarks,
  setAssessmentStatus,
  type BandInput,
  type MarkInput,
} from "@/modules/assessments/service";
import {
  appreciationBandSchema,
  assessmentSchema,
  massarCodeSchema,
  generateSchema,
  statusSchema,
} from "@/modules/assessments/validation";
import {
  MAX_APPRECIATION_BANDS,
  NOTES_MAX,
} from "@/modules/assessments/enums";
import { devoirSchema } from "@/modules/classroom/validation";

/**
 * Actions for the assessments module.
 *
 * The school comes from the working context, never from the form, and every id
 * that arrives in a request — a class, a term, a paper — is re-derived against
 * that context before anything is written. These endpoints decide what appears
 * on a child's report card, so a crafted id must not be able to reach another
 * school's marks.
 */

async function schoolContext() {
  const t = await getDictionary();
  const context = await requireAuth();
  return { t, context, schoolId: context.currentSchool?.id };
}

/**
 * Confirms a paper belongs to the school and year in context, and hands back
 * what the callers need. Returns null when it does not — the action then
 * reports "not found" rather than revealing that it exists elsewhere.
 */
async function findScopedAssessment(
  schoolId: string,
  assessmentId: string,
  /**
   * Narrows to one teacher's own papers. Used by the moves a teacher may make
   * on their own marking — a `where` rather than a check afterwards, so asking
   * about a colleague's paper is indistinguishable from asking about one that
   * does not exist.
   */
  scope: {
    teacherId?: string;
    /**
     * Narrows to the papers this reader may actually open, which is not the
     * same as the papers of their school.
     *
     * `findMarkSheet` refuses a colleague's devoir — a piece of work a teacher
     * set for their own class is theirs — but the write path used to ask only
     * for the school and the year, so a mark could be posted onto a sheet the
     * poster could not read. A Server Function is reachable by direct POST, so
     * the two must agree; this is that same clause, and it lives beside the
     * read it mirrors.
     */
    readableBy?: string;
  } = {},
) {
  const context = await requireAuth();
  return db.assessment.findFirst({
    where: {
      id: assessmentId,
      schoolId,
      term: { schoolYearId: currentSchoolYearId(context) },
      ...(scope.teacherId ? { teacherId: scope.teacherId } : {}),
      ...(scope.readableBy
        ? {
            OR: [
              // Anybody's to mark: the kinds only the office may set. Covering
              // for an absent colleague is the ordinary case.
              { assessmentType: { allowTeacherCreate: false } },
              { teacherId: scope.readableBy },
              { createdById: scope.readableBy },
            ],
          }
        : {}),
    },
    select: { id: true, status: true, maxScore: true },
  });
}

/**
 * Generates one paper per marked subject of a class's programme.
 *
 * Gated on ASSESSMENT_MANAGE rather than ASSESSMENT_GRADE: writing a term's
 * contrôles across every subject of a class is a head of studies' decision, and
 * a teacher who may enter marks has no business setting the calendar.
 */
export async function generateAssessmentsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);
    if (!context.currentSchoolYear) {
      return failure(t.errors.noSchoolYearContext);
    }

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_MANAGE);

    const parsed = generateSchema(t).safeParse({
      scope: field(formData, "scope") || "CLASS",
      schoolClassId: field(formData, "schoolClassId"),
      levelOfferingId: field(formData, "levelOfferingId"),
      termId: field(formData, "termId"),
      assessmentTypeId: field(formData, "assessmentTypeId"),
      sequence: field(formData, "sequence"),
      scheduledOn: field(formData, "scheduledOn"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    /*
      The classes to write for, always re-derived against the working context so
      no id in the request can reach outside the school and year in play.

      The three scopes narrow the same query rather than taking three paths:
      CLASS pins the class, LEVEL pins its offering, YEAR pins nothing beyond
      the year itself. Inactive classes are left out of the wider scopes — a
      class kept for last year's records should not gain this year's papers.
    */
    const classWhere =
      parsed.data.scope === "CLASS"
        ? { id: parsed.data.schoolClassId ?? "__none__" }
        : parsed.data.scope === "LEVEL"
          ? {
              isActive: true,
              levelOfferingId: parsed.data.levelOfferingId ?? "__none__",
            }
          : { isActive: true };

    const [classes, term] = await Promise.all([
      db.schoolClass.findMany({
        where: {
          ...classWhere,
          schoolId,
          levelOffering: { schoolYearId: context.currentSchoolYear.id },
        },
        orderBy: { code: "asc" },
        select: { id: true, code: true },
      }),
      db.term.findFirst({
        where: {
          id: parsed.data.termId,
          schoolYearId: context.currentSchoolYear.id,
        },
        select: { id: true, status: true },
      }),
    ]);

    if (classes.length === 0 || !term) return failure(t.errors.notFound);
    if (term.status === "CLOSED") return failure(t.assessment.termClosed);

    /*
      The ticked subjects travel as `subjectId:YYYY-MM-DD` pairs, one per
      subject, so each paper carries its own date — a round of contrôles is sat
      across a week, not all on one morning. An empty date half means "not dated
      yet", which is an ordinary state for a paper planned in September.

      What the paper covers rides alongside as `subjectId:note`, in its own list
      rather than a third part of the same string: a note is free text and would
      have to be escaped out of a delimited field, which is how a colon in
      "chapitre 3: les fractions" ends up truncating it.
    */
    const noteBySubject = new Map(
      listField(formData, "targetNote")
        .map((entry) => {
          const separator = entry.indexOf(":");
          if (separator === -1) return null;
          const subjectId = entry.slice(0, separator);
          const note = entry.slice(separator + 1).trim();
          return subjectId === "" || note === ""
            ? null
            : ([subjectId, note.slice(0, NOTES_MAX)] as const);
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    );

    const targets = listField(formData, "target")
      .map((entry) => {
        const separator = entry.indexOf(":");
        if (separator === -1) return null;
        const subjectId = entry.slice(0, separator);
        const rawDate = entry.slice(separator + 1);
        if (subjectId === "") return null;

        const date = rawDate === "" ? null : new Date(rawDate);
        return {
          subjectId,
          scheduledOn:
            date && !Number.isNaN(date.getTime())
              ? date
              : parsed.data.scheduledOn,
          notes: noteBySubject.get(subjectId) ?? null,
        };
      })
      .filter(
        (target): target is NonNullable<typeof target> => target !== null,
      );

    if (targets.length === 0) return failure(t.assessment.noSubjectsChosen);

    /*
      One run per class, aggregated.

      Sequential rather than in parallel: each run reads the class's programme
      and its teaching assignments, and a whole year at once would open a
      connection per class against SQLite for no gain — the work is small and
      the screen is used a handful of times a term.

      `generateAssessments` only writes subjects that are genuinely on the
      class's own programme, so a wider scope can be handed the union of every
      level's subjects and each class still gets exactly its own.
    */
    let created = 0;
    let skipped = 0;
    const unstaffedSubjects = new Set<string>();

    for (const schoolClass of classes) {
      const result = await generateAssessments({
        schoolClassId: schoolClass.id,
        termId: term.id,
        assessmentTypeId: parsed.data.assessmentTypeId,
        sequence: parsed.data.sequence,
        targets,
        createdById: context.user.id,
      });
      created += result.created;
      skipped += result.skipped;
      for (const subject of result.unstaffed) unstaffedSubjects.add(subject);
    }

    const result = {
      created,
      skipped,
      unstaffed: [...unstaffedSubjects].sort(),
    };

    refresh();

    /*
      Three outcomes worth telling apart, because they need three different
      next actions: nothing was wanted (already generated), something was
      wanted but nobody teaches it (go and fill the post), or papers were
      written. The unstaffed list is named rather than counted — "Maths, SVT"
      is actionable and "2 subjects" is a second question.
    */
    const unstaffed = result.unstaffed.join(", ");

    if (result.created === 0) {
      if (result.unstaffed.length > 0) {
        return failure(
          interpolate(t.assessment.noTeacherAssigned, { subjects: unstaffed }),
        );
      }
      return result.skipped > 0
        ? success(t.assessment.nothingToGenerate)
        : failure(t.assessment.noProgramme);
    }

    const message = interpolate(t.assessment.generatedAcross, {
      count: result.created,
      classes: classes.length,
    });

    // Partial success is still a success — the papers that could be written
    // were — but it must not look clean when a subject was left out.
    return success(
      result.unstaffed.length > 0
        ? `${message} ${interpolate(t.assessment.noTeacherAssigned, {
            subjects: unstaffed,
          })}`
        : message,
    );
  });
}

/** Edits one paper: its title, when it is sat, and how it is weighted. */
export async function saveAssessmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_MANAGE);

    const id = field(formData, "id");
    const existing = await findScopedAssessment(schoolId, id);
    if (!existing) return failure(t.errors.notFound);

    const parsed = assessmentSchema(t).safeParse({
      title: field(formData, "title"),
      sequence: field(formData, "sequence"),
      scheduledOn: field(formData, "scheduledOn"),
      maxScore: field(formData, "maxScore"),
      coefficient: field(formData, "coefficient"),
      countsTowardAverage: boolField(formData, "countsTowardAverage"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // Lowering the denominator under a mark already entered would leave a pupil
    // scoring 18/15, so the change is refused rather than silently clamped.
    if (parsed.data.maxScore < existing.maxScore) {
      const above = await db.assessmentGrade.count({
        where: {
          assessmentId: existing.id,
          score: { gt: parsed.data.maxScore },
        },
      });
      if (above > 0) return failure(t.assessment.maxScoreBelowMarks);
    }

    await db.assessment.updateMany({
      // Scoped by id *and* school: a crafted id matches nothing rather than
      // updating somebody else's paper.
      where: { id: existing.id, schoolId },
      data: {
        title: parsed.data.title,
        sequence: parsed.data.sequence,
        scheduledOn: parsed.data.scheduledOn,
        maxScore: parsed.data.maxScore,
        coefficient: parsed.data.coefficient,
        countsTowardAverage: parsed.data.countsTowardAverage,
        notes: parsed.data.notes,
      },
    });

    refresh();
    return success(t.assessment.saved);
  });
}

/**
 * Pairs a paper with the MASSAR sheet it belongs to, or unpairs it.
 *
 * ── Why this is typed at all ────────────────────────────────────────────────
 * It usually is not. The import stamps the code itself from the file's hidden
 * `E5`, and a contrôle with a null code is exactly the ADOPTABLE state that
 * lets the first NotesCC export claim it — see `generateControle` and the
 * ASSESSMENT_IDENTITY check. This is for the case that flow cannot reach: a
 * paper the school set by hand which a school already holds the sheet for, and
 * which has to be told they are the same paper before the marks can go back.
 *
 * So the code entered here must be the one *off that sheet*. A code invented to
 * fill the box is worse than a blank one: a blank paper adopts the ministry's
 * id on first import, while a wrong one makes ASSESSMENT_IDENTITY an ERROR and
 * blocks the import outright.
 *
 * Blank clears it, which is what puts a mispaired paper back to adoptable.
 */
export async function saveMassarCodeAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_MANAGE);

    const id = field(formData, "id");
    const existing = await findScopedAssessment(schoolId, id);
    if (!existing) return failure(t.errors.notFound);

    const parsed = massarCodeSchema().safeParse({
      massarCode: field(formData, "massarCode"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const code = parsed.data.massarCode;

    /*
      One sheet, one paper.

      `@@unique([schoolId, massarCode])` says so, and catching it here rather
      than letting it throw is what turns "something went wrong" into the one
      sentence that helps: another contrôle already answers for this sheet, and
      importing against either of them would file marks twice.
    */
    if (code !== null) {
      const clash = await db.assessment.findFirst({
        where: { schoolId, massarCode: code, id: { not: existing.id } },
        select: { title: true },
      });
      if (clash) {
        return failure(
          interpolate(t.assessment.massarCodeTaken, { title: clash.title }),
          { massarCode: t.assessment.massarCodeTaken },
          formValues(formData),
        );
      }
    }

    await db.assessment.updateMany({
      // Scoped by id *and* school, like every other write here: a crafted id
      // matches nothing rather than repointing somebody else's paper.
      where: { id: existing.id, schoolId },
      data: { massarCode: code },
    });

    refresh();
    return success(code === null ? t.assessment.massarCodeCleared : t.assessment.saved);
  });
}

/**
 * Announces a paper, or takes it back.
 *
 * Its own permission: publishing is what opens mark entry and, later, what a
 * family sees, so a school that wants marks held until the class council can
 * grant marking without granting release.
 */
export async function setAssessmentStatusAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const id = field(formData, "id");
    const parsed = statusSchema(t).safeParse({
      status: field(formData, "status"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    /*
      Two different acts share this one entry point, and they are not the same
      permission.

      Handing a paper back (PUBLISHED → SUBMITTED, and taking it back again) is
      the teacher's move, so it needs only the code they already hold to type
      the marks — and it is confined to their own paper below, because "their
      own" is the whole meaning of the handshake. Everything else — announcing
      a paper, accepting the marks, cancelling — is the office's, and stays on
      ASSESSMENT_PUBLISH.

      Authorized before the row is read, and the ownership check is a `where`
      rather than an `if`: a teacher asking after somebody else's paper gets
      "not found", which is also all they are entitled to know.
    */
    const handingBack =
      parsed.data.status === "SUBMITTED" || parsed.data.status === "PUBLISHED";
    const asOffice = context.can(PERMISSIONS.ASSESSMENT_PUBLISH);

    if (!asOffice) {
      if (!handingBack) return failure(t.errors.forbidden);
      await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_GRADE);
    } else {
      await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_PUBLISH);
    }

    const existing = await findScopedAssessment(schoolId, id, {
      teacherId: asOffice ? undefined : context.user.id,
    });
    if (!existing) return failure(t.errors.notFound);

    // A teacher may only hand back a paper that is open, and take back one they
    // have handed in. They may not reach past the office's own moves — a
    // GRADED paper is finished, and reopening it is the office's decision.
    if (
      !asOffice &&
      existing.status !== "PUBLISHED" &&
      existing.status !== "SUBMITTED"
    ) {
      return failure(t.errors.forbidden);
    }

    const result = await setAssessmentStatus(existing.id, parsed.data.status);
    if (!result.ok) {
      return failure(
        result.reason === "incomplete"
          ? t.assessment.cannotValidateIncomplete
          : t.assessment.cannotUnpublish,
      );
    }

    refresh();
    return success(t.assessment.statusChanged);
  });
}

/**
 * Flips whether one paper's marks move the subject's average.
 *
 * Its own entry point rather than part of `saveAssessmentAction` because it is
 * the one thing about a paper the office changes *after* the fact, from a list,
 * without touching anything else on it. A teacher sets a devoir from the phone,
 * where there is no such box; the office decides afterwards that this one was
 * revision and should not weigh on the term. Making that a trip through the
 * full edit form — retyping the title, the date and the weight to change a
 * boolean — is how it would end up never being done.
 *
 * ASSESSMENT_MANAGE, the same code that decides what gets set at all. Moving a
 * paper in or out of the average is a weighting decision, not marking.
 */
export async function setAssessmentCountsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_MANAGE);

    const existing = await findScopedAssessment(schoolId, field(formData, "id"));
    if (!existing) return failure(t.errors.notFound);

    const counts = boolField(formData, "countsTowardAverage");

    await db.assessment.updateMany({
      // Scoped by id *and* school: a crafted id matches nothing rather than
      // reweighting somebody else's paper.
      where: { id: existing.id, schoolId },
      data: { countsTowardAverage: counts },
    });

    refresh();
    return success(
      counts ? t.assessment.nowCounts : t.assessment.nowDoesNotCount,
    );
  });
}

/**
 * Records a whole mark sheet.
 *
 * The rows travel as parallel arrays indexed by pupil, so every row must
 * contribute exactly one value to every field — the same shape the tender rows
 * on the encaissement screen use, and for the same reason: a blank comment must
 * not shift the next pupil's mark onto the wrong child.
 */
export async function saveMarksAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_GRADE);

    const id = field(formData, "assessmentId");
    // The same paper the reader could have opened, and no other — see
    // `readableBy`. Not-found rather than forbidden, so a colleague's devoir
    // cannot be probed for its existence either.
    const existing = await findScopedAssessment(schoolId, id, {
      readableBy: context.user.id,
    });
    if (!existing) return failure(t.errors.notFound);

    const enrollmentIds = listField(formData, "enrollmentId");
    const scores = listField(formData, "score");
    const absent = listField(formData, "absent");
    const excused = listField(formData, "excused");
    const comments = listField(formData, "comment");

    if (
      scores.length !== enrollmentIds.length ||
      absent.length !== enrollmentIds.length ||
      excused.length !== enrollmentIds.length ||
      comments.length !== enrollmentIds.length
    ) {
      return failure(t.errors.invalid);
    }

    const marks: MarkInput[] = enrollmentIds.map((enrollmentId, index) => {
      const raw = scores[index]?.trim() ?? "";
      const parsedScore = raw === "" ? null : Number(raw);
      return {
        enrollmentId,
        score:
          parsedScore !== null && Number.isFinite(parsedScore)
            ? parsedScore
            : null,
        isAbsent: absent[index] === "1",
        isExcused: excused[index] === "1",
        comment: comments[index]?.trim() || null,
      };
    });

    const result = await saveMarks(existing.id, marks, context.user.id);

    if (!result.ok) {
      if (result.reason === "locked") return failure(t.assessment.notPublished);
      if (result.reason === "out-of-range") {
        return failure(
          interpolate(t.assessment.scoreOutOfRange, {
            max: existing.maxScore,
          }),
        );
      }
      return failure(t.errors.notFound);
    }

    refresh();
    return success(
      interpolate(t.assessment.marksSaved, { count: result.saved }),
    );
  });
}

export async function deleteAssessmentAction(
  assessmentId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_DELETE);

    const existing = await findScopedAssessment(schoolId, assessmentId);
    if (!existing) return failure(t.errors.notFound);

    // Marks are the point of the paper: deleting one that has been marked would
    // destroy work somebody did. Cancelling keeps the row and the history.
    const marked = await db.assessmentGrade.count({
      where: {
        assessmentId: existing.id,
        OR: [{ score: { not: null } }, { isAbsent: true }],
      },
    });
    if (marked > 0) return failure(t.assessment.cannotDeleteMarked);

    await db.assessment.deleteMany({ where: { id: existing.id, schoolId } });

    refresh();
    return success(t.assessment.deleted);
  });
}

/**
 * The paper as it comes off the form: one `questionText` and one
 * `questionPoints` per row, in the order the rows are rendered.
 *
 * Read as two parallel lists rather than as JSON because that is what a plain
 * `<form>` posts — the editor stays a set of inputs, which keeps it working
 * before hydration and keeps every value visible to `formValues` when the
 * action comes back with an error.
 *
 * Rows the teacher left completely blank are dropped here rather than refused:
 * an empty last line is how somebody stops typing, not a mistake to report.
 */
function readQuestions(
  formData: FormData,
): { text: string; points: string }[] {
  const texts = formData.getAll("questionText");
  const points = formData.getAll("questionPoints");

  return texts
    .map((text, index) => ({
      text: String(text),
      points: String(points[index] ?? ""),
    }))
    .filter((row) => row.text.trim() !== "" || row.points.trim() !== "");
}

/**
 * A devoir, set by the teacher for their own class.
 *
 * The counterpart to the generator: that one is a head of studies planning a
 * round across every subject, this one is a teacher setting a single piece of
 * work for a class they actually teach. Both write the same `Assessment` table —
 * the difference is who may, which is `AssessmentType.allowTeacherCreate`, and
 * that the teaching assignment is re-derived from the session here rather than
 * taken from the form.
 *
 * Written DRAFT, so nothing reaches the families until the office opens it —
 * see `createDevoir` for why that is one gate rather than two.
 */
export async function createDevoirAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);
    if (!context.currentSchoolYear) {
      return failure(t.errors.noSchoolYearContext);
    }

    /*
      Either half of the pair, not only the teacher's.

      ASSESSMENT_GRADE is a teacher setting work for their own class;
      ASSESSMENT_MANAGE is the office setting it for one of the school's. A
      directeur pédagogique holds the second and deliberately not the first —
      marking is not their job — so gating on GRADE alone locked the very people
      the devoirs review is written for out of the button on it.

      The two are not the same permission with a wider reach: which classes may
      be reached is `actsForSchool` below, re-derived against the teaching
      assignments inside `createDevoir`. This decides only who may ask.
    */
    const canGrade = context.canInSchool(schoolId, PERMISSIONS.ASSESSMENT_GRADE);
    const actsForSchool = context.canInSchool(
      schoolId,
      PERMISSIONS.ASSESSMENT_MANAGE,
    );
    if (!canGrade && !actsForSchool) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    const parsed = devoirSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      subjectId: field(formData, "subjectId"),
      termId: field(formData, "termId"),
      assessmentTypeId: field(formData, "assessmentTypeId"),
      title: field(formData, "title"),
      notes: field(formData, "notes"),
      scheduledOn: field(formData, "scheduledOn"),
      maxScore: field(formData, "maxScore"),
      coefficient: field(formData, "coefficient"),
      countsTowardAverage: boolField(formData, "countsTowardAverage"),
      questions: readQuestions(formData),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await createDevoir({
      authorId: context.user.id,
      schoolId,
      schoolYearId: context.currentSchoolYear.id,
      // A head of studies may set work for any class of the school; a teacher
      // only for their own. Anything a teacher can do, the office can do too —
      // and covering for an absent colleague is exactly when it is needed.
      // ASSESSMENT_MANAGE is the office half of the pair whose teacher half
      // (ASSESSMENT_GRADE) gates this action.
      actsForSchool,
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId,
      termId: parsed.data.termId,
      assessmentTypeId: parsed.data.assessmentTypeId,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      scheduledOn: parsed.data.scheduledOn,
      maxScore: parsed.data.maxScore,
      coefficient: parsed.data.coefficient,
      countsTowardAverage: parsed.data.countsTowardAverage,
      questions: parsed.data.questions,
    });

    if (!result.ok) {
      if (result.reason === "not-teaching") {
        return failure(t.classroom.notYourClass);
      }
      if (result.reason === "term-closed") {
        return failure(t.assessment.termClosed);
      }
      if (result.reason === "kind-not-allowed") {
        return failure(t.classroom.kindNotAllowed);
      }
      return failure(t.errors.notFound);
    }

    refresh();
    return success(t.classroom.devoirCreated);
  });
}

/**
 * Rewrites the school's appréciation scale.
 *
 * The rungs travel as parallel arrays, the same shape a mark sheet posts in and
 * for the same reason — see `saveMarksAction`. The whole scale goes at once
 * because a rung only means anything against its neighbours; see
 * `saveAppreciationScale`.
 *
 * Authorized on ASSESSMENT_SCALE **in the school in context**, which is what
 * lets a school give its teachers the wording without giving them the fee grid:
 * the configuration permission is one pair covering every configuration screen,
 * and this is deliberately not it.
 */
export async function saveAppreciationScaleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_SCALE);

    const percents = listField(formData, "minPercent");
    const labels = listField(formData, "label");
    const labelsAr = listField(formData, "labelAr");
    const colors = listField(formData, "colorHex");
    const active = listField(formData, "active");

    if (
      labels.length !== percents.length ||
      labelsAr.length !== percents.length ||
      colors.length !== percents.length ||
      active.length !== percents.length
    ) {
      return failure(t.errors.invalid);
    }

    const schema = appreciationBandSchema(t);
    const bands: BandInput[] = [];

    for (const [index, percent] of percents.entries()) {
      const parsed = schema.safeParse({
        minPercent: percent,
        label: labels[index],
        labelAr: labelsAr[index],
        colorHex: colors[index],
        isActive: active[index] === "1",
      });
      if (!parsed.success) {
        return failure(t.errors.invalid, fieldErrors(parsed.error), formValues(formData));
      }

      bands.push({
        // Percent in, basis points stored — see the note on the column.
        minPercentBps: Math.round(parsed.data.minPercent * 100),
        label: parsed.data.label,
        labelAr: parsed.data.labelAr,
        colorHex: parsed.data.colorHex,
        isActive: parsed.data.isActive,
      });
    }

    const result = await saveAppreciationScale(schoolId, bands);
    if (!result.ok) {
      if (result.reason === "duplicate-floor") {
        return failure(t.assessment.scaleDuplicateFloor);
      }
      if (result.reason === "too-many") {
        return failure(
          interpolate(t.assessment.scaleTooMany, { max: MAX_APPRECIATION_BANDS }),
        );
      }
      return failure(t.errors.invalid);
    }

    refresh();
    return success(t.assessment.scaleSaved);
  });
}
