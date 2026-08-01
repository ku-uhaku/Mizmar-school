"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, listField, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  generateAssessments,
  saveMarks,
  setAssessmentStatus,
  type MarkInput,
} from "@/modules/assessments/service";
import {
  assessmentSchema,
  generateSchema,
  statusSchema,
} from "@/modules/assessments/validation";
import { assessmentScopeKey } from "@/modules/assessments/enums";
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
async function findScopedAssessment(schoolId: string, assessmentId: string) {
  const context = await requireAuth();
  return db.assessment.findFirst({
    where: {
      id: assessmentId,
      schoolId,
      term: { schoolYearId: context.currentSchoolYear?.id ?? "__none__" },
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
      schoolClassId: field(formData, "schoolClassId"),
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

    // The class and the term are both re-derived against the working context,
    // so neither id can point outside the school and year the user has selected.
    const [schoolClass, term] = await Promise.all([
      db.schoolClass.findFirst({
        where: {
          id: parsed.data.schoolClassId,
          schoolId,
          levelOffering: { schoolYearId: context.currentSchoolYear.id },
        },
        select: { id: true },
      }),
      db.term.findFirst({
        where: {
          id: parsed.data.termId,
          schoolYearId: context.currentSchoolYear.id,
        },
        select: { id: true, status: true },
      }),
    ]);

    if (!schoolClass || !term) return failure(t.errors.notFound);
    if (term.status === "CLOSED") return failure(t.assessment.termClosed);

    /*
      The ticked subjects travel as `subjectId:YYYY-MM-DD` pairs, one per
      subject, so each paper carries its own date — a round of contrôles is sat
      across a week, not all on one morning. An empty date half means "not dated
      yet", which is an ordinary state for a paper planned in September.
    */
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
        };
      })
      .filter(
        (target): target is NonNullable<typeof target> => target !== null,
      );

    if (targets.length === 0) return failure(t.assessment.noSubjectsChosen);

    const result = await generateAssessments({
      schoolClassId: schoolClass.id,
      termId: term.id,
      assessmentTypeId: parsed.data.assessmentTypeId,
      sequence: parsed.data.sequence,
      targets,
      createdById: context.user.id,
    });

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

    const message = interpolate(t.assessment.generated, {
      count: result.created,
      skipped: result.skipped,
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
        notes: parsed.data.notes,
      },
    });

    refresh();
    return success(t.assessment.saved);
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
    const { t, schoolId } = await schoolContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_PUBLISH);

    const id = field(formData, "id");
    const existing = await findScopedAssessment(schoolId, id);
    if (!existing) return failure(t.errors.notFound);

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

    const result = await setAssessmentStatus(existing.id, parsed.data.status);
    if (!result.ok) return failure(t.assessment.cannotUnpublish);

    refresh();
    return success(t.assessment.statusChanged);
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
    const existing = await findScopedAssessment(schoolId, id);
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
 * A devoir, set by the teacher for their own class.
 *
 * The counterpart to the generator: that one is a head of studies planning a
 * round across every subject, this one is a teacher setting a single piece of
 * work for a class they actually teach. Both write the same `Assessment` table —
 * the difference is who may, which is `AssessmentType.allowTeacherCreate`, and
 * that the teaching assignment is re-derived from the session here rather than
 * taken from the form.
 *
 * Created PUBLISHED, not DRAFT: a teacher setting a devoir has already told the
 * class about it, and making them press a second button to open their own mark
 * sheet would be ceremony with no decision behind it.
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

    await authorizeSchool(schoolId, PERMISSIONS.ASSESSMENT_GRADE);

    const actsForSchool = context.can(PERMISSIONS.ASSESSMENT_MANAGE);

    const parsed = devoirSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      subjectId: field(formData, "subjectId"),
      termId: field(formData, "termId"),
      assessmentTypeId: field(formData, "assessmentTypeId"),
      title: field(formData, "title"),
      scheduledOn: field(formData, "scheduledOn"),
      maxScore: field(formData, "maxScore"),
      coefficient: field(formData, "coefficient"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The teacher's own assignment is the authority for both the class and the
    // subject — holding the permission is not enough to set work for a class
    // somebody else teaches.
    const assignment = await db.teachingAssignment.findFirst({
      where: {
        // A head of studies may set work for any class of the school; a teacher
        // only for their own. Anything a teacher can do, the office can do too —
        // and covering for an absent colleague is exactly when it is needed.
        // ASSESSMENT_MANAGE is the office half of the pair whose teacher half
        // (ASSESSMENT_GRADE) gates this action.
        ...(actsForSchool ? {} : { teacherId: context.user.id }),
        schoolClassId: parsed.data.schoolClassId,
        subjectId: parsed.data.subjectId,
        schoolClass: {
          schoolId,
          levelOffering: { schoolYearId: context.currentSchoolYear.id },
        },
      },
      select: {
        classGroupId: true,
        teacherId: true,
        schoolClass: { select: { id: true } },
      },
    });
    if (!assignment) return failure(t.classroom.notYourClass);

    const [term, type] = await Promise.all([
      db.term.findFirst({
        where: {
          id: parsed.data.termId,
          schoolYearId: context.currentSchoolYear.id,
        },
        select: { id: true, status: true },
      }),
      db.assessmentType.findFirst({
        // Only a kind the school lets teachers set. Checked here and not only
        // in the picker, because the picker is client-side.
        where: {
          id: parsed.data.assessmentTypeId,
          schoolId,
          allowTeacherCreate: true,
          isActive: true,
        },
        select: { id: true, name: true },
      }),
    ]);

    if (!term) return failure(t.errors.notFound);
    if (term.status === "CLOSED") return failure(t.assessment.termClosed);
    if (!type) return failure(t.classroom.kindNotAllowed);

    // The next free sequence for this kind, so two devoirs in one term do not
    // collide on the unique index.
    const last = await db.assessment.findFirst({
      where: {
        schoolClassId: assignment.schoolClass.id,
        subjectId: parsed.data.subjectId,
        termId: term.id,
        assessmentTypeId: type.id,
      },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });

    await db.assessment.create({
      data: {
        schoolId,
        schoolClassId: assignment.schoolClass.id,
        classGroupId: assignment.classGroupId,
        subjectId: parsed.data.subjectId,
        termId: term.id,
        assessmentTypeId: type.id,
        sequence: (last?.sequence ?? 0) + 1,
        title: parsed.data.title,
        scheduledOn: parsed.data.scheduledOn,
        maxScore: parsed.data.maxScore,
        coefficient: parsed.data.coefficient,
        status: "PUBLISHED",
        // Answerable to whoever holds the class, not to whoever typed it in:
        // an office user setting work for a colleague must not end up owning
        // the mark sheet. Falls back to the author when the post is vacant.
        teacherId: assignment.teacherId ?? context.user.id,
        createdById: context.user.id,
        scopeKey: assessmentScopeKey(assignment.classGroupId),
      },
    });

    refresh();
    return success(t.classroom.devoirCreated);
  });
}
