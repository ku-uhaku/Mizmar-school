import "server-only";

import { recordEvent } from "@/lib/audit";
import { auditClient, db } from "@/lib/db";
import type { TxClient } from "@/modules/treasury/service";
import { teachingDaysOf } from "@/lib/school-settings";
import { teacherOfSchool } from "@/lib/scope";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import { LAB_ROOM_KINDS } from "@/modules/facilities/enums";
import {
  qualifiedTeachers,
  type Qualification,
} from "@/modules/hr/qualifications";
import { layPeriodBlock } from "@/modules/timetable/presets";
import { assignmentScopeKey } from "@/modules/classes/enums";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { activeVersionId } from "@/modules/timetable/queries";
import {
  MAX_BLOCK_MINUTES,
  activeVersionKeyOf,
  bookingKeyOf,
  minutesSinceMidnight,
  parityOverlaps,
  weekWindowsOverlap,
  planSchoolWeeks,
  type SchoolWeekParity,
} from "@/modules/timetable/enums";
import {
  generateTimetable,
  minutesToCover,
  SLACK_MINUTES,
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

/**
 * The grid a manual edit writes into, creating it if this scope has never
 * held one — a bell schedule hand-built from scratch, before any generation
 * run. `applyTimetableDraft` never calls this: generating always makes its
 * own new version, see the note there.
 */
export async function ensureActiveVersion(
  schoolYearId: string,
  scheduleKind: string,
): Promise<string> {
  const existing = await activeVersionId(schoolYearId, scheduleKind);
  if (existing) return existing;

  try {
    const version = await db.timetableVersion.create({
      data: {
        schoolYearId,
        scheduleKind,
        status: "ACTIVE",
        activeKey: activeVersionKeyOf(schoolYearId, scheduleKind),
        label: "Manual grid",
      },
    });
    return version.id;
  } catch {
    // Somebody else's first edit won the race on `activeKey`'s unique index —
    // their version is the one that exists now, and it is exactly as good.
    const wonByAnother = await activeVersionId(schoolYearId, scheduleKind);
    if (wonByAnother) return wonByAnother;
    throw new Error("Failed to resolve the active timetable version.");
  }
}

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
export async function findClash(
  input: {
    /** The grid being edited — see the note on TimetableVersion.activeKey.
     *  A row in a different version, however similar, is history and cannot
     *  clash with anything being written today. */
    versionId: string;
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
  },
  /**
   * The transaction to read in, when the caller is about to write in one.
   *
   * Called bare it reads the committed grid, which is what the dialog wants for
   * its message. `saveLessonBlock` passes its own, so the check and the write
   * see the same snapshot — see the note there.
   */
  client: TxClient | typeof db = db,
): Promise<Clash | null> {
  const db = client;
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
      versionId: input.versionId,
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

export type SaveLessonResult =
  | { ok: true; written: number }
  /** Somebody else took the slot between the dialog's check and this write. */
  | { ok: false; clash: Clash };

export type LessonBlock = {
  /** The grid this lesson is written into — see `ensureActiveVersion`. */
  versionId: string;
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
): Promise<SaveLessonResult> {
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

    /*
      ── The clash rules are checked here, where the write happens ─────────────
      Rule 1 is a property of one row's key and the unique index enforces it.
      Rules 2 and 3 — a teacher in two rooms, a room hosting two classes — span
      rows no constraint can see, and they used to be checked only in the action
      *before* this transaction opened. Two people building the grid in
      September, which is exactly when two people build the grid, could both
      pass the check and both write: nothing refused the second, and nothing
      afterwards noticed. The grid simply had a teacher in two rooms.

      So the authoritative check is inside the transaction, reading through
      `tx`. The action still checks first — it is what produces a message naming
      the class and the period — and this is what makes the answer true.
    */
    for (const timeSlotId of block.timeSlotIds) {
      const clash = await findClash(
        {
          versionId: block.versionId,
          timeSlotId,
          schoolClassId: block.schoolClassId,
          teacherId: block.teacherId,
          roomId: block.roomId,
          classGroupId: block.classGroupId,
          termId: block.termId,
          weekParity: block.weekParity,
          fromWeek: block.fromWeek,
          toWeek: block.toWeek,
          // The rows being replaced are gone above, but a repeat across days
          // still has to be allowed to land on its own previous self.
          exceptEntryIds: replaceEntryIds,
        },
        tx,
      );
      if (clash) return { ok: false, clash } as const;
    }

    for (const timeSlotId of block.timeSlotIds) {
      // Upsert on the booking key rather than create: a repeat across days may
      // land on a slot this class already fills with the very lesson being
      // edited, and re-placing it should move it rather than refuse.
      await tx.timetableEntry.upsert({
        where: {
          versionId_schoolClassId_timeSlotId_bookingKey: {
            versionId: block.versionId,
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
          versionId: block.versionId,
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

    return { ok: true, written: block.timeSlotIds.length } as const;
  });
}

export type EntryDetailInput = {
  subjectId: string;
  startTime: string;
  endTime: string;
};

/**
 * Replaces the lines of detail under one lesson — "Grammaire 08:00–08:30".
 *
 * Whole set at a time, for the reason `setTeacherAvailability` replaces its own:
 * the dialog shows the full list and its answer is the full list, so the last
 * save wins and a stale tab cannot quietly bring back a line somebody removed.
 *
 * The lesson itself is never touched, and no clash rule runs: a detail says what
 * is taught in the session, it does not reserve anybody. The one thing checked is
 * that a line sits inside the session its lesson runs over, and that no subject
 * is listed twice at the same minute.
 */
export async function saveEntryDetails(
  entryId: string,
  details: EntryDetailInput[],
): Promise<{ ok: true; written: number } | { ok: false }> {
  // The whole session, not the one period clicked: a double period is one cell
  // on screen, so a line under it may run across the hour boundary. Resolved
  // from the database, which is also what stops the request naming rows that
  // are not this lesson's.
  const run = await entriesInBlock(entryId);
  if (run.length === 0) return { ok: false };

  const runStart = minutesSinceMidnight(run[0].startTime);
  const runEnd = minutesSinceMidnight(run[run.length - 1].endTime);
  const seen = new Set<string>();

  for (const detail of details) {
    const start = minutesSinceMidnight(detail.startTime);
    const end = minutesSinceMidnight(detail.endTime);
    const key = `${detail.subjectId}@${detail.startTime}`;
    if (start >= end || start < runStart || end > runEnd || seen.has(key)) {
      return { ok: false };
    }
    seen.add(key);
  }

  // Kept on the first period of the run, whatever period each line falls in:
  // one place to read them from, and one to clear. Lines written earlier under
  // the later periods are cleared with the rest.
  const headId = run[0].id;
  await db.$transaction(async (tx) => {
    await tx.timetableEntryDetail.deleteMany({
      where: { entryId: { in: run.map((entry) => entry.id) } },
    });
    if (details.length > 0) {
      await tx.timetableEntryDetail.createMany({
        data: details.map((detail) => ({ entryId: headId, ...detail })),
      });
    }
  });

  return { ok: true, written: details.length };
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
): Promise<
  { id: string; timeSlotId: string; startTime: string; endTime: string }[]
> {
  const anchor = await db.timetableEntry.findUnique({
    where: { id: entryId },
    select: {
      versionId: true,
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
      // Defensive: a stale id from another version cannot silently pull rows
      // out of an archived grid into a block being edited today.
      versionId: anchor.versionId,
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

  return run.map((entry) => ({
    id: entry.id,
    timeSlotId: entry.timeSlotId,
    startTime: entry.timeSlot.startTime,
    endTime: entry.timeSlot.endTime,
  }));
}

// ── When a teacher works ─────────────────────────────────────────────────────

/**
 * Replaces a teacher's standing horaire: the periods they do **not** work.
 *
 * ── Why the whole set is replaced ───────────────────────────────────────────
 * The screen shows the full week and the answer it collects is the full week —
 * "these are the periods M. Bennis is available". Diffing that into individual
 * adds and removes would let a stale tab silently re-open a period the office
 * closed an hour ago; replacing wholesale makes the last save win, which is what
 * the person looking at the grid expects.
 *
 * Slots are re-derived against the teacher's own school year rather than
 * trusted: an id from another year would otherwise block a period on a bell
 * schedule this teacher has nothing to do with.
 *
 * This is a *standing* arrangement and not an absence. A day off sick is a
 * `TeacherAbsence`, which leaves the grid alone and asks who is covering; this
 * says the lesson may never be placed there in the first place.
 */
export async function setTeacherAvailability(
  teacherId: string,
  schoolYearId: string,
  blockedSlotIds: string[],
  scheduleKind: string,
): Promise<{ blocked: number }> {
  const reachable = await db.timeSlot.findMany({
    where: {
      id: { in: blockedSlotIds },
      schoolYearId,
      scheduleKind,
      isBreak: false,
    },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    // Only this bell schedule's rows: a teacher's Ramadan horaire is a separate
    // negotiation and must survive editing the standard one.
    await tx.teacherUnavailability.deleteMany({
      where: {
        teacherId,
        timeSlot: { schoolYearId, scheduleKind },
      },
    });

    if (reachable.length > 0) {
      await tx.teacherUnavailability.createMany({
        data: reachable.map((slot) => ({
          teacherId,
          timeSlotId: slot.id,
        })),
      });
    }
  });

  return { blocked: reachable.length };
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
  /**
   * Longest lesson, in minutes, made by joining consecutive slots. 0 = one
   * lesson per slot, whatever its length.
   */
  blockMinutes: number;
  /** Most minutes of one subject in a single day. */
  maxMinutesPerDay: number;
  /**
   * Restrict the run to these slots — the créneaux the user ticked. Undefined
   * means every teaching slot. Intersected with the year's own slots, so an id
   * from the request can never reach another school's week.
   */
  allowedSlotIds?: string[];
  /** Subjects to leave out of this run. They are not reported as skipped. */
  skipSubjectIds?: string[];
  /** A subject → the only slots it may use. Others are unrestricted. */
  subjectSlots?: Record<string, string[]>;
  /**
   * Subjects fixed to particular créneaux. Honoured only when the run covers
   * one class: the same pin on every class would send them all, and their
   * teacher, into the same slot.
   */
  pins?: { subjectId: string; timeSlotIds: string[] }[];
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
  placedMinutes: number;
  requestedMinutes: number;
  /** Minutes placed beyond the programme because the slots do not divide it. */
  overshootMinutes: number;
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
              username: true,
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
    placedMinutes: 0,
    requestedMinutes: 0,
    overshootMinutes: 0,
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

  // Each slot carries its own length: the week is not made of identical periods.
  const weekSlots: GeneratorSlot[] = slotRows
    .filter((slot) => teachingDays.has(slot.dayOfWeek))
    .map((slot) => ({
      ...slot,
      minutes: Math.max(
        0,
        minutesSinceMidnight(slot.endTime) - minutesSinceMidnight(slot.startTime),
      ),
    }));
  const slotMinutes = new Map(weekSlots.map((slot) => [slot.id, slot.minutes] as const));

  // The user's ticked créneaux, intersected with the year's own — see
  // `GeneratorOptions.allowedSlotIds`.
  const allowed = options.allowedSlotIds ? new Set(options.allowedSlotIds) : null;
  const slots = allowed
    ? weekSlots.filter((slot) => allowed.has(slot.id))
    : weekSlots;
  if (slots.length === 0) return { ...empty, classes: labelled(classes) };

  /**
   * The week's own ceiling: no class or teacher can be given more minutes of
   * lessons than there are teachable minutes to hold them in. Taken from the
   * whole week, not the ticked créneaux — lessons already on the grid outside
   * them still count against it. Used as both the class cap and the fallback
   * teacher cap below, in place of a school-wide setting that could drift out
   * of step with the bell schedule it was meant to describe.
   */
  const weekCapacityMinutes = weekSlots.reduce((sum, slot) => sum + slot.minutes, 0);

  const levelIds = [
    ...new Set(classes.map((entry) => entry.levelOffering.levelId)),
  ];
  const programme = await db.levelSubject.findMany({
    // The year being drawn, never the whole history of the niveau: the volumes
    // horaires this run places are the ones this year declared.
    where: { schoolYearId, levelId: { in: levelIds }, subject: { isActive: true } },
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
  // these maps — they are about to be superseded rather than carried forward
  // into the new version, and counting them would have the generator refusing
  // to reuse the slots it is emptying.
  //
  // Read against the *active* version only — the table also holds every
  // superseded grid this scope has ever had, and drawing the four rules
  // against a version nobody is looking at would refuse slots that are, as
  // far as any live screen is concerned, free.
  const targetIds = new Set(classes.map((entry) => entry.id));
  const activeId = await activeVersionId(schoolYearId, options.scheduleKind);
  const existing = activeId
    ? await db.timetableEntry.findMany({
        where: { versionId: activeId },
        select: {
          schoolClassId: true,
          timeSlotId: true,
          teacherId: true,
          roomId: true,
          subjectId: true,
        },
      })
    : [];

  const busyTeacher: Record<string, string[]> = {};
  const busyRoom: Record<string, string[]> = {};
  const busyClass: Record<string, string[]> = {};
  // Minutes already carried, so a run that leaves other grids standing counts
  // them against the caps rather than pretending everyone starts at zero.
  const teacherLoad: Record<string, number> = {};
  const classLoad: Record<string, number> = {};
  /** `classId:subjectId` → minutes the class already has. */
  const alreadyPlaced = new Map<string, number>();

  for (const entry of existing) {
    const isTarget = targetIds.has(entry.schoolClassId);
    if (isTarget && options.replaceExisting) continue;

    const length = slotMinutes.get(entry.timeSlotId) ?? 0;
    if (entry.teacherId) {
      (busyTeacher[entry.teacherId] ??= []).push(entry.timeSlotId);
      teacherLoad[entry.teacherId] = (teacherLoad[entry.teacherId] ?? 0) + length;
    }
    if (entry.roomId) (busyRoom[entry.roomId] ??= []).push(entry.timeSlotId);
    (busyClass[entry.schoolClassId] ??= []).push(entry.timeSlotId);
    classLoad[entry.schoolClassId] = (classLoad[entry.schoolClassId] ?? 0) + length;

    if (isTarget) {
      const key = `${entry.schoolClassId}:${entry.subjectId}`;
      alreadyPlaced.set(key, (alreadyPlaced.get(key) ?? 0) + length);
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
    Who could take each subject, at which niveau, when the school has not said.

    Two sources, and the second is what makes this work on day one. An explicit
    `TeacherSubject` row is the school's declaration for *this year* and always
    wins. Where a subject has none, the pool is inferred from who already
    teaches it in the same cycle: a teacher taking 4AP maths can take 5AP
    maths, and a school with a year of assignments behind it should not have to
    retype all of them into a new table before the generator is of any use.

    Inference never overrides a declaration. The moment a school declares even
    one qualified teacher for a subject, that list is the list — otherwise
    declaring a specialist would silently *widen* the pool rather than narrow
    it. The same holds level by level: a declaration naming only 2AP means the
    school has said nothing about who takes the subject at 2BAC, and the honest
    answer there is nobody rather than whoever the assignments happen to imply.

    Both are read against the year. A staff list is redrawn every September, and
    reading last year's would staff this year's grid with people who have left.
  */
  const [declared, inferred, levelCycles, rooms, staffCaps, sizes] = await Promise.all([
    db.teacherSubject.findMany({
      where: {
        schoolId,
        schoolYearId,
        isActive: true,
        // A teacher of this school, and not merely an active account with a
        // declaration on file — see `teacherOfSchool`. Somebody whose job has
        // changed since September keeps their qualification rows, and the grid
        // is drawn from those rows: without this the surveillant général went on
        // being handed lessons by every generated timetable.
        teacher: teacherOfSchool(schoolId),
      },
      orderBy: [{ preferenceRank: "asc" }],
      select: {
        subjectId: true,
        teacherId: true,
        educationLevelId: true,
        levels: { select: { levelId: true } },
      },
    }),
    // Scoped through the offering, which is what carries the year — a class
    // belongs to a year only by way of the niveau it was opened under.
    db.teachingAssignment.findMany({
      where: {
        schoolClass: { schoolId, levelOffering: { schoolYearId } },
        /*
          The same test as the declarations above, and it is the one that was
          actually letting the manager in.

          Inference reads *last* year's decisions forward: anybody already on an
          assignment counts as qualified for that subject at that cycle. So a
          non-teacher who was put on a class once — before the pickers were
          narrowed, or by a hand-written assignment — was re-proposed by every
          generated grid afterwards, for ever, without any declaration existing
          anywhere. The rows stay in the ledger of who taught what; they just no
          longer nominate somebody the school would not offer today.
        */
        teacher: teacherOfSchool(schoolId),
      },
      select: {
        subjectId: true,
        teacherId: true,
        schoolClass: { select: { levelOffering: { select: { levelId: true } } } },
      },
    }),
    // Which cycle each niveau sits in, so a row scoped to "le collège" can be
    // resolved to the niveaux a class is actually at.
    db.level.findMany({
      where: { schoolId },
      select: { id: true, educationLevelId: true },
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

  const cycleOfLevel = new Map(
    levelCycles.map((level) => [level.id, level.educationLevelId] as const),
  );

  /**
   * Every declaration for a subject, in preference order, with where it applies.
   *
   * Kept as a list rather than flattened per niveau: the same teacher may cover
   * a subject at three niveaux, and duplicating them would have the placer
   * count one person as three candidates. Resolving the scope is
   * `qualifiedTeachers`, which is where the rule is written down.
   */
  const declaredBySubject = new Map<string, Qualification[]>();
  for (const row of declared) {
    declaredBySubject.set(row.subjectId, [
      ...(declaredBySubject.get(row.subjectId) ?? []),
      {
        teacherId: row.teacherId,
        educationLevelId: row.educationLevelId,
        levelIds: row.levels.map((level) => level.levelId),
      },
    ]);
  }

  // Inference, keyed by subject *and cycle*. School-wide would put the
  // primaire's maths teacher in front of a 2BAC class, which is the one thing
  // the level scope above exists to prevent — and letting the fallback do it
  // would undo the rule for every subject nobody has got round to declaring.
  const inferredBySubjectCycle = new Map<string, Set<string>>();
  for (const row of inferred) {
    const cycleId = cycleOfLevel.get(row.schoolClass.levelOffering.levelId);
    if (!cycleId) continue;
    const key = `${row.subjectId}:${cycleId}`;
    const held = inferredBySubjectCycle.get(key) ?? new Set<string>();
    held.add(row.teacherId);
    inferredBySubjectCycle.set(key, held);
  }

  /** Who may take this subject at this niveau, best first. */
  const qualifiedFor = (subjectId: string, levelId: string): string[] => {
    const rows = declaredBySubject.get(subjectId);
    // Declared *for the subject* is what closes the door, not declared for the
    // subject here: a school that has named a 2AP maths teacher and nobody for
    // 2BAC has said something about 2BAC, and it is "nobody yet".
    if (rows) return qualifiedTeachers(rows, levelId, levelCycles);

    const cycleId = cycleOfLevel.get(levelId);
    return cycleId
      ? [...(inferredBySubjectCycle.get(`${subjectId}:${cycleId}`) ?? [])]
      : [];
  };

  const classSizes = new Map(
    sizes.map((row) => [row.schoolClassId as string, row._count] as const),
  );

  // Every teacher's ceiling: their contract's, or — with no contract on
  // file — the week's own (see `weekCapacityMinutes`).
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
      cappedByContract.get(teacherId) ?? weekCapacityMinutes;
  }

  const skippedByUser = new Set(options.skipSubjectIds ?? []);

  // Only slots this run may use, so a pin can never reach outside the week the
  // draft is laid on — and only for a single class, see `GeneratorOptions.pins`.
  const runSlotIds = new Set(slots.map((slot) => slot.id));
  const pinnedSlots = new Map<string, string[]>();
  if (classes.length === 1) {
    for (const pin of options.pins ?? []) {
      const ids = pin.timeSlotIds.filter((id) => runSlotIds.has(id));
      if (ids.length > 0) pinnedSlots.set(pin.subjectId, ids);
    }
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

      // Left out by the user for this run: not placed, and not "skipped" in the
      // sense of a programme gap either — they asked for it.
      if (skippedByUser.has(subject.id)) continue;

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
        : qualifiedFor(subject.id, levelId);

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

      const wanted = minutesToCover(weeklyMinutes);
      // What the class already has of this subject counts towards the
      // programme, so a top-up run adds the missing hours instead of a second
      // full week of them.
      const have = alreadyPlaced.get(`${schoolClass.id}:${subject.id}`) ?? 0;
      const outstanding = wanted - have;
      // Within the slack counts as done, the same test the placer stops on.
      if (outstanding <= 0 || (have > 0 && outstanding <= SLACK_MINUTES)) continue;

      const base = {
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        classGroupId: assignment?.classGroupId ?? null,
        candidateTeachers,
        teacherWasAssigned: Boolean(assignment),
        homeRoomId: schoolClass.roomId,
        requiresLab: subject.requiresLab,
        classSize: classSizes.get(schoolClass.id) ?? 0,
      };

      // The fixed créneaux first, as a demand of their own that names its
      // slots; what is left of the programme is drawn as usual around it.
      const pinnedIds = pinnedSlots.get(subject.id) ?? [];
      const pinnedMinutes = pinnedIds.reduce(
        (sum, id) => sum + (slotMinutes.get(id) ?? 0),
        0,
      );
      if (pinnedIds.length > 0 && pinnedMinutes > 0) {
        demands.push({
          ...base,
          minutes: pinnedMinutes,
          // Adjacent pinned slots become one lesson, whatever the dialog's
          // lesson length says: the user fixed those créneaux, not a length.
          blockMinutes: MAX_BLOCK_MINUTES,
          maxMinutesPerDay: 24 * 60,
          allowedSlotIds: pinnedIds,
          pinned: true,
        });
      }

      const remaining = outstanding - pinnedMinutes;
      if (remaining <= 0 || (pinnedMinutes > 0 && remaining <= SLACK_MINUTES)) continue;

      demands.push({
        ...base,
        minutes: remaining,
        blockMinutes: Math.max(0, options.blockMinutes),
        maxMinutesPerDay: Math.max(SLACK_MINUTES, options.maxMinutesPerDay),
        allowedSlotIds: options.subjectSlots?.[subject.id] ?? null,
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
    (sum, demand) => sum + demand.minutes,
    0,
  );
  const inPlay = new Set(demands.flatMap((demand) => demand.candidateTeachers));
  const availableMinutes = [...inPlay].reduce(
    (sum, teacherId) =>
      sum +
      Math.max(
        0,
        (teacherCapacity[teacherId] ?? weekCapacityMinutes) -
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
    teacherCapacity,
    teacherLoad,
    classCapacity: weekCapacityMinutes,
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
          : assignment.teacher.username,
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
        username: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    for (const user of picked) {
      teacherNames.set(
        user.id,
        user.profile
          ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
          : user.username,
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
    placedMinutes: result.placedMinutes,
    requestedMinutes: result.requestedMinutes,
    overshootMinutes: result.overshootMinutes,
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

/**
 * `TimetableVersion.label` for a generation run — bounded to the column's
 * `VARCHAR(200)`, since a whole-school run can touch far more classes than
 * fit in one readable line. Falls back to a count once naming them all would
 * overflow, rather than truncating mid-code into something unreadable.
 */
function versionLabelFor(classCodes: string[]): string {
  if (classCodes.length === 0) return "Generated";
  const joined = `Generated: ${classCodes.join(", ")}`;
  if (joined.length <= 200) return joined;
  return `Generated: ${classCodes.length} classes`;
}

/**
 * Writes a generated grid as a brand new `TimetableVersion`.
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
 *
 * ── Non-destructive by construction ─────────────────────────────────────────
 * Nothing is ever deleted here. Every class not touched by this run, and every
 * touched class's lessons the generator chose to leave alone (gap-fill mode,
 * `replaceExisting: false`), is copied forward from the scope's current active
 * version into the new one unchanged. The old version is archived, not
 * dropped — its rows stay exactly as they were, which is what makes reverting
 * to it later a flip of `activeKey` rather than a reconstruction. See
 * `TimetableVersion` and `activateTimetableVersion`.
 */

/**
 * Longer than Prisma's 5s default, because a whole-school apply is one
 * transaction holding roughly six hundred lessons — and now also copies
 * forward whatever untouched classes already had. Five seconds is a limit set
 * for a handful of writes; this is deliberately several hundred, and it must
 * not half-write a school's week.
 */
const APPLY_TIMEOUT = { timeout: 60_000, maxWait: 10_000 } as const;

/** Lessons per INSERT when a version's rows are written wholesale. */
const CREATE_CHUNK = 500;

export async function applyTimetableDraft(
  schoolId: string,
  schoolYearId: string,
  options: GeneratorOptions,
  /** Who generated this version — see `TimetableVersion.createdById`. */
  actorId: string | null,
): Promise<{
  written: number;
  cleared: number;
  assigned: number;
  draft: TimetableDraft;
  versionId: string;
}> {
  const result = await writeTimetableDraft(
    schoolId,
    schoolYearId,
    options,
    actorId,
  );

  /*
    One entry for one act, because the transaction below runs unaudited.

    Drawing a week is a single decision that happens to touch several hundred
    rows, and what a reader of the trail wants is the decision and its counts —
    not six hundred lines saying `CREATE TimetableEntry`, which is what they
    would have to read past to find anything else that happened that morning.
    Written after the commit: an entry about a grid that rolled back would
    describe rows that do not exist.
  */
  if (result.written > 0 || result.cleared > 0) {
    await recordEvent({
      action: "UPDATE",
      entity: "TimetableEntry",
      metadata: {
        generator: true,
        scheduleKind: options.scheduleKind,
        seed: options.seed,
        classes: result.draft.classes.length,
        written: result.written,
        cleared: result.cleared,
        assigned: result.assigned,
        versionId: result.versionId,
      },
    });
  }

  return result;
}

async function writeTimetableDraft(
  schoolId: string,
  schoolYearId: string,
  options: GeneratorOptions,
  actorId: string | null,
): Promise<{
  written: number;
  cleared: number;
  assigned: number;
  draft: TimetableDraft;
  versionId: string;
}> {
  const draft = await buildTimetableDraft(schoolId, schoolYearId, options);
  const classIds = draft.classes.map((entry) => entry.id);

  if (classIds.length === 0) {
    // Nothing to draw, so no new version is worth creating — the scope's
    // current one (if any) is left exactly as it was.
    const current = await activeVersionId(schoolYearId, options.scheduleKind);
    return { written: 0, cleared: 0, assigned: 0, draft, versionId: current ?? "" };
  }

  /*
    Deliberately the client *without* the audit extension — see `auditClient`,
    and `applySetup`, which takes the same door for the same reason.

    Through the extended one every lesson costs three round trips rather than
    one: a "before" read of the row it replaces, the write, and an
    `activity_logs` insert that commits on its own connection. That is right for
    a secretary saving one cell and wrong here, where a whole-school week is
    several hundred rows in a single interactive transaction and the trail's
    share of it is most of the wait.
  */
  return auditClient.$transaction(async (transaction) => {
    /*
      `TxClient` is the *extended* client's transaction type. The extension
      wraps behaviour around the delegates rather than changing their shape, so
      the two are the same object at runtime and this bridges the declaration —
      exactly as `writeSetup` does.
    */
    const tx = transaction as unknown as TxClient;

    const activeKey = activeVersionKeyOf(schoolYearId, options.scheduleKind);
    const previousVersion = await tx.timetableVersion.findUnique({
      where: { activeKey },
    });

    const newVersion = await tx.timetableVersion.create({
      data: {
        schoolYearId,
        scheduleKind: options.scheduleKind,
        status: "ACTIVE",
        // Not yet the active one — see below. Two rows cannot hold the same
        // `activeKey` at once, so the old one has to give it up first.
        activeKey: null,
        label: versionLabelFor(draft.classes.map((entry) => entry.code)),
        seed: options.seed,
        createdById: actorId,
      },
    });

    if (previousVersion) {
      await tx.timetableVersion.update({
        where: { id: previousVersion.id },
        data: { status: "ARCHIVED", activeKey: null },
      });
    }
    await tx.timetableVersion.update({
      where: { id: newVersion.id },
      data: { activeKey },
    });

    /*
      The affectations, written before the lessons that depend on them.

      This is the half of the job the grid alone cannot do. A generated week
      that named a teacher in its cells but left `TeachingAssignment` empty
      would look right and be wrong: the class file would still say nobody
      teaches 4AP maths, the next generation would re-decide it from scratch,
      and a head of studies looking for "who has this class" would find nothing.
      Durable and non-versioned on purpose — see the note on TimetableVersion:
      a staffing decision survives even if the grid that prompted it is later
      abandoned by a revert.

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

    /*
      Copy forward what this run did not touch, so nothing is lost by drawing
      a new version — see the note above the exported function.

        * every class outside this run entirely, and
        * for a touched class in gap-fill mode (`replaceExisting: false`), the
          periods the generator left alone because they already held a lesson.

      Both read from `previousVersion` alone: there is nothing to carry forward
      the first time a scope is ever generated.
    */
    let cleared = 0;
    if (previousVersion) {
      let toCarry: {
        schoolClassId: string;
        classGroupId: string | null;
        timeSlotId: string;
        subjectId: string;
        teacherId: string | null;
        roomId: string | null;
        termId: string | null;
        weekParity: string;
        fromWeek: number | null;
        toWeek: number | null;
        bookingKey: string;
      }[];

      if (options.replaceExisting) {
        // Full replace: a touched class's previous lessons are all superseded
        // — reported as `cleared`, the sentence a user reads, even though
        // nothing is actually deleted. Only classes outside this run carry
        // their rows forward unchanged.
        const [supersededCount, untouched] = await Promise.all([
          tx.timetableEntry.count({
            where: { versionId: previousVersion.id, schoolClassId: { in: classIds } },
          }),
          tx.timetableEntry.findMany({
            where: { versionId: previousVersion.id, schoolClassId: { notIn: classIds } },
            select: {
              schoolClassId: true,
              classGroupId: true,
              timeSlotId: true,
              subjectId: true,
              teacherId: true,
              roomId: true,
              termId: true,
              weekParity: true,
              fromWeek: true,
              toWeek: true,
              bookingKey: true,
            },
          }),
        ]);
        cleared = supersededCount;
        toCarry = untouched;
      } else {
        // Gap-fill: every class keeps whatever the generator did not just
        // place — touched or not, since a touched class's un-placed periods
        // are exactly as untouched as any class this run never looked at.
        const placedSlotsByClass = new Map<string, Set<string>>();
        for (const placement of draft.placements) {
          const slots =
            placedSlotsByClass.get(placement.schoolClassId) ?? new Set<string>();
          for (const timeSlotId of placement.timeSlotIds) slots.add(timeSlotId);
          placedSlotsByClass.set(placement.schoolClassId, slots);
        }

        const candidates = await tx.timetableEntry.findMany({
          where: { versionId: previousVersion.id },
          select: {
            schoolClassId: true,
            classGroupId: true,
            timeSlotId: true,
            subjectId: true,
            teacherId: true,
            roomId: true,
            termId: true,
            weekParity: true,
            fromWeek: true,
            toWeek: true,
            bookingKey: true,
          },
        });
        toCarry = candidates.filter(
          (entry) =>
            !placedSlotsByClass.get(entry.schoolClassId)?.has(entry.timeSlotId),
        );
        cleared = candidates.length - toCarry.length;
      }

      for (let from = 0; from < toCarry.length; from += CREATE_CHUNK) {
        await tx.timetableEntry.createMany({
          data: toCarry
            .slice(from, from + CREATE_CHUNK)
            .map((entry) => ({ ...entry, versionId: newVersion.id })),
        });
      }
    }

    // Every lesson the draft placed, as rows. A block of two periods is two of
    // them — see the note at the top of this file on why a lesson is several
    // rows — and all of them are all-year templates, as the doc comment above
    // says. Always fresh inserts into the new version: nothing in it yet can
    // collide with a placement.
    const rows = draft.placements.flatMap((placement) => {
      const bookingKey = bookingKeyOf(
        placement.classGroupId,
        null,
        "ALL",
        null,
        null,
      );

      return placement.timeSlotIds.map((timeSlotId) => ({
        versionId: newVersion.id,
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
      }));
    });

    let written = 0;
    for (let from = 0; from < rows.length; from += CREATE_CHUNK) {
      const made = await tx.timetableEntry.createMany({
        data: rows.slice(from, from + CREATE_CHUNK),
      });
      written += made.count;
    }

    return { written, cleared, assigned, draft, versionId: newVersion.id };
  }, APPLY_TIMEOUT);
}

/**
 * The version history for one bell schedule of one year, newest first — what
 * the "switch version" panel lists.
 */
export async function listTimetableVersions(
  schoolYearId: string,
  scheduleKind: string,
): Promise<
  {
    id: string;
    status: string;
    label: string | null;
    seed: number | null;
    createdAt: Date;
    createdByName: string | null;
    entryCount: number;
  }[]
> {
  const versions = await db.timetableVersion.findMany({
    where: { schoolYearId, scheduleKind },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      label: true,
      seed: true,
      createdAt: true,
      createdBy: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      _count: { select: { entries: true } },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    status: version.status,
    label: version.label,
    seed: version.seed,
    createdAt: version.createdAt,
    createdByName: version.createdBy
      ? version.createdBy.profile
        ? `${version.createdBy.profile.firstName} ${version.createdBy.profile.lastName}`.trim()
        : version.createdBy.username
      : null,
    entryCount: version._count.entries,
  }));
}

/**
 * Makes `versionId` the grid every ordinary screen shows for its scope,
 * archiving whichever version held that title before.
 *
 * One atomic flip, not a rebuild: both versions' rows already exist exactly as
 * they were left, so switching is instant regardless of how large the grid is.
 * Order matters — `activeKey` is unique, so the current holder has to give it
 * up before the target can take it.
 */
export async function activateTimetableVersion(
  versionId: string,
): Promise<{ ok: true } | { ok: false; message: "NOT_FOUND" | "ALREADY_ACTIVE" }> {
  return db.$transaction(async (tx) => {
    const target = await tx.timetableVersion.findUnique({
      where: { id: versionId },
    });
    if (!target) return { ok: false, message: "NOT_FOUND" } as const;
    if (target.status === "ACTIVE") {
      return { ok: false, message: "ALREADY_ACTIVE" } as const;
    }

    const current = await tx.timetableVersion.findUnique({
      where: {
        activeKey: activeVersionKeyOf(target.schoolYearId, target.scheduleKind),
      },
    });
    if (current) {
      await tx.timetableVersion.update({
        where: { id: current.id },
        data: { status: "ARCHIVED", activeKey: null },
      });
    }

    await tx.timetableVersion.update({
      where: { id: target.id },
      data: {
        status: "ACTIVE",
        activeKey: activeVersionKeyOf(target.schoolYearId, target.scheduleKind),
      },
    });

    return { ok: true } as const;
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

export type GenerateTimeSlotsInput = {
  schoolYearId: string;
  /** ISO weekdays, 1–6, to lay the same block onto. */
  days: number[];
  session: string;
  scheduleKind: string;
  /** "HH:MM" — when the first period of the block starts. */
  startTime: string;
  periodMinutes: number;
  periodCount: number;
  /** Insert a break after this many periods (1-based), or null for none. */
  breakAfterPeriod: number | null;
  breakMinutes: number;
  /**
   * Clear the ticked days' existing slots of this session first.
   *
   * Without it, re-laying Friday as 1h after it was 1h30 leaves the old
   * 09:30–11:00 slot standing across the new 09:00–10:00 one, because the upsert
   * is keyed on the start time and only corrects slots that start together.
   */
  replace?: boolean;
};

export type GenerateTimeSlotsResult = {
  written: number;
  /**
   * Lessons on the live grid that stand in the slots a replace would clear. A
   * slot's lessons go with it, so a replace over a filled grid is refused rather
   * than quietly emptying it.
   */
  blocked: number;
};

/**
 * Lays out one block of consecutive periods — and, optionally, one break in
 * the middle — on every day picked, in a single call.
 *
 * ── Why one block, not the whole day ────────────────────────────────────────
 * A school's morning and afternoon are two separate decisions with two
 * different start times, so a form asking for both at once would have most of
 * its fields not apply to whichever half it was really describing. "Define the
 * morning, tick every weekday, then do the same for the afternoon" is what
 * this looks like at the desk — two calls, not one shape trying to be two
 * things.
 *
 * ── Why it is safe to run more than once ────────────────────────────────────
 * Upserted on the table's own key (see `TimeSlot`'s `@@unique`), so running it
 * again with the same start times corrects those periods in place instead of
 * laying a second set on top. `position` picks up after whatever a day
 * already has — read fresh per day, not carried from the request — so calling
 * this for the afternoon after the morning continues the day's numbering, and
 * patching one day later does not renumber a session that was already right.
 */
export async function generateTimeSlots(
  input: GenerateTimeSlotsInput,
): Promise<GenerateTimeSlotsResult> {
  if (input.replace) {
    const standing = await db.timeSlot.findMany({
      where: {
        schoolYearId: input.schoolYearId,
        scheduleKind: input.scheduleKind,
        session: input.session,
        dayOfWeek: { in: input.days },
      },
      select: { id: true },
    });
    const ids = standing.map((slot) => slot.id);

    if (ids.length > 0) {
      // Only the live grid blocks it. Superseded versions are snapshots of a
      // bell that is being replaced on purpose; their rows in these slots go
      // with them, and no screen can draw them against slots that are gone.
      const inUse = await db.timetableEntry.count({
        where: { timeSlotId: { in: ids }, version: { status: "ACTIVE" } },
      });
      if (inUse > 0) return { written: 0, blocked: inUse };

      await db.timeSlot.deleteMany({ where: { id: { in: ids } } });
    }
  }

  // Read fresh per day, before anything is laid, so the block that follows a
  // morning continues its numbering instead of restarting at 1.
  const startPositions = new Map<number, number>();
  for (const day of input.days) {
    const last = await db.timeSlot.aggregate({
      where: {
        schoolYearId: input.schoolYearId,
        scheduleKind: input.scheduleKind,
        dayOfWeek: day,
      },
      _max: { position: true },
    });
    startPositions.set(day, (last._max.position ?? 0) + 1);
  }

  const slots = layPeriodBlock({
    days: input.days,
    session: input.session,
    scheduleKind: input.scheduleKind,
    startTime: input.startTime,
    periodMinutes: input.periodMinutes,
    periodCount: input.periodCount,
    breakAfterPeriod: input.breakAfterPeriod,
    breakMinutes: input.breakMinutes,
    startPosition: (day) => startPositions.get(day) ?? 1,
  });

  for (const slot of slots) {
    await db.timeSlot.upsert({
      where: {
        schoolYearId_scheduleKind_dayOfWeek_startTime: {
          schoolYearId: input.schoolYearId,
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
        schoolYearId: input.schoolYearId,
        dayOfWeek: slot.dayOfWeek,
        session: slot.session,
        startTime: slot.startTime,
        endTime: slot.endTime,
        scheduleKind: slot.scheduleKind,
        position: slot.position,
        isBreak: slot.isBreak ?? false,
      },
    });
  }

  return { written: slots.length, blocked: 0 };
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
