import "server-only";

import { db } from "@/lib/db";
import { teachingDaysOf } from "@/lib/school-settings";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import { LAB_ROOM_KINDS } from "@/modules/facilities/enums";
import { assignmentScopeKey } from "@/modules/classes/enums";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import {
  bookingKeyOf,
  minutesSinceMidnight,
  parityOverlaps,
  weekWindowsOverlap,
  planSchoolWeeks,
  type SchoolWeekParity,
} from "@/modules/timetable/enums";
import {
  generateTimetable,
  periodsFromMinutes,
  type GeneratorDemand,
  type GeneratorSlot,
  type Placement,
} from "@/modules/timetable/generator";

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

// ── Laying out a whole week automatically ────────────────────────────────────

export type GeneratorOptions = {
  /** The classes to lay out. One, or every class of the year. */
  schoolClassIds: string[];
  /** "STANDARD" | "RAMADAN" — a school keeps a grid per bell schedule. */
  scheduleKind: string;
  /** Reproduces an exact draft. See `seededRandom`. */
  seed: number;
  /**
   * Clear these classes' existing lessons and start from an empty week.
   *
   * When false the generator fills what is free and leaves everything already
   * on the grid alone — which is how a head of studies finishes a week they
   * started by hand.
   */
  replaceExisting: boolean;
  /** Longest run of consecutive periods one subject may take. 1 = never double. */
  blockSize: number;
  /** Most periods of one subject in a single day. */
  maxPerDay: number;
};

/** A subject the generator had to leave out, and the reason a user can act on. */
export type SkippedSubject = {
  schoolClassId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  /**
   *   NO_HOURS     the programme does not say how many hours a week it gets
   *   NO_TEACHER   nobody is assigned to teach it to this class
   *
   * NO_TEACHER does not stop a lesson being placed — TimetableEntry.teacherId is
   * nullable and a grid drawn in July usually has gaps — but it is reported, so
   * the rentrée is not the moment somebody discovers it.
   */
  reason: "NO_HOURS" | "NO_TEACHER";
};

export type DraftPlacement = Placement & {
  subjectName: string;
  subjectShort: string;
  colorHex: string | null;
  teacherName: string | null;
  roomCode: string | null;
};

export type TimetableDraft = {
  /** Echoed back so "apply" can reproduce exactly this grid. */
  seed: number;
  scheduleKind: string;
  classes: { id: string; code: string; label: string }[];
  /** The teaching periods the draft was laid out on, for drawing the preview. */
  slots: GeneratorSlot[];
  placements: DraftPlacement[];
  shortfalls: {
    schoolClassId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    missing: number;
  }[];
  skipped: SkippedSubject[];
  /**
   * Teachers the generator chose for subjects nobody was assigned to — the
   * affectation. Applying the draft writes each one as a `TeachingAssignment`,
   * so the decision lands in the class file and not only in the grid.
   */
  assignments: {
    schoolClassId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
    teacherName: string;
  }[];
  /**
   * Whether the school has the staff for the programme it has declared.
   *
   * Without this a run against an understaffed school reads as a broken
   * generator: it returns a half-empty week and a list of subjects that "could
   * not be fitted", and somebody goes looking for a scheduling problem that
   * does not exist. The truth is arithmetic and worth stating plainly — twelve
   * teachers cannot deliver twenty-seven teachers' worth of lessons however
   * cleverly the week is arranged.
   */
  capacity: {
    /** Minutes of teaching the programme asks for, this run. */
    demandMinutes: number;
    /** Minutes the teachers who could take it have left between them. */
    availableMinutes: number;
    /** True when the second is short of the first. */
    understaffed: boolean;
  };
  placedPeriods: number;
  requestedPeriods: number;
};

/**
 * A generator request as it arrives from the browser.
 *
 * The same shape the service works in, with one difference of meaning: an empty
 * `schoolClassIds` asks for *every* class of the year, which is what the
 * whole-school option sends. The action resolves it against the school in
 * context before anything here sees it.
 *
 * Deliberately small — never the placements themselves. See the note on
 * `applyTimetableDraft` for why the server lays the grid out again rather than
 * writing what it is handed.
 *
 * Declared here beside the draft rather than in `actions.ts`, which may export
 * only async functions.
 */
export type GeneratorRequest = GeneratorOptions;

export type PreviewResult =
  | { ok: true; draft: TimetableDraft }
  | { ok: false; message: string };

/**
 * Works out a week's grid without writing anything.
 *
 * Split from the write for the same reason `buildFeeSchedule` is: a school has
 * to see what it is agreeing to before it agrees, and the figures on that
 * preview must be produced by the code that will produce the rows. The rule
 * itself lives in `generator.ts`, which is pure — this only fetches what it
 * needs and puts names on the result.
 *
 * ── Where the hours come from ───────────────────────────────────────────────
 * `TeachingAssignment.weeklyMinutes` first, then `LevelSubject.weeklyMinutes`.
 * The assignment wins because it is the per-class answer and the level's is the
 * programme's default; a class doing extra French says so on its assignment. A
 * subject with neither is skipped and reported rather than guessed at — the
 * whole point of the exercise is that the hours are declared somewhere.
 *
 * Component subjects are left out: they are marked inside their parent and
 * never taught in their own hour, exactly as `loadTimetableChoices` filters
 * them out of the manual picker.
 */
export async function buildTimetableDraft(
  schoolId: string,
  schoolYearId: string,
  options: GeneratorOptions,
): Promise<TimetableDraft> {
  const classes = await db.schoolClass.findMany({
    where: {
      id: { in: options.schoolClassIds },
      // Scoped by the school and year the caller resolved, never by id alone.
      schoolId,
      levelOffering: { schoolYearId },
      isActive: true,
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      roomId: true,
      levelOffering: { select: { levelId: true, trackId: true } },
      assignments: {
        select: {
          subjectId: true,
          teacherId: true,
          classGroupId: true,
          weeklyMinutes: true,
          isPrimary: true,
          teacher: {
            select: {
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  const empty: TimetableDraft = {
    seed: options.seed,
    scheduleKind: options.scheduleKind,
    classes: [],
    slots: [],
    placements: [],
    shortfalls: [],
    skipped: [],
    assignments: [],
    capacity: { demandMinutes: 0, availableMinutes: 0, understaffed: false },
    placedPeriods: 0,
    requestedPeriods: 0,
  };
  if (classes.length === 0) return empty;

  const settings = await loadSchoolSettings(schoolId);
  const teachingDays = new Set<number>(teachingDaysOf(settings));

  const slotRows = await db.timeSlot.findMany({
    where: {
      schoolYearId,
      scheduleKind: options.scheduleKind,
      isActive: true,
      // A break is not a period anything can be taught in, and leaving it in
      // would let a "double" straddle the récréation.
      isBreak: false,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      session: true,
    },
  });

  const slots: GeneratorSlot[] = slotRows.filter((slot) =>
    teachingDays.has(slot.dayOfWeek),
  );
  if (slots.length === 0) return { ...empty, classes: labelled(classes) };

  // The school's ordinary period, for turning declared minutes into periods.
  // The commonest length rather than the mean: a school with one 30-minute
  // slot at the end of Friday must not have every subject re-scaled by it.
  const periodMinutes = modalDuration(slots);

  const levelIds = [
    ...new Set(classes.map((entry) => entry.levelOffering.levelId)),
  ];
  const programme = await db.levelSubject.findMany({
    where: { levelId: { in: levelIds }, subject: { isActive: true } },
    orderBy: [{ position: "asc" }],
    select: {
      levelId: true,
      trackId: true,
      weeklyMinutes: true,
      subject: {
        select: {
          id: true,
          name: true,
          shortName: true,
          code: true,
          colorHex: true,
          parentId: true,
          // Narrows which rooms will do — see `roomSuits`.
          requiresLab: true,
        },
      },
    },
  });

  // Everything already on the grid, so the four rules are checked against the
  // real week. When a class is being replaced its own bookings are dropped from
  // these maps — they are about to be deleted, and counting them would have the
  // generator refusing to reuse the slots it is emptying.
  const targetIds = new Set(classes.map((entry) => entry.id));
  const existing = await db.timetableEntry.findMany({
    where: { timeSlot: { schoolYearId, scheduleKind: options.scheduleKind } },
    select: {
      schoolClassId: true,
      timeSlotId: true,
      teacherId: true,
      roomId: true,
      subjectId: true,
    },
  });

  const busyTeacher: Record<string, string[]> = {};
  const busyRoom: Record<string, string[]> = {};
  const busyClass: Record<string, string[]> = {};
  // Minutes already carried, so a run that leaves other grids standing counts
  // them against the caps rather than pretending everyone starts at zero.
  const teacherLoad: Record<string, number> = {};
  const classLoad: Record<string, number> = {};
  /** `classId:subjectId` → periods the class already has. */
  const alreadyPlaced = new Map<string, number>();

  for (const entry of existing) {
    const isTarget = targetIds.has(entry.schoolClassId);
    if (isTarget && options.replaceExisting) continue;

    if (entry.teacherId) {
      (busyTeacher[entry.teacherId] ??= []).push(entry.timeSlotId);
      teacherLoad[entry.teacherId] =
        (teacherLoad[entry.teacherId] ?? 0) + periodMinutes;
    }
    if (entry.roomId) (busyRoom[entry.roomId] ??= []).push(entry.timeSlotId);
    (busyClass[entry.schoolClassId] ??= []).push(entry.timeSlotId);
    classLoad[entry.schoolClassId] =
      (classLoad[entry.schoolClassId] ?? 0) + periodMinutes;

    if (isTarget) {
      const key = `${entry.schoolClassId}:${entry.subjectId}`;
      alreadyPlaced.set(key, (alreadyPlaced.get(key) ?? 0) + 1);
    }
  }

  const unavailability = await db.teacherUnavailability.findMany({
    where: { timeSlot: { schoolYearId, scheduleKind: options.scheduleKind } },
    select: { teacherId: true, timeSlotId: true },
  });
  const unavailableTeacher: Record<string, string[]> = {};
  for (const row of unavailability) {
    (unavailableTeacher[row.teacherId] ??= []).push(row.timeSlotId);
  }

  /*
    Who could take each subject, when the school has not said.

    Two sources, and the second is what makes this work on day one. An explicit
    `TeacherSubject` row is the school's declaration and always wins. Where a
    subject has none, the pool is inferred from who already teaches it *anywhere
    in this school*: a teacher taking 4AP maths can take 5AP maths, and a school
    with a year of assignments behind it should not have to retype all of them
    into a new table before the generator is of any use.

    Inference never overrides a declaration. The moment a school declares even
    one qualified teacher for a subject, that list is the list — otherwise
    declaring a specialist would silently *widen* the pool rather than narrow it.
  */
  const [declared, inferred, rooms, staffCaps, sizes] = await Promise.all([
    db.teacherSubject.findMany({
      where: { schoolId, isActive: true, teacher: { isActive: true } },
      orderBy: [{ preferenceRank: "asc" }],
      select: { subjectId: true, teacherId: true },
    }),
    db.teachingAssignment.findMany({
      where: { schoolClass: { schoolId } },
      select: { subjectId: true, teacherId: true },
      distinct: ["subjectId", "teacherId"],
    }),
    db.room.findMany({
      where: { schoolId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, kind: true, capacity: true },
    }),
    db.staff.findMany({
      where: { schoolId, userId: { not: null }, maxWeeklyMinutes: { not: null } },
      select: { userId: true, maxWeeklyMinutes: true },
    }),
    // How many pupils to seat, for rejecting a room too small. From the
    // enrolments rather than `capacity`, which is what the class may hold and
    // not who is in it.
    db.enrollment.groupBy({
      by: ["schoolClassId"],
      where: { schoolYearId, schoolClassId: { in: [...targetIds] }, status: { in: [...LIVE_ENROLMENT_STATUSES] } },
      _count: true,
    }),
  ]);

  const declaredBySubject = new Map<string, string[]>();
  for (const row of declared) {
    declaredBySubject.set(row.subjectId, [
      ...(declaredBySubject.get(row.subjectId) ?? []),
      row.teacherId,
    ]);
  }
  const inferredBySubject = new Map<string, string[]>();
  for (const row of inferred) {
    inferredBySubject.set(row.subjectId, [
      ...(inferredBySubject.get(row.subjectId) ?? []),
      row.teacherId,
    ]);
  }
  const qualifiedFor = (subjectId: string): string[] =>
    declaredBySubject.get(subjectId) ?? inferredBySubject.get(subjectId) ?? [];

  const classSizes = new Map(
    sizes.map((row) => [row.schoolClassId as string, row._count] as const),
  );

  // Every teacher's ceiling: their contract's, or the school's standard service.
  const teacherCapacity: Record<string, number> = {};
  const cappedByContract = new Map(
    staffCaps.map((row) => [row.userId as string, row.maxWeeklyMinutes ?? 0]),
  );
  for (const teacherId of new Set([
    ...declared.map((row) => row.teacherId),
    ...inferred.map((row) => row.teacherId),
    ...Object.keys(teacherLoad),
  ])) {
    teacherCapacity[teacherId] =
      cappedByContract.get(teacherId) ?? settings.teacherWeeklyMinutes;
  }

  const demands: GeneratorDemand[] = [];
  const skipped: SkippedSubject[] = [];
  const subjectsById = new Map<
    string,
    { name: string; short: string; colorHex: string | null }
  >();

  for (const schoolClass of classes) {
    const { levelId, trackId } = schoolClass.levelOffering;

    // This class's stream, plus the rows declared for every stream. Deduped on
    // the subject so a stream-specific row wins over the catch-all.
    const rows = programme.filter(
      (row) =>
        row.levelId === levelId &&
        (row.trackId === null || row.trackId === trackId) &&
        row.subject.parentId === null,
    );

    const bySubject = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const held = bySubject.get(row.subject.id);
      // A row naming this stream is more specific than the "every stream" one.
      if (!held || (held.trackId === null && row.trackId !== null)) {
        bySubject.set(row.subject.id, row);
      }
    }

    for (const row of bySubject.values()) {
      const subject = row.subject;
      subjectsById.set(subject.id, {
        name: subject.name,
        short: subject.shortName ?? subject.code,
        colorHex: subject.colorHex,
      });

      const assignment =
        schoolClass.assignments.find(
          (entry) => entry.subjectId === subject.id && entry.isPrimary,
        ) ??
        schoolClass.assignments.find((entry) => entry.subjectId === subject.id);

      const weeklyMinutes = assignment?.weeklyMinutes ?? row.weeklyMinutes;
      if (!weeklyMinutes || weeklyMinutes <= 0) {
        skipped.push({
          schoolClassId: schoolClass.id,
          className: schoolClass.code,
          subjectId: subject.id,
          subjectName: subject.name,
          reason: "NO_HOURS",
        });
        continue;
      }

      // Who may take it. The school's own assignment when there is one — it has
      // decided, and the generator does not re-open that. Otherwise the
      // qualified pool, and the placer picks.
      const candidateTeachers = assignment
        ? [assignment.teacherId]
        : qualifiedFor(subject.id);

      if (candidateTeachers.length === 0) {
        // Placed anyway, with nobody in front of it — see SkippedSubject.
        skipped.push({
          schoolClassId: schoolClass.id,
          className: schoolClass.code,
          subjectId: subject.id,
          subjectName: subject.name,
          reason: "NO_TEACHER",
        });
      }

      const wanted = periodsFromMinutes(weeklyMinutes, periodMinutes);
      // What the class already has of this subject counts towards the
      // programme, so a top-up run adds the missing hours instead of a second
      // full week of them.
      const outstanding =
        wanted - (alreadyPlaced.get(`${schoolClass.id}:${subject.id}`) ?? 0);
      if (outstanding <= 0) continue;

      demands.push({
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        classGroupId: assignment?.classGroupId ?? null,
        candidateTeachers,
        teacherWasAssigned: Boolean(assignment),
        homeRoomId: schoolClass.roomId,
        requiresLab: subject.requiresLab,
        classSize: classSizes.get(schoolClass.id) ?? 0,
        periods: outstanding,
        blockSize: Math.max(1, options.blockSize),
        maxPerDay: Math.max(1, options.maxPerDay),
      });
    }
  }

  /*
    What the run is asking for, against what the staff have left.

    Counted over the teachers who are actually candidates for something in this
    run — a maths teacher's spare hours are no help to a class short of Arabic,
    but at this altitude the total is the honest headline and the per-subject
    detail is the shortfall list underneath it.
  */
  const demandMinutes = demands.reduce(
    (sum, demand) => sum + demand.periods * periodMinutes,
    0,
  );
  const inPlay = new Set(demands.flatMap((demand) => demand.candidateTeachers));
  const availableMinutes = [...inPlay].reduce(
    (sum, teacherId) =>
      sum +
      Math.max(
        0,
        (teacherCapacity[teacherId] ?? settings.teacherWeeklyMinutes) -
          (teacherLoad[teacherId] ?? 0),
      ),
    0,
  );

  const result = generateTimetable({
    slots,
    demands,
    rooms,
    busyTeacher,
    busyRoom,
    busyClass,
    unavailableTeacher,
    periodMinutes,
    teacherCapacity,
    teacherLoad,
    classCapacity: settings.classWeeklyMinutes,
    classLoad,
    labRoomKinds: LAB_ROOM_KINDS,
    seed: options.seed,
  });

  // Names for the preview. Teachers and rooms are looked up once here rather
  // than per placement, which would be a query per lesson.
  const teacherNames = new Map<string, string>();
  for (const schoolClass of classes) {
    for (const assignment of schoolClass.assignments) {
      if (!assignment.teacher) continue;
      const profile = assignment.teacher.profile;
      teacherNames.set(
        assignment.teacherId,
        profile
          ? `${profile.firstName} ${profile.lastName}`.trim()
          : assignment.teacher.email,
      );
    }
  }

  // Every room the placer could have reached for, not just the home ones — it
  // now allocates from the whole pool when a class's own salle is busy.
  const roomCodes = new Map(rooms.map((room) => [room.id, room.code]));

  const chosenIds = [
    ...new Set(result.assignments.map((choice) => choice.teacherId)),
  ].filter((id) => !teacherNames.has(id));
  if (chosenIds.length > 0) {
    const picked = await db.user.findMany({
      where: { id: { in: chosenIds } },
      select: {
        id: true,
        email: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    for (const user of picked) {
      teacherNames.set(
        user.id,
        user.profile
          ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
          : user.email,
      );
    }
  }

  const classCodes = new Map(classes.map((entry) => [entry.id, entry.code]));

  return {
    seed: options.seed,
    scheduleKind: options.scheduleKind,
    classes: labelled(classes),
    slots,
    placements: result.placements.map((placement) => {
      const subject = subjectsById.get(placement.subjectId);
      return {
        ...placement,
        subjectName: subject?.name ?? "",
        subjectShort: subject?.short ?? "",
        colorHex: subject?.colorHex ?? null,
        teacherName: placement.teacherId
          ? (teacherNames.get(placement.teacherId) ?? null)
          : null,
        roomCode: placement.roomId
          ? (roomCodes.get(placement.roomId) ?? null)
          : null,
      };
    }),
    shortfalls: result.shortfalls.map((shortfall) => ({
      ...shortfall,
      className: classCodes.get(shortfall.schoolClassId) ?? "",
      subjectName: subjectsById.get(shortfall.subjectId)?.name ?? "",
    })),
    skipped,
    assignments: result.assignments.map((choice) => ({
      ...choice,
      className: classCodes.get(choice.schoolClassId) ?? "",
      subjectName: subjectsById.get(choice.subjectId)?.name ?? "",
      teacherName: teacherNames.get(choice.teacherId) ?? "",
    })),
    capacity: {
      demandMinutes,
      availableMinutes,
      understaffed: availableMinutes < demandMinutes,
    },
    placedPeriods: result.placedPeriods,
    requestedPeriods: result.requestedPeriods,
  };
}

function labelled(
  classes: { id: string; code: string; name: string | null }[],
): { id: string; code: string; label: string }[] {
  return classes.map((entry) => ({
    id: entry.id,
    code: entry.code,
    label: entry.name ?? entry.code,
  }));
}

/** The commonest period length in minutes — see the note at the call site. */
function modalDuration(slots: GeneratorSlot[]): number {
  const tally = new Map<number, number>();
  for (const slot of slots) {
    const length =
      minutesSinceMidnight(slot.endTime) - minutesSinceMidnight(slot.startTime);
    if (length > 0) tally.set(length, (tally.get(length) ?? 0) + 1);
  }

  let best = 60;
  let bestCount = 0;
  for (const [length, count] of tally) {
    if (count > bestCount) {
      best = length;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Writes a generated grid.
 *
 * ── Why it regenerates instead of taking the preview's rows ─────────────────
 * The draft the browser is holding came from the server, but it comes *back*
 * through a request, and a request is never trusted: a crafted payload could
 * otherwise book any teacher into any class in the school. So the client sends
 * only the options and the seed, and this lays the week out again from the
 * database. `generateTimetable` is deterministic in its seed, so the same seed
 * against the same grid gives the same answer, and "apply what I previewed"
 * means what it says.
 *
 * It re-reads rather than replaying a cached draft on purpose: if somebody
 * booked a room in the meantime, the second run sees it and places around it.
 * The result is reported back with real counts, so a grid that came out
 * different from the preview says so rather than pretending.
 *
 * Everything is written as an all-year, every-week template — `termId` null,
 * parity ALL, no week window. A generated grid is the starting point a school
 * then edits, and edits made from a given week already know how to close the
 * old row and open a new one; see `closeEntriesFromWeek`.
 */
export async function applyTimetableDraft(
  schoolId: string,
  schoolYearId: string,
  options: GeneratorOptions,
): Promise<{
  written: number;
  cleared: number;
  assigned: number;
  draft: TimetableDraft;
}> {
  const draft = await buildTimetableDraft(schoolId, schoolYearId, options);
  const classIds = draft.classes.map((entry) => entry.id);

  if (classIds.length === 0) {
    return { written: 0, cleared: 0, assigned: 0, draft };
  }

  return db.$transaction(async (tx) => {
    let cleared = 0;

    if (options.replaceExisting) {
      const gone = await tx.timetableEntry.deleteMany({
        where: {
          schoolClassId: { in: classIds },
          // Only this bell schedule: regenerating the standard week must not
          // wipe the Ramadan one, which is a separate decision.
          timeSlot: {
            schoolYearId,
            scheduleKind: options.scheduleKind,
          },
        },
      });
      cleared = gone.count;
    }

    /*
      The affectations, written before the lessons that depend on them.

      This is the half of the job the grid alone cannot do. A generated week
      that named a teacher in its cells but left `TeachingAssignment` empty
      would look right and be wrong: the class file would still say nobody
      teaches 4AP maths, the next generation would re-decide it from scratch,
      and a head of studies looking for "who has this class" would find nothing.

      Upserted on the same key the manual editor uses, so re-applying settles on
      the newer choice instead of failing the run, and an assignment somebody
      made by hand between preview and apply is respected rather than doubled.
    */
    let assigned = 0;

    for (const choice of draft.assignments) {
      await tx.teachingAssignment.upsert({
        where: {
          schoolClassId_subjectId_teacherId_scopeKey: {
            schoolClassId: choice.schoolClassId,
            subjectId: choice.subjectId,
            teacherId: choice.teacherId,
            scopeKey: assignmentScopeKey(null),
          },
        },
        update: {},
        create: {
          schoolClassId: choice.schoolClassId,
          subjectId: choice.subjectId,
          teacherId: choice.teacherId,
          classGroupId: null,
          isPrimary: true,
          scopeKey: assignmentScopeKey(null),
        },
      });
      assigned += 1;
    }

    let written = 0;

    for (const placement of draft.placements) {
      const bookingKey = bookingKeyOf(
        placement.classGroupId,
        null,
        "ALL",
        null,
        null,
      );

      for (const timeSlotId of placement.timeSlotIds) {
        // Upsert rather than create: without `replaceExisting` the class may
        // already hold this exact booking key in this slot, and a generated
        // grid should settle on the newer lesson rather than fail the whole run.
        await tx.timetableEntry.upsert({
          where: {
            schoolClassId_timeSlotId_bookingKey: {
              schoolClassId: placement.schoolClassId,
              timeSlotId,
              bookingKey,
            },
          },
          update: {
            subjectId: placement.subjectId,
            teacherId: placement.teacherId,
            roomId: placement.roomId,
          },
          create: {
            schoolClassId: placement.schoolClassId,
            timeSlotId,
            subjectId: placement.subjectId,
            teacherId: placement.teacherId,
            roomId: placement.roomId,
            classGroupId: placement.classGroupId,
            termId: null,
            weekParity: "ALL",
            fromWeek: null,
            toWeek: null,
            bookingKey,
          },
        });
        written += 1;
      }
    }

    return { written, cleared, assigned, draft };
  });
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
