import "server-only";

import { db } from "@/lib/db";
import { assignmentScopeKey } from "@/modules/classes/enums";

/**
 * Writes and invariants for the classes module.
 *
 * There is one rule here that the database cannot state: exactly one *primary*
 * teacher per (class, group, subject). A partial unique index would say it, and
 * neither SQLite through Prisma nor a plain unique constraint can — so it is
 * enforced on write, the same way the default school year is.
 */

/**
 * Demotes whichever teacher currently holds the primary flag for this subject
 * in this class (or group), so promoting a new one cannot leave two.
 */
export async function clearOtherPrimaryTeachers(
  schoolClassId: string,
  subjectId: string,
  classGroupId: string | null,
  keepId?: string,
): Promise<void> {
  await db.teachingAssignment.updateMany({
    where: {
      schoolClassId,
      subjectId,
      classGroupId,
      isPrimary: true,
      ...(keepId ? { NOT: { id: keepId } } : {}),
    },
    data: { isPrimary: false },
  });
}

/**
 * Creates or updates one affectation.
 *
 * `scopeKey` is recomputed here and nowhere else — it mirrors the nullable
 * `classGroupId` so the unique index actually fires, and without it the same
 * teacher could be assigned twice to the same subject for the whole class,
 * double-counting their load. See lib/db-keys.ts.
 */
export async function saveTeachingAssignment(input: {
  assignmentId?: string;
  schoolClassId: string;
  subjectId: string;
  teacherId: string;
  classGroupId: string | null;
  weeklyMinutes: number | null;
  isPrimary: boolean;
}): Promise<void> {
  if (input.isPrimary) {
    await clearOtherPrimaryTeachers(
      input.schoolClassId,
      input.subjectId,
      input.classGroupId,
      input.assignmentId,
    );
  }

  const data = {
    schoolClassId: input.schoolClassId,
    subjectId: input.subjectId,
    teacherId: input.teacherId,
    classGroupId: input.classGroupId,
    weeklyMinutes: input.weeklyMinutes,
    isPrimary: input.isPrimary,
    scopeKey: assignmentScopeKey(input.classGroupId),
  };

  if (input.assignmentId) {
    await db.teachingAssignment.update({
      where: { id: input.assignmentId },
      data,
    });
    return;
  }

  await db.teachingAssignment.create({ data });
}

/**
 * Makes sure a subject taught in a class still has somebody answerable for its
 * marks after a change. Does nothing when one is already primary, or when
 * nobody is left teaching it.
 */
export async function ensurePrimaryTeacher(
  schoolClassId: string,
  subjectId: string,
  classGroupId: string | null,
): Promise<void> {
  const primary = await db.teachingAssignment.findFirst({
    where: { schoolClassId, subjectId, classGroupId, isPrimary: true },
    select: { id: true },
  });
  if (primary) return;

  const candidate = await db.teachingAssignment.findFirst({
    where: { schoolClassId, subjectId, classGroupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return;

  await db.teachingAssignment.update({
    where: { id: candidate.id },
    data: { isPrimary: true },
  });
}
