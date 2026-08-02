import "server-only";

import { db } from "@/lib/db";
import {
  bookingKeyOf,
  parityOverlaps,
  weekWindowsOverlap,
  planSchoolWeeks,
  type SchoolWeekParity,
} from "@/modules/timetable/enums";

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
 *   4. a teacher cannot be booked in a period they do not work
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
  | { kind: "CLASS"; className: string; slotLabel: string }
  /**
   * The teacher does not work this period at all — a standing arrangement, not
   * another booking. `className` carries the reason they gave, when they gave
   * one, because "M. Bennis ne travaille pas lundi 08:00" is only half an
   * answer if the grid-builder cannot see why.
   */
  | { kind: "UNAVAILABLE"; className: string; slotLabel: string };

/**
 * Looks for anything already booked in this slot that would collide.
 *
 * `exceptEntryIds` are the rows being edited, which must not clash with
 * themselves. Entries restricted to a different semester do not clash — a grid
 * that changes after the first exams is the reason `termId` exists — and nor do
 * entries on opposite weeks of the rotation.
 *
 * Four rules, in the order a grid-builder would want to hear them: the teacher
 * does not work then, the teacher is elsewhere, the room is taken, the class is
 * already sat down.
 */
export async function findClash(input: {
  timeSlotId: string;
  schoolClassId: string;
  teacherId: string | null;
  roomId: string | null;
  classGroupId: string | null;
  termId: string | null;
  /** "ALL" | "A" | "B" — lessons on opposite weeks never collide. */
  weekParity?: string | null;
  /** The weeks the incoming lesson is in force for. */
  fromWeek?: number | null;
  toWeek?: number | null;
  exceptEntryIds?: string[];
}): Promise<Clash | null> {
  const except = input.exceptEntryIds ?? [];

  // Checked before the bookings: a teacher who does not work this period is not
  // "busy", and saying so is a different sentence from naming the class they
  // are already with.
  if (input.teacherId) {
    const blocked = await db.teacherUnavailability.findUnique({
      where: {
        teacherId_timeSlotId: {
          teacherId: input.teacherId,
          timeSlotId: input.timeSlotId,
        },
      },
      select: { reason: true, timeSlot: { select: { startTime: true } } },
    });
    if (blocked) {
      return {
        kind: "UNAVAILABLE",
        className: blocked.reason ?? "",
        slotLabel: blocked.timeSlot.startTime,
      };
    }
  }

  const conflicts = await db.timetableEntry.findMany({
    where: {
      timeSlotId: input.timeSlotId,
      ...(except.length > 0 ? { NOT: { id: { in: except } } } : {}),
      /*
        Null term means "all year", and so collides with everything in the slot
        — including a lesson pinned to one semester. The filter therefore only
        narrows when the *incoming* lesson has a term of its own: an all-year
        booking must see every row, or a grid could be laid over a semester
        lesson nobody was warned about.
      */
      ...(input.termId
        ? { OR: [{ termId: null }, { termId: input.termId }] }
        : {}),
    },
    select: {
      teacherId: true,
      roomId: true,
      schoolClassId: true,
      classGroupId: true,
      weekParity: true,
      fromWeek: true,
      toWeek: true,
      timeSlot: { select: { dayOfWeek: true, startTime: true } },
      schoolClass: { select: { code: true } },
    },
  });

  for (const entry of conflicts) {
    const slotLabel = `${entry.timeSlot.startTime}`;

    // Opposite weeks of the rotation never meet, so nothing below applies —
    // that is the whole point of a fortnightly grid. ALL overlaps both, which
    // is why the unique index cannot decide this on its own.
    if (!parityOverlaps(entry.weekParity, input.weekParity)) continue;

    // Nor do lessons that are never in force in the same week: the two halves
    // of a lesson edited mid-year are exactly this case, and treating them as a
    // clash would make a grid uneditable after the first term.
    if (
      !weekWindowsOverlap(
        { fromWeek: entry.fromWeek, toWeek: entry.toWeek },
        { fromWeek: input.fromWeek ?? null, toWeek: input.toWeek ?? null },
      )
    ) {
      continue;
    }

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
  /** "ALL" | "A" | "B" — which weeks of the rotation it runs in. */
  weekParity: string;
  /** The first week it applies to. Null = since the start of the year. */
  fromWeek: number | null;
  /** The last. Null = until further notice. */
  toWeek: number | null;
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
  const bookingKey = bookingKeyOf(
    block.classGroupId,
    block.termId,
    block.weekParity,
    block.fromWeek,
    block.toWeek,
  );

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
          weekParity: block.weekParity,
          fromWeek: block.fromWeek,
          toWeek: block.toWeek,
        },
        create: {
          schoolClassId: block.schoolClassId,
          timeSlotId,
          subjectId: block.subjectId,
          teacherId: block.teacherId,
          roomId: block.roomId,
          classGroupId: block.classGroupId,
          termId: block.termId,
          weekParity: block.weekParity,
          fromWeek: block.fromWeek,
          toWeek: block.toWeek,
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

// ── The year's weeks ─────────────────────────────────────────────────────────

/**
 * Lays out (or re-lays) the numbered weeks of a school year.
 *
 * Idempotent by construction: weeks upsert on `(schoolYearId, number)`, so
 * running it twice changes nothing and running it after a holiday is added
 * renumbers from the same rules. Any week the new plan no longer reaches is
 * deleted — a year shortened must not keep a trailing S37 nobody teaches.
 *
 * `label` is deliberately left alone on an existing row: a school that named
 * S12 "Semaine d'examens" keeps that name when the dates around it shift.
 * `parity` is *not* left alone — it is a consequence of the numbering, and a
 * school wanting to flip the rotation edits one row afterwards.
 */
export async function generateSchoolWeeks(
  schoolYearId: string,
  firstParity: SchoolWeekParity = "A",
): Promise<{ written: number; removed: number }> {
  const year = await db.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { startDate: true, endDate: true },
  });
  if (!year) return { written: 0, removed: 0 };

  const holidays = await db.schoolHoliday.findMany({
    where: { schoolYearId },
    select: { startDate: true, endDate: true },
  });

  const plan = planSchoolWeeks({
    yearStart: year.startDate,
    yearEnd: year.endDate,
    holidays,
    firstParity,
  });

  for (const week of plan) {
    await db.schoolWeek.upsert({
      where: {
        schoolYearId_number: { schoolYearId, number: week.number },
      },
      update: {
        startsOn: week.startsOn,
        endsOn: week.endsOn,
        isTeaching: week.isTeaching,
        parity: week.parity,
      },
      create: {
        schoolYearId,
        number: week.number,
        startsOn: week.startsOn,
        endsOn: week.endsOn,
        isTeaching: week.isTeaching,
        parity: week.parity,
      },
    });
  }

  const removed = await db.schoolWeek.deleteMany({
    where: { schoolYearId, number: { gt: plan.length } },
  });

  return { written: plan.length, removed: removed.count };
}

// ── Editing a grid that already has history ──────────────────────────────────

/**
 * Closes a lesson at the week before `fromWeek`, or deletes it outright.
 *
 * ── Why a grid is not simply overwritten ────────────────────────────────────
 * A timetable is a fact about a week, not about a year. A room changed in
 * February must not rewrite what September taught: the register, the
 * remplacement and the inspection are all read against what was true at the
 * time. So an edit made from week 12 ends the old row at week 11 and leaves it
 * standing, rather than rewriting the term that has already happened.
 *
 * A row that only ever applied from week 12 onwards has no past to keep, so it
 * is deleted — closing it at week 11 would leave a lesson that runs from 12 to
 * 11, which is nothing at all.
 *
 * Returns what happened, so the caller can say "ended" rather than "deleted"
 * when that is what a user will see on last week's grid.
 */
export async function closeEntriesFromWeek(
  entryIds: string[],
  fromWeek: number | null,
): Promise<{ ended: number; deleted: number }> {
  if (entryIds.length === 0) return { ended: 0, deleted: 0 };

  // No week in play — the caller is editing the template itself, so there is no
  // history to protect and the old rows simply go.
  if (fromWeek === null || fromWeek <= 1) {
    const gone = await db.timetableEntry.deleteMany({
      where: { id: { in: entryIds } },
    });
    return { ended: 0, deleted: gone.count };
  }

  const entries = await db.timetableEntry.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, fromWeek: true },
  });

  const toEnd = entries
    .filter((entry) => (entry.fromWeek ?? 1) < fromWeek)
    .map((entry) => entry.id);
  const toDelete = entries
    .filter((entry) => (entry.fromWeek ?? 1) >= fromWeek)
    .map((entry) => entry.id);

  const [ended, deleted] = await db.$transaction([
    db.timetableEntry.updateMany({
      where: { id: { in: toEnd } },
      // The key carries the window, so it has to move with it.
      data: { toWeek: fromWeek - 1 },
    }),
    db.timetableEntry.deleteMany({ where: { id: { in: toDelete } } }),
  ]);

  // `updateMany` cannot recompute a derived column per row, so the ended rows
  // get their keys rewritten here — the invariant on `bookingKey` is absolute.
  for (const id of toEnd) {
    const entry = await db.timetableEntry.findUnique({
      where: { id },
      select: {
        classGroupId: true,
        termId: true,
        weekParity: true,
        fromWeek: true,
        toWeek: true,
      },
    });
    if (!entry) continue;
    await db.timetableEntry.update({
      where: { id },
      data: {
        bookingKey: bookingKeyOf(
          entry.classGroupId,
          entry.termId,
          entry.weekParity,
          entry.fromWeek,
          entry.toWeek,
        ),
      },
    });
  }

  return { ended: ended.count, deleted: deleted.count };
}

// ── Carrying the calendar into a new year ────────────────────────────────────

/**
 * Copies the bell schedule onto another year.
 *
 * Times and days carry across unchanged: a school's periods are a standing
 * arrangement, not a date, and the Ramadan set comes with the standard one
 * because both are the same decision made once.
 *
 * Teacher unavailability is **not** carried. It hangs off the individual slots,
 * and who works when is renegotiated over the summer — a stale block would
 * silently refuse a lesson nobody could explain.
 *
 * Idempotent on `(schoolYearId, scheduleKind, dayOfWeek, startTime)`, and never
 * overwrites an existing slot.
 */
export async function copyTimeSlots(
  sourceYearId: string,
  targetYearId: string,
): Promise<number> {
  const slots = await db.timeSlot.findMany({
    where: { schoolYearId: sourceYearId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // A before/after delta, not a per-row guess: `update: {}` leaves `updatedAt`
  // untouched, so an existing row that was never edited is indistinguishable
  // from a fresh one by its timestamps.
  const before = await db.timeSlot.count({
    where: { schoolYearId: targetYearId },
  });

  for (const slot of slots) {
    await db.timeSlot.upsert({
      where: {
        schoolYearId_scheduleKind_dayOfWeek_startTime: {
          schoolYearId: targetYearId,
          scheduleKind: slot.scheduleKind,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
        },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        dayOfWeek: slot.dayOfWeek,
        session: slot.session,
        startTime: slot.startTime,
        endTime: slot.endTime,
        scheduleKind: slot.scheduleKind,
        position: slot.position,
        isBreak: slot.isBreak,
        isActive: slot.isActive,
      },
      select: { id: true },
    });
  }

  return (
    (await db.timeSlot.count({ where: { schoolYearId: targetYearId } })) - before
  );
}

/**
 * Copies the holiday calendar onto another year, shifted.
 *
 * ── Why whole weeks ─────────────────────────────────────────────────────────
 * `shiftDays` is the gap between the two years' start dates rounded to whole
 * weeks, so a Monday stays a Monday. That matters here more than it looks: the
 * bell schedule is keyed on the day of the week, and `planSchoolWeeks` decides
 * whether a week is taught by checking Monday to Saturday. A holiday that slid
 * mid-week would quietly change which weeks count.
 *
 * ── What this cannot get right ──────────────────────────────────────────────
 * Aïd, Mawlid and Achoura follow the Islamic calendar and move about eleven
 * days earlier each Gregorian year, so no shift rule places them correctly.
 * They are copied so the school has the row and the name, and the dates must be
 * corrected from the ministry circular. The fixed fêtes land within a few days.
 *
 * There is no unique constraint on a holiday, so this refuses to run twice
 * rather than upserting: a year that already has holidays keeps them, and the
 * caller is told nothing was copied.
 */
export async function copyHolidays(
  sourceYearId: string,
  targetYearId: string,
  shiftDays: number,
): Promise<number> {
  const existing = await db.schoolHoliday.count({
    where: { schoolYearId: targetYearId },
  });
  if (existing > 0) return 0;

  const holidays = await db.schoolHoliday.findMany({
    where: { schoolYearId: sourceYearId },
    orderBy: { startDate: "asc" },
  });
  if (holidays.length === 0) return 0;

  const shift = (date: Date) => {
    const moved = new Date(date);
    moved.setDate(moved.getDate() + shiftDays);
    return moved;
  };

  const created = await db.schoolHoliday.createMany({
    data: holidays.map((holiday) => ({
      schoolYearId: targetYearId,
      name: holiday.name,
      nameAr: holiday.nameAr,
      startDate: shift(holiday.startDate),
      endDate: shift(holiday.endDate),
      kind: holiday.kind,
      notes: holiday.notes,
    })),
  });

  return created.count;
}
