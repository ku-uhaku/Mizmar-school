"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { teacherOfSchool } from "@/lib/scope";
import {
  boolField,
  field,
  listField,
  withActionErrors,
} from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { isTeachingDayIn } from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import {
  activateTimetableVersion,
  applyTimetableDraft,
  buildTimetableDraft,
  closeEntriesFromWeek,
  ensureActiveVersion,
  entriesInBlock,
  findClash,
  generateSchoolWeeks,
  generateTimeSlots,
  listTimetableVersions,
  saveEntryDetails,
  saveLessonBlock,
  type Clash,
  setTeacherAvailability,
  type GeneratorRequest,
  type PreviewResult,
} from "@/modules/timetable/service";
import {
  entryDetailsSchema,
  generateTimeSlotsSchema,
  timetableEntrySchema,
  timetableExceptionSchema,
} from "@/modules/timetable/validation";
import {
  bookingKeyOf,
  isTimeOfDay,
  MAX_ENTRY_DETAILS,
  MAX_BLOCK_MINUTES,
  TEACHING_DAYS,
} from "@/modules/timetable/enums";
import { schoolWeeks, startOfWeek } from "@/modules/timetable/weeks";

/**
 * Actions for the timetable module.
 *
 * Every id in the request is re-derived against the class's own school and year
 * before anything is written: the slot must belong to the class's year, the
 * subject and room to its school, the group to the class itself. A grid is the
 * easiest screen in the app to point at the wrong row, so nothing here trusts
 * what it is sent — including the list of slots a lesson claims to occupy,
 * which is computed from the anchor rather than accepted.
 */

const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

/** A period of the bell schedule, as it recurs across the week. */
type Period = { startTime: string; endTime: string };

export async function saveTimetableEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const parsed = timetableEntrySchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      timeSlotId: field(formData, "timeSlotId"),
      subjectId: field(formData, "subjectId"),
      teacherId: optionalId(formData, "teacherId"),
      roomId: optionalId(formData, "roomId"),
      classGroupId: optionalId(formData, "classGroupId"),
      termId: optionalId(formData, "termId"),
      weekParity: field(formData, "weekParity") || "ALL",
      spanSlots: field(formData, "spanSlots") || "1",
      /** The week the grid was showing. Blank when the template is edited. */
      weekNumber: field(formData, "weekNumber"),
      /** Unticked means "this week only". */
      applyToFollowing: boolField(formData, "applyToFollowing"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const entryId = field(formData, "id");

    // The class decides the school and the year; everything else is checked
    // against those rather than against the working context, so an entry can
    // never be written into a class the actor cannot reach.
    const schoolClass = await db.schoolClass.findUnique({
      where: { id: parsed.data.schoolClassId },
      select: {
        id: true,
        schoolId: true,
        levelOffering: { select: { schoolYearId: true } },
      },
    });
    if (!schoolClass) return failure(t.errors.notFound);

    await authorizeSchool(schoolClass.schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    const schoolYearId = schoolClass.levelOffering.schoolYearId;

    const anchor = await db.timeSlot.findFirst({
      where: { id: parsed.data.timeSlotId, schoolYearId },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isBreak: true,
        scheduleKind: true,
      },
    });
    if (!anchor) return failure(t.timetable.slotUnavailable);
    if (anchor.isBreak) return failure(t.timetable.slotIsBreak);

    const [subject, room, group, term] = await Promise.all([
      db.subject.findFirst({
        where: { id: parsed.data.subjectId, schoolId: schoolClass.schoolId },
        select: { id: true },
      }),
      parsed.data.roomId
        ? db.room.findFirst({
            where: { id: parsed.data.roomId, schoolId: schoolClass.schoolId },
            select: { id: true },
          })
        : null,
      parsed.data.classGroupId
        ? db.classGroup.findFirst({
            where: {
              id: parsed.data.classGroupId,
              schoolClassId: schoolClass.id,
            },
            select: { id: true },
          })
        : null,
      parsed.data.termId
        ? db.term.findFirst({
            where: { id: parsed.data.termId, schoolYearId },
            select: { id: true },
          })
        : null,
    ]);

    if (!subject) return failure(t.errors.notFound);

    // A teacher of the class's own school — see `teacherOfSchool`. The same
    // test the picker offers from, so the slot cannot be saved with somebody the
    // select would not have shown.
    const teacher = parsed.data.teacherId
      ? await db.user.findFirst({
          where: {
            id: parsed.data.teacherId,
            ...teacherOfSchool(schoolClass.schoolId),
          },
          select: { id: true },
        })
      : null;

    // The days this lesson runs on. The anchor's own day is always included —
    // a form that could place a lesson on no day at all is a form that loses
    // work silently.
    // Read for this class's school rather than the one selected in the header:
    // an org administrator may be editing a timetable while working elsewhere.
    const settings = await loadSchoolSettings(schoolClass.schoolId);
    const requestedDays = listField(formData, "days")
      .map(Number)
      .filter((day) => Number.isInteger(day) && isTeachingDayIn(day, settings));
    const days = [...new Set([anchor.dayOfWeek, ...requestedDays])].sort();

    // Which slots the block occupies, worked out from the bell schedule rather
    // than taken from the request. A span that runs past the end of the day, or
    // into a break, simply stops there.
    const slots = await db.timeSlot.findMany({
      where: {
        schoolYearId,
        scheduleKind: anchor.scheduleKind,
        isActive: true,
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isBreak: true,
      },
    });

    const periods = orderedPeriods(slots);
    const anchorIndex = periods.findIndex(
      (period) =>
        period.startTime === anchor.startTime &&
        period.endTime === anchor.endTime,
    );
    if (anchorIndex === -1) return failure(t.timetable.slotUnavailable);

    const timeSlotIds: string[] = [];
    for (const day of days) {
      for (let step = 0; step < parsed.data.spanSlots; step += 1) {
        const period = periods[anchorIndex + step];
        if (!period) break;

        const slot = slots.find(
          (candidate) =>
            candidate.dayOfWeek === day &&
            candidate.startTime === period.startTime &&
            candidate.endTime === period.endTime,
        );
        // The day does not run this period, or it is a break there — stop
        // extending on this day rather than jumping the gap.
        if (!slot || slot.isBreak) break;

        timeSlotIds.push(slot.id);
      }
    }

    if (timeSlotIds.length === 0) return failure(t.timetable.slotUnavailable);

    // Created on first use, when a bell schedule is being hand-built and has
    // never been generated — see `ensureActiveVersion`.
    const versionId = await ensureActiveVersion(schoolYearId, anchor.scheduleKind);

    /*
      The week the edit is being made from, and the window the new rows carry.

      A lesson added while looking at week 12 starts at week 12 — it is not
      retroactively true of September, and a grid that claimed it was would
      make every register before it wrong. Ticking "the following weeks" leaves
      the end open; leaving it unticked writes the one week only, which is how
      a one-off swap is recorded without touching the pattern.
    */
    const weekNumber =
      parsed.data.weekNumber === null ? null : Number(parsed.data.weekNumber);
    const fromWeek =
      weekNumber !== null && Number.isFinite(weekNumber) && weekNumber > 1
        ? weekNumber
        : null;
    const toWeek = parsed.data.applyToFollowing
      ? null
      : (fromWeek ?? weekNumber ?? null);

    // The rows this block already occupies, so growing, shrinking or moving it
    // replaces them instead of leaving orphans behind.
    const existing = entryId ? await entriesInBlock(entryId) : [];
    const replaceIds = existing
      .filter((entry) => !timeSlotIds.includes(entry.timeSlotId))
      .map((entry) => entry.id);
    const keepIds = existing.map((entry) => entry.id);

    /** The sentence a grid-builder can act on, for a clash from either check. */
    const clashMessage = (clash: Clash) =>
      interpolate(
        clash.kind === "TEACHER"
          ? t.timetable.teacherClash
          : clash.kind === "ROOM"
            ? t.timetable.roomClash
            : clash.kind === "UNAVAILABLE"
              ? t.timetable.teacherUnavailable
              : t.timetable.classClash,
        { class: clash.className, slot: clash.slotLabel },
      );

    // Checked here so the refusal can name the class and the period before
    // anything is touched. `saveLessonBlock` checks again inside the
    // transaction it writes in, which is what makes the answer true under two
    // people editing the grid at once.
    for (const timeSlotId of timeSlotIds) {
      const clash = await findClash({
        versionId,
        timeSlotId,
        schoolClassId: schoolClass.id,
        teacherId: teacher?.id ?? null,
        roomId: room?.id ?? null,
        classGroupId: group?.id ?? null,
        termId: term?.id ?? null,
        weekParity: parsed.data.weekParity,
        fromWeek,
        toWeek,
        exceptEntryIds: keepIds,
      });

      if (clash) return failure(clashMessage(clash));
    }

    /*
      Editing an existing lesson from a later week *splits* it rather than
      overwriting: the old rows are closed at the week before, and the new
      window starts here. `closeEntriesFromWeek` deletes instead when the row
      has no past to keep — one that only ever ran from week 12 onwards.

      The rows are closed before the new ones are written so the two windows
      never overlap, which is what would otherwise trip the clash check against
      the lesson's own previous self.
    */
    const kept = existing.filter((entry) => timeSlotIds.includes(entry.timeSlotId));
    let ended = 0;
    if (kept.length > 0 && fromWeek !== null) {
      const closed = await closeEntriesFromWeek(
        kept.map((entry) => entry.id),
        fromWeek,
      );
      ended = closed.ended;
    }

    const saved = await saveLessonBlock(
      {
        versionId,
        schoolClassId: schoolClass.id,
        timeSlotIds,
        subjectId: subject.id,
        teacherId: teacher?.id ?? null,
        roomId: room?.id ?? null,
        classGroupId: group?.id ?? null,
        termId: term?.id ?? null,
        weekParity: parsed.data.weekParity,
        fromWeek,
        toWeek,
      },
      replaceIds,
    );

    // Somebody else took the slot between the check above and the write. The
    // transaction rolled back, so nothing was half-written.
    if (!saved.ok) return failure(clashMessage(saved.clash));
    const written = saved.written;

    refresh();

    // Say when history was kept: "modifié à partir de la semaine 12" is a very
    // different reassurance from "modifié", and it is the thing an operator is
    // uncertain about the first few times.
    if (ended > 0 && fromWeek !== null) {
      return success(
        interpolate(t.timetable.savedFromWeek, { week: fromWeek }),
      );
    }
    return success(
      written > 1
        ? interpolate(t.timetable.savedMany, { count: written })
        : t.timetable.saved,
    );
  });
}

/** Clears a lesson — every period it occupies, not just the one clicked. */
export async function deleteTimetableEntryAction(
  entryId: string,
  /**
   * The week the grid was showing. Given, the lesson is *ended* the week before
   * rather than erased: it genuinely ran until then, and the registers already
   * marked against it have to keep making sense. Omitted, the whole lesson goes,
   * which is what removing a mistake means.
   */
  fromWeek?: number | null,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const entry = await db.timetableEntry.findUnique({
      where: { id: entryId },
      select: { id: true, schoolClass: { select: { schoolId: true } } },
    });
    if (!entry) return failure(t.errors.notFound);

    await authorizeSchool(
      entry.schoolClass.schoolId,
      PERMISSIONS.TIMETABLE_MANAGE,
    );

    // Re-derived from the database, never taken from the request — see
    // `entriesInBlock`.
    const block = await entriesInBlock(entryId);
    const ids = block.length > 0 ? block.map((row) => row.id) : [entryId];

    const result = await closeEntriesFromWeek(ids, fromWeek ?? null);

    refresh();
    return success(
      result.ended > 0 && fromWeek
        ? interpolate(t.timetable.endedAtWeek, { week: fromWeek - 1 })
        : t.timetable.cleared,
    );
  });
}

/**
 * The distinct periods of the week, in order.
 *
 * A slot row is per day, so 08:00–09:00 exists six times over; the bell
 * schedule is the set of them, and that is what a span steps through.
 */
function orderedPeriods(
  slots: { startTime: string; endTime: string }[],
): Period[] {
  const seen = new Map<string, Period>();
  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!seen.has(key)) {
      seen.set(key, { startTime: slot.startTime, endTime: slot.endTime });
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
}

/**
 * Changes one period of one week, without touching the recurring grid.
 *
 * The counterpart to `saveTimetableEntryAction`: that one edits the template
 * and so changes every week from now on, this one changes exactly the week on
 * screen. Keeping them as two actions is what makes "this week only" versus
 * "from now on" an explicit choice rather than a guess about intent — see
 * prisma/schema/timetable/timetable-exception.prisma.
 *
 * Same permission as editing the template: moving a lesson for one week is the
 * same kind of decision as moving it for good.
 */
export async function saveTimetableExceptionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const parsed = timetableExceptionSchema(t).safeParse({
      schoolClassId: field(formData, "schoolClassId"),
      timeSlotId: field(formData, "timeSlotId"),
      weekStart: field(formData, "weekStart"),
      kind: field(formData, "kind"),
      subjectId: optionalId(formData, "subjectId"),
      teacherId: optionalId(formData, "teacherId"),
      roomId: optionalId(formData, "roomId"),
      classGroupId: optionalId(formData, "classGroupId"),
      note: field(formData, "note"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // The class decides the school and the year, exactly as when editing the
    // template — the ids that follow are checked against those, never against
    // the working context alone.
    const schoolClass = await db.schoolClass.findUnique({
      where: { id: parsed.data.schoolClassId },
      select: {
        id: true,
        schoolId: true,
        levelOffering: { select: { schoolYearId: true } },
      },
    });
    if (!schoolClass) return failure(t.errors.notFound);

    await authorizeSchool(schoolClass.schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    const schoolYearId = schoolClass.levelOffering.schoolYearId;

    const slot = await db.timeSlot.findFirst({
      where: { id: parsed.data.timeSlotId, schoolYearId },
      select: { id: true, isBreak: true },
    });
    if (!slot) return failure(t.timetable.slotUnavailable);
    if (slot.isBreak) return failure(t.timetable.slotIsBreak);

    // The week must be one the year actually has. A `weekStart` from a stale
    // tab would otherwise write an override for a week nothing will ever read.
    const year = await db.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { startDate: true, endDate: true },
    });
    if (!year) return failure(t.errors.notFound);

    const weekStart = startOfWeek(
      new Date(`${parsed.data.weekStart}T00:00:00`),
    );
    const weeks = schoolWeeks(year.startDate, year.endDate);
    const known = weeks.some(
      (week) => week.start.getTime() === weekStart.getTime(),
    );
    if (!known) return failure(t.timetable.weekOutsideYear);

    // Every reference re-read against the class's own school and year.
    const [subject, teacher, room, group] = await Promise.all([
      parsed.data.subjectId
        ? db.subject.findFirst({
            where: {
              id: parsed.data.subjectId,
              schoolId: schoolClass.schoolId,
            },
            select: { id: true },
          })
        : null,
      parsed.data.teacherId
        ? db.user.findFirst({
            where: {
              id: parsed.data.teacherId,
              ...teacherOfSchool(schoolClass.schoolId),
            },
            select: { id: true },
          })
        : null,
      parsed.data.roomId
        ? db.room.findFirst({
            where: { id: parsed.data.roomId, schoolId: schoolClass.schoolId },
            select: { id: true },
          })
        : null,
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

    const classGroupId = group?.id ?? null;
    // Mirrors the nullable group so the unique index fires — see the note on
    // TimetableException.scopeKey.
    const scopeKey = bookingKeyOf(classGroupId, null);

    await db.timetableException.upsert({
      where: {
        schoolClassId_timeSlotId_weekStart_scopeKey: {
          schoolClassId: schoolClass.id,
          timeSlotId: slot.id,
          weekStart,
          scopeKey,
        },
      },
      create: {
        schoolClassId: schoolClass.id,
        timeSlotId: slot.id,
        weekStart,
        scopeKey,
        classGroupId,
        kind: parsed.data.kind,
        subjectId: subject?.id ?? null,
        teacherId: teacher?.id ?? null,
        roomId: room?.id ?? null,
        note: parsed.data.note,
        createdById: context.user.id,
      },
      update: {
        classGroupId,
        kind: parsed.data.kind,
        subjectId: subject?.id ?? null,
        teacherId: teacher?.id ?? null,
        roomId: room?.id ?? null,
        note: parsed.data.note,
      },
    });

    refresh();
    return success(t.timetable.exceptionSaved);
  });
}

/** Drops a one-off change, so the week goes back to the recurring grid. */
export async function deleteTimetableExceptionAction(
  exceptionId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const exception = await db.timetableException.findUnique({
      where: { id: exceptionId },
      select: { id: true, schoolClass: { select: { schoolId: true } } },
    });
    if (!exception) return failure(t.errors.notFound);

    await authorizeSchool(
      exception.schoolClass.schoolId,
      PERMISSIONS.TIMETABLE_MANAGE,
    );

    await db.timetableException.delete({ where: { id: exception.id } });

    refresh();
    return success(t.timetable.exceptionCleared);
  });
}

/**
 * Lays out the year's numbered weeks.
 *
 * Idempotent, so it is safe to press again after adding a holiday — the weeks
 * renumber from the same rules and any trailing week the year no longer reaches
 * is dropped. TIMETABLE_MANAGE rather than a code of its own: the weeks are the
 * spine the grid hangs on, and whoever may redraw the grid may number them.
 */
export async function generateSchoolWeeksAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    // Re-derived against the school, so a year id from another tenant reaches
    // nothing — the working context is the only thing trusted here.
    const year = await db.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId },
      select: { id: true },
    });
    if (!year) return failure(t.errors.notFound);

    const firstParity = field(formData, "firstParity") === "B" ? "B" : "A";
    const result = await generateSchoolWeeks(year.id, firstParity);

    refresh();
    return success(
      interpolate(t.timetable.weeksGenerated, { count: result.written }),
    );
  });
}

/**
 * Lays one block of periods — a morning, an afternoon — onto every day ticked,
 * in one act. TIMETABLE_MANAGE, the same code the grid itself is gated on: the
 * bell schedule is what the grid is drawn against.
 */
export async function generateTimeSlotsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    const year = await db.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId },
      select: { id: true },
    });
    if (!year) return failure(t.errors.notFound);

    // A day list with nothing ticked would otherwise parse as a valid, empty
    // request — said plainly here rather than silently writing nothing.
    const days = listField(formData, "days")
      .map((value) => Number(value))
      .filter((value) => (TEACHING_DAYS as readonly number[]).includes(value));
    if (days.length === 0) return failure(t.timetable.chooseAtLeastOneDay);

    const parsed = generateTimeSlotsSchema(t).safeParse({
      session: field(formData, "session"),
      scheduleKind: field(formData, "scheduleKind"),
      startTime: field(formData, "startTime"),
      periodMinutes: field(formData, "periodMinutes"),
      periodCount: field(formData, "periodCount"),
      breakAfterPeriod: field(formData, "breakAfterPeriod") || "0",
      breakMinutes: field(formData, "breakMinutes") || "0",
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const { written, blocked } = await generateTimeSlots({
      schoolYearId: year.id,
      days,
      session: parsed.data.session,
      scheduleKind: parsed.data.scheduleKind,
      startTime: parsed.data.startTime,
      periodMinutes: parsed.data.periodMinutes,
      periodCount: parsed.data.periodCount,
      breakAfterPeriod:
        parsed.data.breakAfterPeriod > 0 ? parsed.data.breakAfterPeriod : null,
      breakMinutes: parsed.data.breakMinutes,
      replace: field(formData, "replace") === "on",
    });
    if (blocked > 0) {
      return failure(interpolate(t.timetable.replaceBlocked, { count: blocked }));
    }

    refresh();
    return success(
      interpolate(t.timetable.timeSlotsGenerated, { count: written }),
    );
  });
}

// ── Generating a week ────────────────────────────────────────────────────────

/** A list of ids from the request: strings only, and no longer than `max`. */
function idList(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((id): id is string => typeof id === "string" && id.length <= 40)
    .slice(0, max);
}

function readSubjectSlots(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string[]> = {};
  for (const [subjectId, slots] of Object.entries(value).slice(0, 200)) {
    const ids = idList(slots, 500);
    if (ids) result[subjectId] = ids;
  }
  return result;
}

function readPins(
  value: unknown,
): { subjectId: string; timeSlotIds: string[] }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 200).flatMap((pin) => {
    if (!pin || typeof pin !== "object") return [];
    const { subjectId, timeSlotIds } = pin as Record<string, unknown>;
    const ids = idList(timeSlotIds, 100);
    return typeof subjectId === "string" && ids ? [{ subjectId, timeSlotIds: ids }] : [];
  });
}

/** Bounds the numbers so a crafted request cannot ask for a 400-period block. */
function readOptions(request: GeneratorRequest, schoolClassIds: string[]) {
  const clamp = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : min;

  return {
    schoolClassIds,
    scheduleKind: request.scheduleKind === "RAMADAN" ? "RAMADAN" : "STANDARD",
    seed: clamp(request.seed, 0, 2 ** 31),
    replaceExisting: request.replaceExisting === true,
    // A lesson longer than MAX_BLOCK_MINUTES is a data-entry slip, not a lesson.
    blockMinutes: clamp(request.blockMinutes, 0, MAX_BLOCK_MINUTES),
    maxMinutesPerDay: clamp(request.maxMinutesPerDay, 15, MAX_BLOCK_MINUTES * 2),
    // Only ever narrows: the service intersects it with the year's own slots.
    allowedSlotIds: idList(request.allowedSlotIds, 500),
    // Subject ids are only ever matched against the class programme, so a
    // foreign one matches nothing; slot ids are intersected with the run's own.
    skipSubjectIds: idList(request.skipSubjectIds, 200),
    subjectSlots: readSubjectSlots(request.subjectSlots),
    pins: readPins(request.pins),
  };
}

/**
 * Resolves the classes a generator request may touch.
 *
 * The ids come from the request and are re-derived against the school and year
 * in context, so one from another tenant matches nothing rather than having its
 * week rewritten. An empty list means "every class of the year", which is what
 * the whole-school option sends.
 */
async function resolveGeneratorClasses(
  schoolId: string,
  schoolYearId: string,
  requested: string[],
): Promise<string[]> {
  const classes = await db.schoolClass.findMany({
    where: {
      schoolId,
      levelOffering: { schoolYearId },
      isActive: true,
      ...(requested.length > 0 ? { id: { in: requested } } : {}),
    },
    select: { id: true },
  });

  return classes.map((entry) => entry.id);
}

/**
 * Lays out a grid and hands it back without writing anything.
 *
 * Not a `useActionState` form action — it returns the draft itself, which a
 * form's `ActionState` has nowhere to put. The screen calls it directly inside
 * a transition, draws the result, and only then offers to keep it.
 *
 * Gated on TIMETABLE_MANAGE rather than TIMETABLE_VIEW even though it writes
 * nothing: it reads every teacher's week across the school to find the gaps,
 * and that is not something a reader of one class's grid is entitled to.
 */
export async function previewTimetableAction(
  request: GeneratorRequest,
): Promise<PreviewResult> {
  const t = await getDictionary();
  const context = await requireAuth();

  const schoolId = context.currentSchool?.id;
  if (!schoolId) return { ok: false, message: t.errors.noSchoolContext };

  const schoolYearId = context.currentSchoolYear?.id;
  if (!schoolYearId) return { ok: false, message: t.errors.noSchoolYearContext };

  await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

  const schoolClassIds = await resolveGeneratorClasses(
    schoolId,
    schoolYearId,
    request.schoolClassIds,
  );
  if (schoolClassIds.length === 0) {
    return { ok: false, message: t.errors.notFound };
  }

  const draft = await buildTimetableDraft(
    schoolId,
    schoolYearId,
    readOptions(request, schoolClassIds),
  );

  return { ok: true, draft };
}

/**
 * Keeps a previewed grid.
 *
 * Takes the same request the preview took, seed included, and lays the week out
 * again from the database before writing it — the browser's copy of the draft
 * is never trusted. See `applyTimetableDraft`.
 *
 * The message reports what was actually written rather than what the preview
 * promised, because between the two somebody may have booked a room.
 */
export async function applyTimetableAction(
  request: GeneratorRequest,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    const schoolClassIds = await resolveGeneratorClasses(
      schoolId,
      schoolYearId,
      request.schoolClassIds,
    );
    if (schoolClassIds.length === 0) return failure(t.errors.notFound);

    const result = await applyTimetableDraft(
      schoolId,
      schoolYearId,
      readOptions(request, schoolClassIds),
      context.user.id,
    );

    refresh();
    return success(
      result.assigned > 0
        ? interpolate(t.timetable.gridAppliedAssigned, {
            written: result.written,
            cleared: result.cleared,
            classes: schoolClassIds.length,
            assigned: result.assigned,
          })
        : interpolate(t.timetable.gridApplied, {
            written: result.written,
            cleared: result.cleared,
            classes: schoolClassIds.length,
          }),
    );
  });
}

/**
 * Saves a teacher's standing horaire — the periods they do not work.
 *
 * The teacher and the year both decide the school, and the slots are re-derived
 * against it inside the service, so a crafted request cannot block periods on
 * somebody else's bell schedule. TIMETABLE_MANAGE rather than a code of its
 * own: whoever may draw the grid may say who is available to be put on it.
 */
export async function setTeacherAvailabilityAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    // The teacher must be one of this school's — an id from elsewhere reaches
    // nothing rather than having their week rewritten. Same test as the picker
    // on the availability screen — see `teacherOfSchool`.
    const teacher = await db.user.findFirst({
      where: { id: field(formData, "teacherId"), ...teacherOfSchool(schoolId) },
      select: { id: true },
    });
    if (!teacher) return failure(t.errors.notFound);

    const scheduleKind =
      field(formData, "scheduleKind") === "RAMADAN" ? "RAMADAN" : "STANDARD";

    const result = await setTeacherAvailability(
      teacher.id,
      schoolYearId,
      listField(formData, "blockedSlotIds"),
      scheduleKind,
    );

    refresh();
    return success(
      interpolate(t.timetable.availabilitySaved, { count: result.blocked }),
    );
  });
}

/**
 * Saves the lines of detail under one lesson — "Grammaire 08:00–08:30" inside an
 * Arabe hour. The lesson itself is left exactly as it is.
 *
 * The lesson decides the school, and that is what is authorized against; the
 * subjects are then looked up in it rather than trusted, so a crafted id cannot
 * name another school's matière. An empty list clears the details.
 */
export async function saveEntryDetailsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const parsed = entryDetailsSchema(t).safeParse({
      entryId: field(formData, "entryId"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const entry = await db.timetableEntry.findUnique({
      where: { id: parsed.data.entryId },
      select: { schoolClass: { select: { schoolId: true } } },
    });
    if (!entry) return failure(t.errors.notFound);

    const schoolId = entry.schoolClass.schoolId;
    await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

    const subjectIds = listField(formData, "detailSubjectId");
    const starts = listField(formData, "detailStart");
    const ends = listField(formData, "detailEnd");
    if (
      subjectIds.length !== starts.length ||
      starts.length !== ends.length ||
      subjectIds.length > MAX_ENTRY_DETAILS ||
      [...starts, ...ends].some((time) => !isTimeOfDay(time))
    ) {
      return failure(t.timetable.detailsInvalid);
    }

    const known = new Set(
      (
        await db.subject.findMany({
          where: { id: { in: subjectIds }, schoolId },
          select: { id: true },
        })
      ).map((subject) => subject.id),
    );
    if (subjectIds.some((id) => !known.has(id))) {
      return failure(t.errors.notFound);
    }

    const saved = await saveEntryDetails(
      parsed.data.entryId,
      subjectIds.map((subjectId, index) => ({
        subjectId,
        startTime: starts[index],
        endTime: ends[index],
      })),
    );
    if (!saved.ok) return failure(t.timetable.detailsInvalid);

    refresh();
    return success(t.timetable.detailsSaved);
  });
}

// ── Switching between generated grids ────────────────────────────────────────

/**
 * The version history for one bell schedule of the year in context — what the
 * "version history" panel lists.
 *
 * Gated the same as generating: a version's label may name the classes a run
 * touched, and only somebody who could draw the grid is entitled to browse
 * what past drawings looked like.
 */
export async function listTimetableVersionsAction(scheduleKind: string): Promise<
  | { ok: true; versions: Awaited<ReturnType<typeof listTimetableVersions>> }
  | { ok: false; message: string }
> {
  const t = await getDictionary();
  const context = await requireAuth();

  const schoolId = context.currentSchool?.id;
  if (!schoolId) return { ok: false, message: t.errors.noSchoolContext };

  const schoolYearId = context.currentSchoolYear?.id;
  if (!schoolYearId) return { ok: false, message: t.errors.noSchoolYearContext };

  await authorizeSchool(schoolId, PERMISSIONS.TIMETABLE_MANAGE);

  const versions = await listTimetableVersions(schoolYearId, scheduleKind);
  return { ok: true, versions };
}

/**
 * Switches the grid every ordinary screen shows back to an older version.
 *
 * Loses any manual edit made after the version being restored — going back in
 * time means exactly that. Same permission as generating: reverting is the
 * same kind of decision as drawing a new week, and this module keeps the two
 * on one code — see the module's permissions.ts.
 */
export async function activateTimetableVersionAction(
  versionId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    // Re-derived from the database, never trusted from the request — the
    // version names its own school, and that is what is authorized against.
    const version = await db.timetableVersion.findUnique({
      where: { id: versionId },
      select: { id: true, schoolYear: { select: { schoolId: true } } },
    });
    if (!version) return failure(t.errors.notFound);

    await authorizeSchool(
      version.schoolYear.schoolId,
      PERMISSIONS.TIMETABLE_MANAGE,
    );

    // `activateTimetableVersion` writes through the audited client, so the
    // status flip on both versions is already captured row by row — no manual
    // event needed here, unlike `applyTimetableDraft`, which bypasses that
    // client for performance and so records its own summary.
    const result = await activateTimetableVersion(versionId);
    if (!result.ok) {
      return failure(
        result.message === "ALREADY_ACTIVE"
          ? t.timetable.versionAlreadyActive
          : t.errors.notFound,
      );
    }

    refresh();
    return success(t.timetable.versionActivated);
  });
}
