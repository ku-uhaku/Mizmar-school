import "server-only";

import { db } from "@/lib/db";
import { assignmentScopeKey } from "@/modules/classes/enums";

/**
 * Writes and invariants for the classes module.
 *
 * There is one rule here that the database cannot state: exactly one *primary*
 * teacher per (class, group, subject). A partial unique index would say it, and
 * neither MySQL through Prisma nor a plain unique constraint can — so it is
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

// ── Carrying the structure into a new year ───────────────────────────────────

/**
 * Copies the shape of the school onto another year: which levels are offered,
 * the classes in them, and the groups those classes split into.
 *
 * ── What is deliberately not copied ─────────────────────────────────────────
 * No pupil. Enrolments are the year's own business and a new year starts empty
 * — that split is the whole reason Student and Enrollment are separate tables.
 * The professeur principal is not carried either: staff turnover over a summer
 * is exactly where a copied grid goes stale, and a wrong name on a class is
 * worse than a blank one. The home room *is* carried, because a room is a
 * building and buildings do not resign.
 *
 * Idempotent at every level — offerings upsert on
 * `(schoolYearId, levelId, scopeKey)`, classes on `(levelOfferingId, code)`,
 * groups on `(schoolClassId, code)` — and an existing row is never overwritten,
 * so a copy run onto a year somebody has begun editing adds what is missing and
 * touches nothing else.
 */
export async function copyClassStructure(
  sourceYearId: string,
  targetYearId: string,
): Promise<{ offerings: number; classes: number; groups: number }> {
  const offerings = await db.levelOffering.findMany({
    where: { schoolYearId: sourceYearId },
    include: {
      classes: {
        include: { groups: true },
      },
    },
  });

  /*
    Counted as before/after deltas rather than by inspecting each upsert.
    `update: {}` leaves `updatedAt` untouched, so a row that already existed and
    was never edited looks exactly like a fresh one by its timestamps — the
    delta is the only honest answer, and these numbers are reported to whoever
    pressed the button.
  */
  const yearScope = { levelOffering: { schoolYearId: targetYearId } };
  const [offeringsBefore, classesBefore, groupsBefore] = await Promise.all([
    db.levelOffering.count({ where: { schoolYearId: targetYearId } }),
    db.schoolClass.count({ where: yearScope }),
    db.classGroup.count({ where: { schoolClass: yearScope } }),
  ]);

  for (const offering of offerings) {
    const target = await db.levelOffering.upsert({
      where: {
        schoolYearId_levelId_scopeKey: {
          schoolYearId: targetYearId,
          levelId: offering.levelId,
          scopeKey: offering.scopeKey,
        },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        levelId: offering.levelId,
        trackId: offering.trackId,
        plannedCapacity: offering.plannedCapacity,
        isActive: offering.isActive,
        scopeKey: offering.scopeKey,
      },
      select: { id: true },
    });

    for (const schoolClass of offering.classes) {
      const targetClass = await db.schoolClass.upsert({
        where: {
          levelOfferingId_code: {
            levelOfferingId: target.id,
            code: schoolClass.code,
          },
        },
        update: {},
        create: {
          levelOfferingId: target.id,
          schoolId: schoolClass.schoolId,
          code: schoolClass.code,
          name: schoolClass.name,
          section: schoolClass.section,
          capacity: schoolClass.capacity,
          // See the note above: the room comes, the teacher does not.
          mainTeacherId: null,
          roomId: schoolClass.roomId,
          isActive: schoolClass.isActive,
        },
        select: { id: true },
      });

      for (const group of schoolClass.groups) {
        await db.classGroup.upsert({
          where: {
            schoolClassId_code: {
              schoolClassId: targetClass.id,
              code: group.code,
            },
          },
          update: {},
          create: {
            schoolClassId: targetClass.id,
            code: group.code,
            name: group.name,
            purpose: group.purpose,
            subjectId: group.subjectId,
            capacity: group.capacity,
            isActive: group.isActive,
          },
          select: { id: true },
        });
      }
    }
  }

  const [offeringsAfter, classesAfter, groupsAfter] = await Promise.all([
    db.levelOffering.count({ where: { schoolYearId: targetYearId } }),
    db.schoolClass.count({ where: yearScope }),
    db.classGroup.count({ where: { schoolClass: yearScope } }),
  ]);

  return {
    offerings: offeringsAfter - offeringsBefore,
    classes: classesAfter - classesBefore,
    groups: groupsAfter - groupsBefore,
  };
}
