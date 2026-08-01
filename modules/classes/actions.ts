"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
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
      db.user.findFirst({
        where: {
          id: parsed.data.teacherId,
          isActive: true,
          memberships: { some: { schoolId: schoolClass.schoolId } },
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
