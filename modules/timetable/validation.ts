import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField, optionalText, requiredText } from "@/lib/validation";
import {
  DAY_SESSIONS,
  EXCEPTION_KINDS,
  MAX_LESSON_SPAN,
  SCHEDULE_KINDS,
  WEEK_PARITIES,
} from "@/modules/timetable/enums";

/**
 * Built per-request from the dictionary so messages are localised.
 *
 * `days` is deliberately absent: the action reads it separately and always
 * folds the anchor's own day in, so a request that omitted it could not place
 * a lesson nowhere.
 */
export function timetableEntrySchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    timeSlotId: requiredText(v, { max: 40 }),
    subjectId: requiredText(v, { max: 40 }),
    teacherId: optionalText(40),
    roomId: optionalText(40),
    classGroupId: optionalText(40),
    termId: optionalText(40),
    /** "ALL" | "A" | "B" — which weeks of the rotation the lesson runs in. */
    weekParity: enumField(WEEK_PARITIES, t.validation),
    /** The week the grid was showing. Blank when editing the template itself. */
    weekNumber: optionalText(8),
    applyToFollowing: z.boolean(),
    /** Consecutive periods the lesson runs for — 2 is a double period. */
    spanSlots: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(MAX_LESSON_SPAN, { error: v.invalidNumber }),
  });
}

/**
 * The lesson whose lines of detail are being saved. The lines themselves arrive
 * as three parallel lists and are checked by the action, which has the lesson's
 * own period to check them against.
 */
export function entryDetailsSchema(t: Dictionary) {
  return z.object({ entryId: requiredText(t.validation, { max: 40 }) });
}

/**
 * A one-off change to one period of one week.
 *
 * `weekStart` arrives as `YYYY-MM-DD` and is re-derived to the Monday of its
 * week by the action, so a mid-week date typed into a URL cannot open a second
 * override keyed on a Wednesday.
 */
/**
 * One block of consecutive periods, to lay onto whichever days the form ticks.
 *
 * `days` is deliberately absent, exactly as on `timetableEntrySchema`: the
 * action reads the ticked days itself and refuses a request with none, rather
 * than this schema accepting an empty list as a shape that parses.
 */
export function generateTimeSlotsSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    session: enumField(DAY_SESSIONS, v),
    scheduleKind: enumField(SCHEDULE_KINDS, v),
    startTime: requiredText(v, { max: 5 }),
    periodMinutes: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(15, { error: v.invalidNumber })
      .max(180, { error: v.invalidNumber }),
    periodCount: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(1, { error: v.invalidNumber })
      .max(12, { error: v.invalidNumber }),
    /** 0 means no break. */
    breakAfterPeriod: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(12, { error: v.invalidNumber }),
    breakMinutes: z.coerce
      .number({ error: v.invalidNumber })
      .int({ error: v.invalidNumber })
      .min(0, { error: v.invalidNumber })
      .max(60, { error: v.invalidNumber }),
  });
}

export function timetableExceptionSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    schoolClassId: requiredText(v, { max: 40 }),
    timeSlotId: requiredText(v, { max: 40 }),
    weekStart: requiredText(v, { max: 10 }),
    kind: enumField(EXCEPTION_KINDS, v),
    subjectId: optionalText(40),
    teacherId: optionalText(40),
    roomId: optionalText(40),
    classGroupId: optionalText(40),
    note: optionalText(200),
  });
}
