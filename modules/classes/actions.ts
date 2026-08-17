"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { teacherOfSchool } from "@/lib/scope";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { assignmentScopeKey } from "@/modules/classes/enums";
import { fieldErrors } from "@/lib/validation";
import {
  ensurePrimaryTeacher,
  saveTeachingAssignment,
} from "@/modules/classes/service";
import { teachingAssignmentSchema } from "@/modules/classes/validation";

/**
 * Actions for the classes module: who teaches what, in a class that already
 * exists.
 *
 * Creating classes is configuration and lives elsewhere. Seating a pupil is an
 * enrolment write and lives in `modules/enrolment/actions.ts` — the roster
 * screen calls it from there, so there is one implementation of "this pupil
 * sits in that class" rather than two that can disagree.
 */

const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

/**
 * Gives one subject of a class its teacher, or takes it back.
 *
 * ── Why this exists beside the dialog ───────────────────────────────────────
 * The dialog edits an assignment as a whole — the group it covers, its weekly
 * minutes, whether it is the primary one. That is the right shape for a
 * co-taught subject or one split in halves, and the wrong shape for the job
 * this screen is actually for: filling in twelve blanks in a class's programme
 * without opening twelve dialogs.
 *
 * So this is deliberately the narrow move. One subject, one whole-class primary
 * holder, set or cleared. Everything else about the assignment keeps whatever
 * the dialog last put on it, because this never touches those columns.
 *
 * Clearing deletes the row rather than nulling the teacher: `teacherId` is not
 * nullable on TeachingAssignment, and an assignment answerable to nobody is the
 * hole this grid exists to show — it must read as a blank, not as a record.
 */
export async function setClassSubjectTeacherAction(
  schoolClassId: string,
  subjectId: string,
  teacherId: string | null,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    // The class decides the school; every other id is checked against it.
    const schoolClass = await db.schoolClass.findUnique({
      where: { id: schoolClassId },
      select: { id: true, schoolId: true },
    });
    if (!schoolClass) return failure(t.errors.notFound);

    await authorizeSchool(
      schoolClass.schoolId,
      PERMISSIONS.CLASS_ASSIGN_TEACHER,
    );

    const subject = await db.subject.findFirst({
      where: { id: subjectId, schoolId: schoolClass.schoolId },
      select: { id: true },
    });
    if (!subject) return failure(t.errors.notFound);

    const scopeKey = assignmentScopeKey(null);

    if (teacherId === null) {
      await db.teachingAssignment.deleteMany({
        where: {
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          classGroupId: null,
          isPrimary: true,
        },
      });
      refresh();
      return success(t.schoolClass.teacherCleared);
    }

    /*
      Never trust a teacher id from the request: it has to be an active account
      belonging to *this class's* own school, which was re-derived from the
      session a line above rather than taken from the form.

      A teacher of that school, and not merely somebody on its payroll — see
      `teacherOfSchool`. Two tests have been wrong here in turn: the membership
      one refused every teacher hired without a role, and the payroll one that
      replaced it offered the manager and the driver. Both are what the picker
      now shows, so the save and the select agree.
    */
    const teacher = await db.user.findFirst({
      where: { id: teacherId, ...teacherOfSchool(schoolClass.schoolId) },
      select: { id: true },
    });
    if (!teacher) return failure(t.errors.notFound);

    /*
      One primary holder per subject, so changing who teaches it replaces
      rather than adds.

      The table's unique is (class, subject, teacher, scope) — it stops the
      *same* teacher being written twice, not a second teacher being added
      beside the first. Two primaries for one subject is what would make
      `generateAssessments` pick whichever the database returned first, so the
      old holder goes before the new one lands.
    */
    const existing = await db.teachingAssignment.findFirst({
      where: {
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        classGroupId: null,
        isPrimary: true,
      },
      select: { id: true, teacherId: true },
    });

    if (existing?.teacherId === teacher.id) return success(t.schoolClass.assignmentSaved);

    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.teachingAssignment.delete({ where: { id: existing.id } });
      }
      await tx.teachingAssignment.create({
        data: {
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          classGroupId: null,
          isPrimary: true,
          scopeKey,
        },
      });
    });

    refresh();
    return success(t.schoolClass.assignmentSaved);
  });
}

export async function saveTeachingAssignmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const parsed = teachingAssignmentSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      subjectId: field(formData, "subjectId"),
      teacherId: field(formData, "teacherId"),
      classGroupId: optionalId(formData, "classGroupId"),
      weeklyMinutes: field(formData, "weeklyMinutes"),
      isPrimary: boolField(formData, "isPrimary"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const assignmentId = field(formData, "id");

    // The class decides the school; every other id is checked against it.
    const schoolClass = await db.schoolClass.findUnique({
      where: { id: parsed.data.schoolClassId },
      select: { id: true, schoolId: true },
    });
    if (!schoolClass) return failure(t.errors.notFound);

    await authorizeSchool(
      schoolClass.schoolId,
      PERMISSIONS.CLASS_ASSIGN_TEACHER,
    );

    const [subject, teacher, group] = await Promise.all([
      db.subject.findFirst({
        where: { id: parsed.data.subjectId, schoolId: schoolClass.schoolId },
        select: { id: true },
      }),
      // Same test as the picker offers from — see `teacherOfSchool`.
      db.user.findFirst({
        where: {
          id: parsed.data.teacherId,
          ...teacherOfSchool(schoolClass.schoolId),
        },
        select: { id: true },
      }),
      parsed.data.classGroupId
        ? db.classGroup.findFirst({
            where: {
              id: parsed.data.classGroupId,
              schoolClassId: schoolClass.id,
            },
            select: { id: true },
          })
        : null,
    ]);

    if (!subject) return failure(t.errors.notFound);
    if (!teacher) return failure(t.schoolClass.teacherUnavailable);

    if (assignmentId) {
      const owned = await db.teachingAssignment.findFirst({
        where: { id: assignmentId, schoolClassId: schoolClass.id },
        select: { id: true },
      });
      if (!owned) return failure(t.errors.notFound);
    } else {
      // The unique index would catch this, but a duplicate-key stack trace is
      // not a message a secretary can act on.
      const duplicate = await db.teachingAssignment.findFirst({
        where: {
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          classGroupId: group?.id ?? null,
        },
        select: { id: true },
      });
      if (duplicate) return failure(t.schoolClass.assignmentExists);
    }

    await saveTeachingAssignment({
      assignmentId: assignmentId || undefined,
      schoolClassId: schoolClass.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      classGroupId: group?.id ?? null,
      weeklyMinutes: parsed.data.weeklyMinutes,
      isPrimary: parsed.data.isPrimary,
    });

    await ensurePrimaryTeacher(schoolClass.id, subject.id, group?.id ?? null);

    refresh();
    return success(t.schoolClass.assignmentSaved);
  });
}

export async function deleteTeachingAssignmentAction(
  assignmentId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const assignment = await db.teachingAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        schoolClassId: true,
        subjectId: true,
        classGroupId: true,
        schoolClass: { select: { schoolId: true } },
      },
    });
    if (!assignment) return failure(t.errors.notFound);

    await authorizeSchool(
      assignment.schoolClass.schoolId,
      PERMISSIONS.CLASS_ASSIGN_TEACHER,
    );

    await db.teachingAssignment.delete({ where: { id: assignmentId } });
    // Somebody must stay answerable for the subject's marks.
    await ensurePrimaryTeacher(
      assignment.schoolClassId,
      assignment.subjectId,
      assignment.classGroupId,
    );

    refresh();
    return success(t.schoolClass.assignmentDeleted);
  });
}
