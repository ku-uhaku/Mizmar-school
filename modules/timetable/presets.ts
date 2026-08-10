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
 * Monday–Saturday, 08h00–12h15 with a quarter-hour récréation; Monday–Friday
 * again, 14h00–18h15 the same shape. Saturday is morning only — the Moroccan
 * week.
 *
 * Periods are one hour: the length a lesson actually runs, which is what a
 * school picking its own bell schedule reaches for first. A subject that wants
 * half an hour or ninety minutes is still exactly expressible — `startTime` and
 * `endTime` carry whatever is laid — one hour is only this preset's default.
 */
export function standardSlots(): SlotPreset[] {
  return [
    ...layPeriodBlock({
      days: [1, 2, 3, 4, 5, 6],
      session: "MORNING",
      scheduleKind: "STANDARD",
      startTime: "08:00",
      periodMinutes: PERIOD_MINUTES,
      periodCount: 4,
      breakAfterPeriod: 2,
      breakMinutes: 15,
    }),
    ...layPeriodBlock({
      days: [1, 2, 3, 4, 5],
      session: "AFTERNOON",
      scheduleKind: "STANDARD",
      startTime: "14:00",
      periodMinutes: PERIOD_MINUTES,
      periodCount: 4,
      breakAfterPeriod: 2,
      breakMinutes: 15,
    }),
  ];
}

/** Ramadan: one continuous morning, no afternoon session — 09h00–13h15. */
export function ramadanSlots(): SlotPreset[] {
  return layPeriodBlock({
    days: [1, 2, 3, 4, 5, 6],
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
