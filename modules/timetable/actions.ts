"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { field, listField, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { isTeachingDayIn } from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import {
  entriesInBlock,
  findClash,
  saveLessonBlock,
} from "@/modules/timetable/service";
import {
  timetableEntrySchema,
  timetableExceptionSchema,
} from "@/modules/timetable/validation";
import { bookingKeyOf } from "@/modules/timetable/enums";
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
      spanSlots: field(formData, "spanSlots") || "1",
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

    const teacher = parsed.data.teacherId
      ? await db.user.findFirst({
          where: {
            id: parsed.data.teacherId,
            memberships: { some: { schoolId: schoolClass.schoolId } },
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

    // The rows this block already occupies, so growing, shrinking or moving it
    // replaces them instead of leaving orphans behind.
    const existing = entryId ? await entriesInBlock(entryId) : [];
    const replaceIds = existing
      .filter((entry) => !timeSlotIds.includes(entry.timeSlotId))
      .map((entry) => entry.id);
    const keepIds = existing.map((entry) => entry.id);

    for (const timeSlotId of timeSlotIds) {
      const clash = await findClash({
        timeSlotId,
        schoolClassId: schoolClass.id,
        teacherId: teacher?.id ?? null,
        roomId: room?.id ?? null,
        classGroupId: group?.id ?? null,
        termId: term?.id ?? null,
        exceptEntryIds: keepIds,
      });

      if (clash) {
        const message =
          clash.kind === "TEACHER"
            ? t.timetable.teacherClash
            : clash.kind === "ROOM"
              ? t.timetable.roomClash
              : t.timetable.classClash;
        return failure(
          interpolate(message, {
            class: clash.className,
            slot: clash.slotLabel,
          }),
        );
      }
    }

    const written = await saveLessonBlock(
      {
        schoolClassId: schoolClass.id,
        timeSlotIds,
        subjectId: subject.id,
        teacherId: teacher?.id ?? null,
        roomId: room?.id ?? null,
        classGroupId: group?.id ?? null,
        termId: term?.id ?? null,
      },
      replaceIds,
    );

    refresh();
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

    await db.timetableEntry.deleteMany({ where: { id: { in: ids } } });

    refresh();
    return success(t.timetable.cleared);
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
              memberships: { some: { schoolId: schoolClass.schoolId } },
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
