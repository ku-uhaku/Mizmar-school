import { assignmentScopeKey, offeringScopeKey } from "@/modules/classes/enums";
import { log, type SeedDb } from "@/prisma/seed/client";
import type { TimetableClass } from "@/modules/timetable/seed";

/**
 * The cohorts of one school year: which levels were opened, the classes inside
 * them, the groups a class splits into and who teaches what.
 *
 * Driven by the school's own academic configuration rather than a fixed list —
 * every level (and every track, where the level has them) is opened, so the two
 * schools end up with quite different class lists from the same code.
 */

export type OfferingPlan = {
  levelCode: string;
  trackCode: string | null;
  /** How many parallel classes to open. */
  classCount: number;
  capacity: number;
};

/** Section letters, so a level with three classes gets A, B and C. */
const SECTIONS = ["A", "B", "C", "D"];

export async function seedClasses(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    plans,
    levelIdByCode,
    trackIdByCode,
    subjectIdByCode,
    labSubjectCodes,
    roomIds,
    teachers,
    /** Only the running year gets teachers and groups; the rest just get classes. */
    withStaffing,
    programmeByLevel,
  }: {
    schoolId: string;
    schoolYearId: string;
    plans: OfferingPlan[];
    levelIdByCode: Record<string, string>;
    trackIdByCode: Record<string, string>;
    subjectIdByCode: Record<string, string>;
    labSubjectCodes: string[];
    roomIds: string[];
    teachers: { id: string }[];
    withStaffing: boolean;
    /** Level code → the subject codes taught there, in order. */
    programmeByLevel: Record<string, string[]>;
  },
): Promise<TimetableClass[]> {
  /** Only the staffed classes, which are what the timetable step needs. */
  const seededClasses: TimetableClass[] = [];
  let offerings = 0;
  let classCount = 0;
  let groups = 0;
  let assignments = 0;
  let roomCursor = 0;
  let teacherCursor = 0;

  for (const plan of plans) {
    const levelId = levelIdByCode[plan.levelCode];
    if (!levelId) continue;
    const trackId = plan.trackCode ? (trackIdByCode[plan.trackCode] ?? null) : null;
    if (plan.trackCode && !trackId) continue;

    const scopeKey = offeringScopeKey(trackId);
    const offering = await db.levelOffering.upsert({
      where: { schoolYearId_levelId_scopeKey: { schoolYearId, levelId, scopeKey } },
      update: { plannedCapacity: plan.capacity * plan.classCount },
      create: {
        schoolYearId,
        levelId,
        trackId,
        scopeKey,
        plannedCapacity: plan.capacity * plan.classCount,
      },
    });
    offerings += 1;

    for (let index = 0; index < plan.classCount; index += 1) {
      const section = SECTIONS[index] ?? String(index + 1);
      const code = [plan.levelCode, plan.trackCode, section]
        .filter(Boolean)
        .join("-");

      // Rooms are handed out round-robin so no two classes share a home room.
      const roomId = roomIds.length > 0 ? roomIds[roomCursor % roomIds.length] : null;
      roomCursor += 1;

      const mainTeacher =
        withStaffing && teachers.length > 0
          ? teachers[teacherCursor % teachers.length]
          : null;

      const klass = await db.schoolClass.upsert({
        where: { levelOfferingId_code: { levelOfferingId: offering.id, code } },
        update: { capacity: plan.capacity, roomId, mainTeacherId: mainTeacher?.id ?? null },
        create: {
          levelOfferingId: offering.id,
          // Denormalised from the offering's year — taken from the caller, never
          // from input. See the invariant note on SchoolClass.schoolId.
          schoolId,
          code,
          section,
          capacity: plan.capacity,
          roomId,
          mainTeacherId: mainTeacher?.id ?? null,
        },
      });

      classCount += 1;
      if (!withStaffing) continue;

      const subjectCodes = programmeByLevel[plan.levelCode] ?? [];
      const classAssignments: TimetableClass["assignments"] = [];

      for (const subjectCode of subjectCodes) {
        const subjectId = subjectIdByCode[subjectCode];
        if (!subjectId || teachers.length === 0) continue;

        const teacher = teachers[teacherCursor % teachers.length];
        teacherCursor += 1;

        await db.teachingAssignment.upsert({
          where: {
            schoolClassId_subjectId_teacherId_scopeKey: {
              schoolClassId: klass.id,
              subjectId,
              teacherId: teacher.id,
              scopeKey: assignmentScopeKey(null),
            },
          },
          update: {},
          create: {
            schoolClassId: klass.id,
            subjectId,
            teacherId: teacher.id,
            scopeKey: assignmentScopeKey(null),
          },
        });
        assignments += 1;

        classAssignments.push({
          subjectId,
          teacherId: teacher.id,
          requiresLab: labSubjectCodes.includes(subjectCode),
        });
      }

      // Lab subjects are what a class actually splits for.
      const labSubject = subjectCodes.find((code) => labSubjectCodes.includes(code));
      if (labSubject) {
        for (const groupCode of ["G1", "G2"]) {
          await db.classGroup.upsert({
            where: { schoolClassId_code: { schoolClassId: klass.id, code: groupCode } },
            update: {},
            create: {
              schoolClassId: klass.id,
              code: groupCode,
              name: `Groupe ${groupCode.slice(1)}`,
              purpose: "LAB",
              subjectId: subjectIdByCode[labSubject] ?? null,
              capacity: Math.ceil(plan.capacity / 2),
            },
          });
          groups += 1;
        }
      }

      seededClasses.push({
        id: klass.id,
        code: klass.code,
        roomId: klass.roomId,
        assignments: classAssignments,
      });
    }
  }

  log(
    "classes",
    `${offerings} offerings, ${classCount} classes, ${groups} groups, ${assignments} assignments`,
  );
  return seededClasses;
}
