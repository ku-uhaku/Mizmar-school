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
import { fieldErrors } from "@/lib/validation";
import { ATTENDANCE_STATUSES } from "@/modules/classroom/enums";
import {
  justifyAbsence,
  saveRegister,
  writeRemark,
  type AttendanceMark,
} from "@/modules/classroom/service";
import { remarkSchema } from "@/modules/classroom/validation";

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
 * Records one lesson's register.
 *
 * The rows travel as parallel arrays indexed by pupil, so every row must
 * contribute exactly one value to every field — the same shape as the mark
 * sheet, and for the same reason: a blank reason must not shift the next
 * pupil's status onto the wrong child.
 */
export async function saveRegisterAction(
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
    const timeSlotId = rawSlot === "" || rawSlot === NO_SELECTION ? null : rawSlot;

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
          parsed !== null && Number.isFinite(parsed) ? Math.trunc(parsed) : null,
        reason: reasons[index]?.trim() || null,
      };
    });

    const result = await saveRegister({
      // From the session, never the form.
      teacherId: context.user.id,
      schoolClassId,
      subjectId,
      timeSlotId,
      date,
      marks,
    });

    if (!result.ok) {
      return failure(
        result.reason === "not-teaching"
          ? t.classroom.notYourClass
          : t.classroom.minutesOutOfRange,
      );
    }

    refresh();
    return success(
      interpolate(t.classroom.registerSaved, { count: result.saved }),
    );
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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    // Releasing a remark to the family is a separate grant — a teacher without
    // it writes an internal note, whatever the form said.
    const wantsFamily = boolField(formData, "isVisibleToFamily");
    const isVisibleToFamily =
      wantsFamily && context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH);

    const result = await writeRemark({
      authorId: context.user.id,
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

/** Deletes a remark. Only ever your own — a colleague's note is not yours. */
export async function deleteRemarkAction(
  remarkId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await teacherContext();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CLASSROOM_REMARK_WRITE);

    const deleted = await db.studentRemark.deleteMany({
      // Scoped by author as well as id: a crafted id matches nothing rather
      // than removing somebody else's observation.
      where: { id: remarkId, authorId: context.user.id },
    });
    if (deleted.count === 0) return failure(t.classroom.notYourRemark);

    refresh();
    return success(t.classroom.remarkDeleted);
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

    // Re-derived against the school in context before anything is written.
    const existing = await db.studentAttendance.findFirst({
      where: { id, enrollment: { student: { schoolId } } },
      select: { id: true },
    });
    if (!existing) return failure(t.errors.notFound);

    await justifyAbsence(
      existing.id,
      boolField(formData, "isJustified"),
      field(formData, "reason") || null,
    );

    refresh();
    return success(t.classroom.justificationSaved);
  });
}
