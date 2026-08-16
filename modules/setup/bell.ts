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
  /**
   * The half-days the school teaches no afternoon — any of its teaching days,
   * as many as it likes, empty to teach every afternoon of the week.
   *
   * A half-day off wants to be an afternoon rather than a morning: a morning
   * off would split the day either side of a hole, whereas an afternoon off
   * simply ends the day at noon.
   *
   * This replaced a single free afternoon *and* a `saturdayMorningOnly` switch.
   * Two mechanisms for one fact, and the second was a rule about a named day
   * rather than the school's own choice: a school taking Friday afternoon for
   * the prière could not also stop at noon on Saturday, and one that wanted its
   * Saturday afternoon back had to find a switch that was on by default. Which
   * half-days a school takes off is nobody's decision but its own.
   */
  freeAfternoonDays: number[];
  withRamadan: boolean;
  ramadanStartsAt: string;
  ramadanPeriods: number;
};

/** The days a bell plan actually opens an afternoon on. */
export function afternoonDaysOf(bell: BellPlan): number[] {
  return bell.teachingDays.filter(
    (day) => !bell.freeAfternoonDays.includes(day),
  );
}

/**
 * Hours of lessons the week seats, breaks excluded — what the programme has
 * room to ask for.
 *
 * Shown on the bell step beside the preview, because the two numbers a school
 * has to reconcile are this one and the weekly total of its programme, and
 * until one of them was on screen nobody could see that a primary year was
 * asking for two-thirds of its week. See `WEEKLY_TEACHING_MINUTES`.
 */
export function weeklyTeachingMinutes(bell: BellPlan): number {
  const mornings = bell.teachingDays.length * bell.morningPeriods;
  const afternoons = afternoonDaysOf(bell).length * bell.afternoonPeriods;
  return (mornings + afternoons) * bell.periodMinutes;
}

/** The time slots a bell plan implies, standard grid and Ramadan grid alike. */
export function slotsForBell(bell: BellPlan) {
  const morningDays = bell.teachingDays;
  const afternoonDays = afternoonDaysOf(bell);

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
