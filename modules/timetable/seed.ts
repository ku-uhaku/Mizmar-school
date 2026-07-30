import { bookingKeyOf } from "@/modules/timetable/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The bell schedule for a year, and a worked week of lessons for the classes
 * that have one.
 *
 * Two grids are seeded for every year: the standard one, and the compressed
 * continuous day Moroccan schools switch to during Ramadan.
 */

type SlotSeed = {
  dayOfWeek: number;
  session: string;
  startTime: string;
  endTime: string;
  scheduleKind: string;
  position: number;
  isBreak?: boolean;
};

/** Monday–Friday full days, Saturday morning only — the Moroccan week. */
function standardSlots(): SlotSeed[] {
  const slots: SlotSeed[] = [];

  for (const day of [1, 2, 3, 4, 5]) {
    slots.push(
      { dayOfWeek: day, session: "MORNING", startTime: "08:00", endTime: "10:00", scheduleKind: "STANDARD", position: 1 },
      { dayOfWeek: day, session: "MORNING", startTime: "10:00", endTime: "10:15", scheduleKind: "STANDARD", position: 2, isBreak: true },
      { dayOfWeek: day, session: "MORNING", startTime: "10:15", endTime: "12:15", scheduleKind: "STANDARD", position: 3 },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "14:00", endTime: "16:00", scheduleKind: "STANDARD", position: 4 },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "16:00", endTime: "16:15", scheduleKind: "STANDARD", position: 5, isBreak: true },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "16:15", endTime: "18:15", scheduleKind: "STANDARD", position: 6 },
    );
  }

  slots.push(
    { dayOfWeek: 6, session: "MORNING", startTime: "08:00", endTime: "10:00", scheduleKind: "STANDARD", position: 1 },
    { dayOfWeek: 6, session: "MORNING", startTime: "10:00", endTime: "10:15", scheduleKind: "STANDARD", position: 2, isBreak: true },
    { dayOfWeek: 6, session: "MORNING", startTime: "10:15", endTime: "12:15", scheduleKind: "STANDARD", position: 3 },
  );

  return slots;
}

/** Ramadan: one continuous morning, no afternoon session. */
function ramadanSlots(): SlotSeed[] {
  return [1, 2, 3, 4, 5, 6].flatMap((day) => [
    { dayOfWeek: day, session: "MORNING", startTime: "09:00", endTime: "10:30", scheduleKind: "RAMADAN", position: 1 },
    { dayOfWeek: day, session: "MORNING", startTime: "10:40", endTime: "12:10", scheduleKind: "RAMADAN", position: 2 },
    { dayOfWeek: day, session: "MORNING", startTime: "12:20", endTime: "13:50", scheduleKind: "RAMADAN", position: 3 },
  ]);
}

export type SeededSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  isBreak: boolean;
  scheduleKind: string;
};

export async function seedTimeSlots(
  db: SeedDb,
  schoolYearId: string,
): Promise<SeededSlot[]> {
  const seeded: SeededSlot[] = [];

  for (const slot of [...standardSlots(), ...ramadanSlots()]) {
    const row = await db.timeSlot.upsert({
      where: {
        schoolYearId_scheduleKind_dayOfWeek_startTime: {
          schoolYearId,
          scheduleKind: slot.scheduleKind,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
        },
      },
      update: {
        endTime: slot.endTime,
        session: slot.session,
        position: slot.position,
        isBreak: slot.isBreak ?? false,
      },
      create: {
        schoolYearId,
        dayOfWeek: slot.dayOfWeek,
        session: slot.session,
        startTime: slot.startTime,
        endTime: slot.endTime,
        scheduleKind: slot.scheduleKind,
        position: slot.position,
        isBreak: slot.isBreak ?? false,
      },
    });
    seeded.push({
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      isBreak: row.isBreak,
      scheduleKind: row.scheduleKind,
    });
  }

  log("time slots", `${seeded.length} (standard + Ramadan)`);
  return seeded;
}

export type TimetableClass = {
  id: string;
  code: string;
  roomId: string | null;
  /** Subject id → the teacher assigned to it for this class. */
  assignments: { subjectId: string; teacherId: string; requiresLab: boolean }[];
};

/**
 * Lays out a week for each class.
 *
 * Deliberately conflict-free: the allocator tracks which teacher and which room
 * is already busy in each slot and skips rather than double-book, so the seeded
 * data satisfies the two clash rules the database cannot enforce itself.
 */
export async function seedTimetable(
  db: SeedDb,
  {
    classes,
    slots,
    termId,
    labRoomIds,
  }: {
    classes: TimetableClass[];
    slots: SeededSlot[];
    termId: string;
    labRoomIds: string[];
  },
): Promise<number> {
  const teachable = slots
    .filter((slot) => slot.scheduleKind === "STANDARD" && !slot.isBreak)
    .sort((a, b) =>
      a.dayOfWeek === b.dayOfWeek
        ? a.startTime.localeCompare(b.startTime)
        : a.dayOfWeek - b.dayOfWeek,
    );

  const busyTeacher = new Set<string>();
  const busyRoom = new Set<string>();
  const busyClass = new Set<string>();
  let created = 0;

  for (const [classIndex, klass] of classes.entries()) {
    if (klass.assignments.length === 0) continue;

    // Start each class at a different point in the week, so the early slots are
    // not all taken by the first classes seeded.
    const offset = (classIndex * 3) % teachable.length;

    for (const assignment of klass.assignments) {
      // One period per subject per week is enough for a demo grid. Scan the
      // whole week rather than consuming a slot on every miss — otherwise a
      // class runs out of week before it runs out of subjects.
      for (let step = 0; step < teachable.length; step += 1) {
        const slot = teachable[(offset + step) % teachable.length];

        const classKey = `${klass.id}:${slot.id}`;
        if (busyClass.has(classKey)) continue;

        const teacherKey = `${assignment.teacherId}:${slot.id}`;
        if (busyTeacher.has(teacherKey)) continue;

        // A lab subject needs a free lab; anything else sits in the class's own
        // room, which nobody else is using.
        const roomId = assignment.requiresLab
          ? labRoomIds.find((id) => !busyRoom.has(`${id}:${slot.id}`))
          : klass.roomId;
        if (assignment.requiresLab && !roomId) continue;

        const roomKey = roomId ? `${roomId}:${slot.id}` : null;
        if (roomKey && busyRoom.has(roomKey)) continue;

        const bookingKey = bookingKeyOf(null, termId);
        await db.timetableEntry.upsert({
          where: {
            schoolClassId_timeSlotId_bookingKey: {
              schoolClassId: klass.id,
              timeSlotId: slot.id,
              bookingKey,
            },
          },
          update: {
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            roomId: roomId ?? null,
          },
          create: {
            schoolClassId: klass.id,
            timeSlotId: slot.id,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            roomId: roomId ?? null,
            termId,
            bookingKey,
          },
        });

        busyClass.add(classKey);
        busyTeacher.add(teacherKey);
        if (roomKey) busyRoom.add(roomKey);
        created += 1;
        break;
      }
    }
  }

  log("timetable entries", created);
  return created;
}
