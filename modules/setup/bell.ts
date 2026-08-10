import { layPeriodBlock } from "@/modules/timetable/presets";

/**
 * A school's bell schedule, as the wizard asks for it and as it is laid out.
 *
 * Pure, and separate from `service.ts` for one reason: the wizard's bell step
 * draws a live preview of the day in the browser, and it must be drawn by the
 * same arithmetic that writes it. A second implementation for the preview is a
 * preview that eventually lies.
 */

export type BellPlan = {
  teachingDays: number[];
  dayStartsAt: string;
  afternoonStartsAt: string;
  periodMinutes: number;
  morningPeriods: number;
  afternoonPeriods: number;
  periodsBeforeBreak: number;
  breakMinutes: number;
  saturdayMorningOnly: boolean;
  withRamadan: boolean;
  ramadanStartsAt: string;
  ramadanPeriods: number;
};


/** The time slots a bell plan implies, standard grid and Ramadan grid alike. */
export function slotsForBell(bell: BellPlan) {
  const morningDays = bell.teachingDays;
  const afternoonDays = bell.saturdayMorningOnly
    ? bell.teachingDays.filter((day) => day !== 6)
    : bell.teachingDays;

  const morning =
    bell.morningPeriods > 0
      ? layPeriodBlock({
          days: morningDays,
          session: "MORNING",
          scheduleKind: "STANDARD",
          startTime: bell.dayStartsAt,
          periodMinutes: bell.periodMinutes,
          periodCount: bell.morningPeriods,
          breakAfterPeriod: bell.periodsBeforeBreak || null,
          breakMinutes: bell.breakMinutes,
        })
      : [];

  // The afternoon continues the morning's numbering on the days that have one,
  // which is what `position` means to every screen that reads the grid.
  const morningCount = new Map<number, number>();
  for (const slot of morning) {
    morningCount.set(slot.dayOfWeek, (morningCount.get(slot.dayOfWeek) ?? 0) + 1);
  }

  const afternoon =
    bell.afternoonPeriods > 0
      ? layPeriodBlock({
          days: afternoonDays,
          session: "AFTERNOON",
          scheduleKind: "STANDARD",
          startTime: bell.afternoonStartsAt,
          periodMinutes: bell.periodMinutes,
          periodCount: bell.afternoonPeriods,
          breakAfterPeriod: bell.periodsBeforeBreak || null,
          breakMinutes: bell.breakMinutes,
          startPosition: (day) => (morningCount.get(day) ?? 0) + 1,
        })
      : [];

  const ramadan =
    bell.withRamadan && bell.ramadanPeriods > 0
      ? layPeriodBlock({
          days: morningDays,
          session: "MORNING",
          scheduleKind: "RAMADAN",
          startTime: bell.ramadanStartsAt,
          periodMinutes: bell.periodMinutes,
          periodCount: bell.ramadanPeriods,
          breakAfterPeriod: bell.periodsBeforeBreak || null,
          breakMinutes: bell.breakMinutes,
        })
      : [];

  return [...morning, ...afternoon, ...ramadan];
}
