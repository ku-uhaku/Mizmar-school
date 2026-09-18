"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  boolField,
  field,
  listField,
  withActionErrors,
} from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  ATTENDANCE_STATUSES,
  JUSTIFIABLE_STATUSES,
} from "@/modules/classroom/enums";
import {
  justifyAbsence,
  reopenSession,
  saveSession,
  setRemarkVisibility,
  writeRemark,
  type AttendanceMark,
} from "@/modules/classroom/service";
import {
  remarkSchema,
  sessionSchema,
} from "@/modules/classroom/validation";

/**
 * Actions for the espace enseignant.
 *
 * The school comes from the working context and the *teacher* comes from the
 * session — never from the form. Every write is re-derived against the signed-in
 * user's own teaching assignments in the service layer, so holding the
 * permission is not enough to write against a class somebody else teaches.
 */

const NO_SELECTION = "__none__";

async function teacherContext() {
  const t = await getDictionary();
  const context = await requireAuth();
  return { t, context, schoolId: context.currentSchool?.id };
}

/**
 * Records a séance: the cahier de textes and the appel, saved together.
 *
 * The rows travel as parallel arrays indexed by pupil, so every row must
 * contribute exactly one value to every field — the same shape as the mark
 * sheet, and for the same reason: a blank reason must not shift the next
 * pupil's status onto the wrong child.
 *
 * Saving from the web closes the séance: the sheet holds the whole roster and
 * pressing the button is the deliberate act of finishing the appel. The phone
 * does not — see `saveSession`.
 */
export async function saveSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_ATTENDANCE_MARK);

    const schoolClassId = field(formData, "schoolClassId");
    const subjectId = field(formData, "subjectId") || null;
    const rawSlot = field(formData, "timeSlotId");
    const timeSlotId =
      rawSlot === "" || rawSlot === NO_SELECTION ? null : rawSlot;

    const date = new Date(field(formData, "date"));
    if (Number.isNaN(date.getTime())) {
      return failure(t.errors.invalid, { date: t.validation.invalidDate });
    }

    const enrollmentIds = listField(formData, "enrollmentId");
    const statuses = listField(formData, "status");
    const minutes = listField(formData, "minutesLate");
    const reasons = listField(formData, "reason");

    if (
      statuses.length !== enrollmentIds.length ||
      minutes.length !== enrollmentIds.length ||
      reasons.length !== enrollmentIds.length
    ) {
      return failure(t.errors.invalid);
    }

    const marks: AttendanceMark[] = enrollmentIds.map((enrollmentId, index) => {
      const status = statuses[index] ?? "PRESENT";
      const raw = minutes[index]?.trim() ?? "";
      const parsed = raw === "" ? null : Number(raw);

      return {
        enrollmentId,
        // Anything the client invents falls back to PRESENT rather than being
        // written through — the column is an enum by convention only.
        status: (ATTENDANCE_STATUSES as readonly string[]).includes(status)
          ? status
          : "PRESENT",
        minutesLate:
          parsed !== null && Number.isFinite(parsed)
            ? Math.trunc(parsed)
            : null,
        reason: reasons[index]?.trim() || null,
      };
    });

    const parsed = sessionSchema().safeParse({
      theme: field(formData, "theme"),
      homework: field(formData, "homework"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await saveSession({
      // From the session, never the form.
      teacherId: context.user.id,
      schoolId,
      // Anything a teacher may do, the office may do too — see the note at the
      // top of modules/classroom/service.ts. The justification code is the
      // office half of the attendance pair, so it is what unlocks taking the
      // register for a class the actor does not teach.
      actsForSchool: context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY),
      schoolClassId,
      subjectId,
      timeSlotId,
      date,
      marks,
      theme: parsed.data.theme,
      homework: parsed.data.homework,
      isCancelled: boolField(formData, "isCancelled"),
      // The web sheet is the whole roster in one act.
      close: true,
    });

    if (!result.ok) {
      return failure(
        result.reason === "not-teaching"
          ? t.classroom.notYourClass
          : result.reason === "closed"
            ? t.classroom.sessionAlreadyClosed
            : t.classroom.minutesOutOfRange,
      );
    }

    refresh();
    return success(
      interpolate(t.classroom.sessionSaved, { count: result.saved }),
    );
  });
}

/**
 * Reopens a closed séance so its register can be corrected.
 *
 * Behind `classroom.attendanceJustify`, the same office decision that already
 * lets somebody stand in for a class's teacher — see the note at the top of
 * `service.ts`. This changes no mark itself; it only lets the next save touch
 * a register a previous one made final.
 */
export async function reopenSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY);

    const result = await reopenSession({
      schoolId,
      sessionId: field(formData, "sessionId"),
    });
    if (!result.ok) return failure(t.errors.notFound);

    refresh();
    return success(t.classroom.sessionReopened);
  });
}

/** Writes an observation about a pupil the teacher teaches. */
export async function saveRemarkAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_REMARK_WRITE);

    const rawSubject = field(formData, "subjectId");
    const parsed = remarkSchema(t).safeParse({
      enrollmentId: field(formData, "enrollmentId"),
      subjectId: rawSubject === NO_SELECTION ? "" : rawSubject,
      kind: field(formData, "kind"),
      tone: field(formData, "tone"),
      body: field(formData, "body"),
      occurredOn: field(formData, "occurredOn"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // Releasing a remark to the family is a separate grant — a teacher without
    // it writes an internal note, whatever the form said.
    const wantsFamily = boolField(formData, "isVisibleToFamily");
    const isVisibleToFamily =
      wantsFamily && context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH);

    const result = await writeRemark({
      authorId: context.user.id,
      schoolId,
      // The publish code is the office half of the remark pair — the same rule
      // as the register above.
      actsForSchool: context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH),
      enrollmentId: parsed.data.enrollmentId,
      subjectId: parsed.data.subjectId || null,
      kind: parsed.data.kind,
      tone: parsed.data.tone,
      body: parsed.data.body,
      occurredOn: parsed.data.occurredOn,
      isVisibleToFamily,
    });

    if (!result.ok) return failure(t.classroom.notYourPupil);

    refresh();
    return success(t.classroom.remarkSaved);
  });
}

/**
 * Deletes a remark: your own, or any of the school's if you are the office.
 *
 * A teacher's note is not a colleague's to remove — but somebody has to be able
 * to take down a remark written in anger or about the wrong child, and that is
 * the office. `classroom.remarkPublish` is the code that decides what a family
 * sees, so it is the right one to also decide what is retracted.
 */
export async function deleteRemarkAction(
  remarkId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_REMARK_WRITE);

    const actsForSchool = context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH);

    const deleted = await db.studentRemark.deleteMany({
      // Scoped by author, or by school for the office: either way a crafted id
      // matches nothing rather than removing another school's observation.
      where: {
        id: remarkId,
        ...(actsForSchool
          ? { enrollment: { student: { schoolId } } }
          : { authorId: context.user.id }),
      },
    });
    if (deleted.count === 0) return failure(t.classroom.notYourRemark);

    refresh();
    return success(t.classroom.remarkDeleted);
  });
}

/**
 * Releases a remark to the family, or takes it back.
 *
 * The office's half of the carnet: a teacher writes the observation and
 * somebody answerable for the school decides whether the family is shown it.
 * Behind CLASSROOM_REMARK_PUBLISH for that reason — holding the writing code is
 * not enough, which is what makes "everything the teacher writes is approved
 * before a parent sees it" a rule the app enforces rather than a habit.
 */
export async function publishRemarkAction(
  remarkId: string,
  isVisibleToFamily: boolean,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_REMARK_PUBLISH);

    const result = await setRemarkVisibility(
      remarkId,
      schoolId,
      isVisibleToFamily,
    );
    if (!result.ok) return failure(t.errors.notFound);

    refresh();
    return success(
      isVisibleToFamily
        ? t.classroom.remarkPublished
        : t.classroom.remarkUnpublished,
    );
  });
}

/**
 * Accepts or withdraws a justification for an absence.
 *
 * Behind its own permission because it is an office decision: a teacher records
 * that a child was not there, and somebody else decides whether the note the
 * family sent excuses it.
 */
export async function justifyAbsenceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY);

    const id = field(formData, "attendanceId");

    // Re-derived against the school in context before anything is written, and
    // narrowed to the rows a justification can apply to at all — a `where`
    // rather than an `if`, so a mark for a pupil who was in the room reads as
    // absent rather than as refused.
    const existing = await db.studentAttendance.findFirst({
      where: {
        id,
        enrollment: { student: { schoolId } },
        status: { in: [...JUSTIFIABLE_STATUSES] },
      },
      select: { id: true, status: true },
    });
    if (!existing) return failure(t.errors.notFound);

    await justifyAbsence(
      existing.id,
      existing.status,
      boolField(formData, "isJustified"),
      field(formData, "reason") || null,
    );

    refresh();
    return success(t.classroom.justificationSaved);
  });
}
