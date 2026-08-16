import { addMinutesToTime } from "@/modules/timetable/enums";

/**
 * The bell schedule a school starts with, and the holidays it announces.
 *
 * Pure data and pure arithmetic — no `server-only`, no `db` — because the same
 * period-laying has four readers that cannot import each other: the seed runs
 * under plain `tsx` (so it may not touch `service.ts`), `generateTimeSlots`
 * upserts through the app's client, `modules/setup/service.ts` writes inside a
 * transaction, and the wizard's preview draws the grid in the browser before
 * anything is written at all.
 */

export type SlotPreset = {
  dayOfWeek: number;
  session: string;
  startTime: string;
  endTime: string;
  scheduleKind: string;
  position: number;
  isBreak?: boolean;
};

/** How long one period rings for, in minutes. */
export const PERIOD_MINUTES = 60;

/**
 * One run of consecutive periods, with at most one break, laid onto every day
 * in `days` alike.
 *
 * `startPosition` exists for the caller that is adding a second block to a day
 * that already has one: the afternoon continues the morning's numbering instead
 * of restarting at 1. Left out, every day starts at 1.
 */
export function layPeriodBlock(input: {
  days: readonly number[];
  session: string;
  scheduleKind: string;
  startTime: string;
  periodMinutes: number;
  periodCount: number;
  /** Which period the break follows. Null lays the run with no break at all. */
  breakAfterPeriod: number | null;
  breakMinutes: number;
  startPosition?: (day: number) => number;
}): SlotPreset[] {
  const slots: SlotPreset[] = [];

  for (const day of input.days) {
    let time = input.startTime;
    let position = input.startPosition?.(day) ?? 1;

    for (let period = 1; period <= input.periodCount; period += 1) {
      const endTime = addMinutesToTime(time, input.periodMinutes);
      slots.push({
        dayOfWeek: day,
        session: input.session,
        startTime: time,
        endTime,
        scheduleKind: input.scheduleKind,
        position,
      });
      position += 1;
      time = endTime;

      if (period === input.breakAfterPeriod && input.breakMinutes > 0) {
        const breakEnd = addMinutesToTime(time, input.breakMinutes);
        slots.push({
          dayOfWeek: day,
          session: input.session,
          startTime: time,
          endTime: breakEnd,
          scheduleKind: input.scheduleKind,
          position,
          isBreak: true,
        });
        position += 1;
        time = breakEnd;
      }
    }
  }

  return slots;
}

/**
 * The days this preset lays a day on: Monday to Friday, no Saturday.
 *
 * Not `TEACHING_DAYS` from `enums.ts`, which is a different thing under a
 * similar name and worth keeping apart: that one is the set of days a school may
 * *declare* — what the picker offers and what `teachingDaysOf` falls back to —
 * and it still runs to Saturday, because a school that opens on one has to be
 * able to say so. This is the week the starting bell schedule actually lays,
 * which is a choice within that set rather than a widening of it.
 *
 * A school that wants its Saturday back adds it in the configuration and lays
 * the periods with `generateTimeSlots`; nothing here has to change.
 */
export const PRESET_TEACHING_DAYS = [1, 2, 3, 4, 5] as const;

/** `SchoolSettings.teachingDays` for the week above — see `parseTeachingDays`. */
export const PRESET_TEACHING_DAYS_SETTING = PRESET_TEACHING_DAYS.join(",");

/**
 * The half-days this preset week does not teach — Wednesday afternoon.
 *
 * A half-day off wants to be an *afternoon*: a morning off would split the day
 * either side of a hole, whereas an afternoon off simply ends it at noon.
 * Wednesday because it puts the break in the middle of the week, which is what
 * both the Moroccan and the French habit do with it, and it leaves Friday
 * whole.
 *
 * A **list**, and not because this preset needs one: a school does not all take
 * the same half-day off. Friday afternoon for the prière, Wednesday for the
 * habit, and both plus a Saturday that stops at noon for the ones that open on
 * six days — every one of those is a set, so `SchoolSettings.freeAfternoonDays`
 * stores a set and this is one value of it. Empty teaches every afternoon.
 */
export const FREE_AFTERNOON_DAYS = [3] as const;

/** `SchoolSettings.freeAfternoonDays` for the week above. */
export const FREE_AFTERNOON_DAYS_SETTING = FREE_AFTERNOON_DAYS.join(",");

/** The days that have an afternoon session — every teaching day but those. */
export function afternoonDays(): number[] {
  return PRESET_TEACHING_DAYS.filter(
    (day) => !(FREE_AFTERNOON_DAYS as readonly number[]).includes(day),
  );
}

/**
 * Monday–Friday, 08h00–12h15 with a quarter-hour récréation, and 14h00–18h15
 * the same shape every afternoon but Wednesday's — nine taught half-days out of
 * ten.
 *
 * Periods are one hour: the length a lesson actually runs, which is what a
 * school picking its own bell schedule reaches for first. A subject that wants
 * half an hour or ninety minutes is still exactly expressible — `startTime` and
 * `endTime` carry whatever is laid — one hour is only this preset's default.
 *
 * Nine half-days is **36 periods a week, and that is exactly what every level
 * of the cursus asks for** — see `WEEKLY_TEACHING_MINUTES`, which is sized from
 * this grid and which `presets.test.ts` holds the two to.
 *
 * So the week is full rather than roomy, and the generator has no slack: a
 * lesson wanting the laboratoire competes for it against every other class at
 * once, and `generateTimetable` reports the shortfall instead of finding room.
 * That is the honest consequence of a full week and it is visible on the
 * screen; a school wanting margin trims an hour off a level's programme under
 * /configuration rather than changing the bell.
 */
export function standardSlots(): SlotPreset[] {
  const morning = layPeriodBlock({
    days: PRESET_TEACHING_DAYS,
    session: "MORNING",
    scheduleKind: "STANDARD",
    startTime: "08:00",
    periodMinutes: PERIOD_MINUTES,
    periodCount: 4,
    breakAfterPeriod: 2,
    breakMinutes: 15,
  });

  // The afternoon continues the morning's numbering, which is what `position`
  // means to every screen that reads the grid — and what `slotsForBell` already
  // does for a school that lays its schedule through the wizard.
  const morningCount = new Map<number, number>();
  for (const slot of morning) {
    morningCount.set(slot.dayOfWeek, (morningCount.get(slot.dayOfWeek) ?? 0) + 1);
  }

  return [
    ...morning,
    ...layPeriodBlock({
      days: afternoonDays(),
      session: "AFTERNOON",
      scheduleKind: "STANDARD",
      startTime: "14:00",
      periodMinutes: PERIOD_MINUTES,
      periodCount: 4,
      breakAfterPeriod: 2,
      breakMinutes: 15,
      startPosition: (day) => (morningCount.get(day) ?? 0) + 1,
    }),
  ];
}

/**
 * Ramadan: one continuous morning, no afternoon session — 09h00–13h15.
 *
 * Every teaching day alike, the free Wednesday afternoon included: the month
 * has no afternoons to give off, so the half-day the standard week drops is not
 * a distinction this grid can make.
 */
export function ramadanSlots(): SlotPreset[] {
  return layPeriodBlock({
    days: PRESET_TEACHING_DAYS,
    session: "MORNING",
    scheduleKind: "RAMADAN",
    startTime: "09:00",
    periodMinutes: PERIOD_MINUTES,
    periodCount: 4,
    breakAfterPeriod: 2,
    breakMinutes: 15,
  });
}

export type HolidayPreset = {
  name: string;
  nameAr: string;
  kind: string;
  /** Month (1-12) and day, resolved against the academic year it falls in. */
  month: number;
  day: number;
  /** Days it runs for, inclusive. 1 is a single-day férié. */
  days: number;
};

/**
 * The fixed-date holidays of the Moroccan school calendar.
 *
 * Civil only: the Hijri feasts move against the Gregorian calendar every year
 * and are the school's to enter under /configuration, which is exactly why that
 * screen exists.
 */
export const HOLIDAYS: HolidayPreset[] = [
  { name: "Fête de l'Indépendance", nameAr: "عيد الاستقلال", kind: "PUBLIC_HOLIDAY", month: 11, day: 18, days: 1 },
  { name: "Vacances de mi-année", nameAr: "عطلة منتصف السنة", kind: "SCHOOL_HOLIDAY", month: 1, day: 27, days: 9 },
  { name: "Manifeste de l'Indépendance", nameAr: "ذكرى تقديم وثيقة الاستقلال", kind: "PUBLIC_HOLIDAY", month: 1, day: 11, days: 1 },
  { name: "Fête du Travail", nameAr: "عيد الشغل", kind: "PUBLIC_HOLIDAY", month: 5, day: 1, days: 1 },
  { name: "Vacances de printemps", nameAr: "عطلة الربيع", kind: "SCHOOL_HOLIDAY", month: 4, day: 5, days: 12 },
  { name: "Fête du Trône", nameAr: "عيد العرش", kind: "PUBLIC_HOLIDAY", month: 7, day: 30, days: 1 },
];
