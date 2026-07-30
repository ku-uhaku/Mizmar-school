import "server-only";

import { db } from "@/lib/db";
import { bookingKeyOf } from "@/modules/timetable/enums";

/**
 * Writes and invariants for the timetable module.
 *
 * Three clash rules govern a grid (see the note on TimetableEntry). The first —
 * a class cannot be in two places at once — is a property of one row's key and
 * the database enforces it through `bookingKey`. The other two span rows no
 * constraint can see, so they are checked here, on every write:
 *
 *   2. a teacher cannot be in two rooms at once
 *   3. a room cannot host two classes at once
 *
 * ── Why a lesson is several rows ──────────────────────────────────────────────
 * A double period (2h of SVT in one sitting) and a lesson repeated on Monday and
 * Thursday are both written as **one row per slot**, not as one row with a span
 * or a repeat rule. That is deliberate: every clash rule above already works per
 * slot, and the unique index already protects rule 1. A `spanSlots` column would
 * leave the second hour unbooked as far as the database is concerned, and a
 * class could be double-booked into it without anything noticing.
 *
 * The grid merges the rows back into one block for display — see
 * `loadClassTimetable`.
 */

export type Clash =
  | { kind: "TEACHER"; className: string; slotLabel: string }
  | { kind: "ROOM"; className: string; slotLabel: string }
  | { kind: "CLASS"; className: string; slotLabel: string };

/**
 * Looks for anything already booked in this slot that would collide.
 *
 * `exceptEntryIds` are the rows being edited, which must not clash with
 * themselves. Entries restricted to a different semester do not clash — a grid
 * that changes after the first exams is the reason `termId` exists.
 */
export async function findClash(input: {
  timeSlotId: string;
  schoolClassId: string;
  teacherId: string | null;
  roomId: string | null;
  classGroupId: string | null;
  termId: string | null;
  exceptEntryIds?: string[];
}): Promise<Clash | null> {
  const except = input.exceptEntryIds ?? [];

  const conflicts = await db.timetableEntry.findMany({
    where: {
      timeSlotId: input.timeSlotId,
      ...(except.length > 0 ? { NOT: { id: { in: except } } } : {}),
      // Null term means "all year", and so clashes with everything in the slot.
      OR: [{ termId: null }, ...(input.termId ? [{ termId: input.termId }] : [])],
    },
    select: {
      teacherId: true,
      roomId: true,
      schoolClassId: true,
      classGroupId: true,
      timeSlot: { select: { dayOfWeek: true, startTime: true } },
      schoolClass: { select: { code: true } },
    },
  });

  for (const entry of conflicts) {
    const slotLabel = `${entry.timeSlot.startTime}`;

    // Rule 1, checked here as well as by the index — a repeat across days can
    // land on a slot the class already uses, and a constraint violation is not
    // a message anyone can act on.
    if (
      entry.schoolClassId === input.schoolClassId &&
      // Two halves of a split class may share a slot; the whole class may not
      // share it with anybody, including one of its own groups.
      (entry.classGroupId === null ||
        input.classGroupId === null ||
        entry.classGroupId === input.classGroupId)
    ) {
      return { kind: "CLASS", className: entry.schoolClass.code, slotLabel };
    }
    if (input.teacherId && entry.teacherId === input.teacherId) {
      return { kind: "TEACHER", className: entry.schoolClass.code, slotLabel };
    }
    if (input.roomId && entry.roomId === input.roomId) {
      return { kind: "ROOM", className: entry.schoolClass.code, slotLabel };
    }
  }

  return null;
}

export type LessonBlock = {
  schoolClassId: string;
  /** The slots the lesson occupies — one per period, per day it runs on. */
  timeSlotIds: string[];
  subjectId: string;
  teacherId: string | null;
  roomId: string | null;
  classGroupId: string | null;
  termId: string | null;
};

/**
 * Writes one lesson across every slot it occupies, replacing whatever the block
 * previously held.
 *
 * `replaceEntryIds` are the rows the block used to occupy: shrinking a double
 * period back to a single one, or dropping a day it no longer runs on, has to
 * delete them, and doing that in the same transaction as the writes is what
 * stops a failed save leaving half a lesson behind.
 *
 * `bookingKey` is recomputed here and nowhere else — it mirrors the two nullable
 * columns so the no-double-booking index actually fires. See lib/db-keys.ts.
 */
export async function saveLessonBlock(
  block: LessonBlock,
  replaceEntryIds: string[] = [],
): Promise<number> {
  const bookingKey = bookingKeyOf(block.classGroupId, block.termId);

  return db.$transaction(async (tx) => {
    if (replaceEntryIds.length > 0) {
      await tx.timetableEntry.deleteMany({
        where: { id: { in: replaceEntryIds } },
      });
    }

    for (const timeSlotId of block.timeSlotIds) {
      // Upsert on the booking key rather than create: a repeat across days may
      // land on a slot this class already fills with the very lesson being
      // edited, and re-placing it should move it rather than refuse.
      await tx.timetableEntry.upsert({
        where: {
          schoolClassId_timeSlotId_bookingKey: {
            schoolClassId: block.schoolClassId,
            timeSlotId,
            bookingKey,
          },
        },
        update: {
          subjectId: block.subjectId,
          teacherId: block.teacherId,
          roomId: block.roomId,
          classGroupId: block.classGroupId,
          termId: block.termId,
        },
        create: {
          schoolClassId: block.schoolClassId,
          timeSlotId,
          subjectId: block.subjectId,
          teacherId: block.teacherId,
          roomId: block.roomId,
          classGroupId: block.classGroupId,
          termId: block.termId,
          bookingKey,
        },
      });
    }

    return block.timeSlotIds.length;
  });
}

/**
 * The rows one displayed block is made of: the same lesson, in consecutive
 * periods of the same day.
 *
 * Resolved from the database rather than trusted from the request, so clearing
 * a block cannot be turned into clearing somebody else's lesson by sending a
 * longer list of ids.
 */
export async function entriesInBlock(
  entryId: string,
): Promise<{ id: string; timeSlotId: string }[]> {
  const anchor = await db.timetableEntry.findUnique({
    where: { id: entryId },
    select: {
      schoolClassId: true,
      subjectId: true,
      teacherId: true,
      roomId: true,
      classGroupId: true,
      termId: true,
      timeSlot: { select: { dayOfWeek: true, startTime: true } },
    },
  });
  if (!anchor) return [];

  const sameLesson = await db.timetableEntry.findMany({
    where: {
      schoolClassId: anchor.schoolClassId,
      subjectId: anchor.subjectId,
      teacherId: anchor.teacherId,
      roomId: anchor.roomId,
      classGroupId: anchor.classGroupId,
      termId: anchor.termId,
      timeSlot: { dayOfWeek: anchor.timeSlot.dayOfWeek },
    },
    orderBy: { timeSlot: { startTime: "asc" } },
    select: {
      id: true,
      timeSlotId: true,
      timeSlot: { select: { startTime: true, endTime: true } },
    },
  });

  // Only the run that actually touches the anchor — the same subject taught
  // again in the afternoon is a different block, not part of this one.
  const anchorIndex = sameLesson.findIndex(
    (entry) => entry.timeSlot.startTime === anchor.timeSlot.startTime,
  );
  if (anchorIndex === -1) return [];

  const run = [sameLesson[anchorIndex]];

  for (let i = anchorIndex - 1; i >= 0; i -= 1) {
    if (sameLesson[i].timeSlot.endTime !== run[0].timeSlot.startTime) break;
    run.unshift(sameLesson[i]);
  }
  for (let i = anchorIndex + 1; i < sameLesson.length; i += 1) {
    const last = run[run.length - 1];
    if (sameLesson[i].timeSlot.startTime !== last.timeSlot.endTime) break;
    run.push(sameLesson[i]);
  }

  return run.map((entry) => ({ id: entry.id, timeSlotId: entry.timeSlotId }));
}
