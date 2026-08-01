import { bookingKeyOf, planSchoolWeeks } from "@/modules/timetable/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The bell schedule for a year, and a worked week of lessons for the classes
 * that have one.
 *
 * Two grids are seeded for every year: the standard one, and the compressed
 * continuous day Moroccan schools switch to during Ramadan.
 */

type SlotSeed = {
  dayOfWeek: number;
  session: string;
  startTime: string;
  endTime: string;
  scheduleKind: string;
  position: number;
  isBreak?: boolean;
};

/**
 * Monday–Friday full days, Saturday morning only — the Moroccan week.
 *
 * Periods are **one hour**, which is how collèges and lycées actually ring:
 * 8h–9h, 9h–10h, récréation, 10h15–11h15, 11h15–12h15, and the same shape after
 * lunch. Two-hour blocks would be simpler to seed and wrong — a 2h TP is *two*
 * consecutive periods a school chooses to give one subject, not a period that
 * is two hours long, and a grid built the other way can never express the
 * difference.
 */
function standardSlots(): SlotSeed[] {
  const slots: SlotSeed[] = [];

  const morning = (day: number, offset: number): SlotSeed[] => [
    { dayOfWeek: day, session: "MORNING", startTime: "08:00", endTime: "09:00", scheduleKind: "STANDARD", position: offset + 1 },
    { dayOfWeek: day, session: "MORNING", startTime: "09:00", endTime: "10:00", scheduleKind: "STANDARD", position: offset + 2 },
    { dayOfWeek: day, session: "MORNING", startTime: "10:00", endTime: "10:15", scheduleKind: "STANDARD", position: offset + 3, isBreak: true },
    { dayOfWeek: day, session: "MORNING", startTime: "10:15", endTime: "11:15", scheduleKind: "STANDARD", position: offset + 4 },
    { dayOfWeek: day, session: "MORNING", startTime: "11:15", endTime: "12:15", scheduleKind: "STANDARD", position: offset + 5 },
  ];

  for (const day of [1, 2, 3, 4, 5]) {
    slots.push(
      ...morning(day, 0),
      { dayOfWeek: day, session: "AFTERNOON", startTime: "14:00", endTime: "15:00", scheduleKind: "STANDARD", position: 6 },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "15:00", endTime: "16:00", scheduleKind: "STANDARD", position: 7 },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "16:00", endTime: "16:15", scheduleKind: "STANDARD", position: 8, isBreak: true },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "16:15", endTime: "17:15", scheduleKind: "STANDARD", position: 9 },
      { dayOfWeek: day, session: "AFTERNOON", startTime: "17:15", endTime: "18:15", scheduleKind: "STANDARD", position: 10 },
    );
  }

  // Saturday is morning only.
  slots.push(...morning(6, 0));

  return slots;
}

/** Ramadan: one continuous morning, no afternoon session. */
function ramadanSlots(): SlotSeed[] {
  return [1, 2, 3, 4, 5, 6].flatMap((day) => [
    { dayOfWeek: day, session: "MORNING", startTime: "09:00", endTime: "09:45", scheduleKind: "RAMADAN", position: 1 },
    { dayOfWeek: day, session: "MORNING", startTime: "09:45", endTime: "10:30", scheduleKind: "RAMADAN", position: 2 },
    { dayOfWeek: day, session: "MORNING", startTime: "10:40", endTime: "11:25", scheduleKind: "RAMADAN", position: 3 },
    { dayOfWeek: day, session: "MORNING", startTime: "11:25", endTime: "12:10", scheduleKind: "RAMADAN", position: 4 },
    { dayOfWeek: day, session: "MORNING", startTime: "12:20", endTime: "13:05", scheduleKind: "RAMADAN", position: 5 },
  ]);
}

export type SeededSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  isBreak: boolean;
  scheduleKind: string;
};

export async function seedTimeSlots(
  db: SeedDb,
  schoolYearId: string,
): Promise<SeededSlot[]> {
  const seeded: SeededSlot[] = [];

  for (const slot of [...standardSlots(), ...ramadanSlots()]) {
    const row = await db.timeSlot.upsert({
      where: {
        schoolYearId_scheduleKind_dayOfWeek_startTime: {
          schoolYearId,
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
        schoolYearId,
        dayOfWeek: slot.dayOfWeek,
        session: slot.session,
        startTime: slot.startTime,
        endTime: slot.endTime,
        scheduleKind: slot.scheduleKind,
        position: slot.position,
        isBreak: slot.isBreak ?? false,
      },
    });
    seeded.push({
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      isBreak: row.isBreak,
      scheduleKind: row.scheduleKind,
    });
  }

  log("time slots", `${seeded.length} (standard + Ramadan)`);
  return seeded;
}

export type TimetableClass = {
  id: string;
  code: string;
  roomId: string | null;
  /** Subject id → the teacher assigned to it for this class. */
  assignments: { subjectId: string; teacherId: string; requiresLab: boolean }[];
};

/**
 * Lays out a week for each class.
 *
 * Deliberately conflict-free: the allocator tracks which teacher and which room
 * is already busy in each slot and skips rather than double-book, so the seeded
 * data satisfies the two clash rules the database cannot enforce itself.
 */
export async function seedTimetable(
  db: SeedDb,
  {
    classes,
    slots,
    termId,
    labRoomIds,
  }: {
    classes: TimetableClass[];
    slots: SeededSlot[];
    termId: string;
    labRoomIds: string[];
  },
): Promise<number> {
  const teachable = slots
    .filter((slot) => slot.scheduleKind === "STANDARD" && !slot.isBreak)
    .sort((a, b) =>
      a.dayOfWeek === b.dayOfWeek
        ? a.startTime.localeCompare(b.startTime)
        : a.dayOfWeek - b.dayOfWeek,
    );

  /**
   * The slot immediately after this one, on the same day, with no break in
   * between — what a double period runs into.
   *
   * `endTime` is not carried on SeededSlot, so adjacency is read off the
   * ordered list: the next entry of the same day is adjacent unless the bell
   * schedule put a break between them, and breaks are already filtered out
   * above, so their absence is what has to be checked.
   */
  const nextAdjacent = (index: number): SeededSlot | null => {
    const slot = teachable[index];
    const next = teachable[index + 1];
    if (!next || next.dayOfWeek !== slot.dayOfWeek) return null;

    const between = slots.find(
      (candidate) =>
        candidate.scheduleKind === "STANDARD" &&
        candidate.isBreak &&
        candidate.dayOfWeek === slot.dayOfWeek &&
        candidate.startTime > slot.startTime &&
        candidate.startTime < next.startTime,
    );
    return between ? null : next;
  };

  const busyTeacher = new Set<string>();
  const busyRoom = new Set<string>();
  const busyClass = new Set<string>();
  let created = 0;

  for (const [classIndex, klass] of classes.entries()) {
    if (klass.assignments.length === 0) continue;

    // Start each class at a different point in the week, so the early slots are
    // not all taken by the first classes seeded.
    const offset = (classIndex * 3) % teachable.length;

    for (const assignment of klass.assignments) {
      // One period per subject per week is enough for a demo grid. Scan the
      // whole week rather than consuming a slot on every miss — otherwise a
      // class runs out of week before it runs out of subjects.
      // Travaux pratiques run 2h in one sitting, so a lab subject is placed as
      // a double period — which is also what makes the merged rendering in the
      // grid visible in a freshly seeded database.
      const wantsDouble = assignment.requiresLab;

      for (let step = 0; step < teachable.length; step += 1) {
        const index = (offset + step) % teachable.length;
        const slot = teachable[index];
        const second = wantsDouble ? nextAdjacent(index) : null;
        if (wantsDouble && !second) continue;

        const periods = second ? [slot, second] : [slot];

        if (periods.some((period) => busyClass.has(`${klass.id}:${period.id}`))) {
          continue;
        }
        if (
          periods.some((period) =>
            busyTeacher.has(`${assignment.teacherId}:${period.id}`),
          )
        ) {
          continue;
        }

        // A lab subject needs a free lab; anything else sits in the class's own
        // room, which nobody else is using.
        const roomId = assignment.requiresLab
          ? labRoomIds.find((id) =>
              periods.every((period) => !busyRoom.has(`${id}:${period.id}`)),
            )
          : klass.roomId;
        if (assignment.requiresLab && !roomId) continue;

        if (
          roomId &&
          periods.some((period) => busyRoom.has(`${roomId}:${period.id}`))
        ) {
          continue;
        }

        const bookingKey = bookingKeyOf(null, termId);

        // One row per period, even for a double — see the note in service.ts.
        for (const period of periods) {
          await db.timetableEntry.upsert({
            where: {
              schoolClassId_timeSlotId_bookingKey: {
                schoolClassId: klass.id,
                timeSlotId: period.id,
                bookingKey,
              },
            },
            update: {
              subjectId: assignment.subjectId,
              teacherId: assignment.teacherId,
              roomId: roomId ?? null,
            },
            create: {
              schoolClassId: klass.id,
              timeSlotId: period.id,
              subjectId: assignment.subjectId,
              teacherId: assignment.teacherId,
              roomId: roomId ?? null,
              termId,
              bookingKey,
            },
          });

          busyClass.add(`${klass.id}:${period.id}`);
          busyTeacher.add(`${assignment.teacherId}:${period.id}`);
          if (roomId) busyRoom.add(`${roomId}:${period.id}`);
          created += 1;
        }
        break;
      }
    }
  }

  log("timetable entries", created);
  return created;
}

/**
 * The school calendar: the announced holidays of a Moroccan academic year.
 *
 * Dates are derived from the year's own start rather than hard-coded, so
 * re-seeding in a later year produces a coherent calendar instead of a set of
 * 2025 dates hanging off a 2027 year. They are the *civil* holidays, whose
 * dates are fixed; the religious ones move with the Hijri calendar and are the
 * school's to enter under /configuration, which is exactly why that screen
 * exists.
 */
type HolidaySeed = {
  name: string;
  nameAr: string;
  kind: string;
  /** Month (1-12) and day, resolved against the academic year it falls in. */
  month: number;
  day: number;
  /** Days it runs for, inclusive. 1 is a single-day férié. */
  days: number;
};

const HOLIDAYS: HolidaySeed[] = [
  { name: "Fête de l'Indépendance", nameAr: "عيد الاستقلال", kind: "PUBLIC_HOLIDAY", month: 11, day: 18, days: 1 },
  { name: "Vacances de mi-année", nameAr: "عطلة منتصف السنة", kind: "SCHOOL_HOLIDAY", month: 1, day: 27, days: 9 },
  { name: "Manifeste de l'Indépendance", nameAr: "ذكرى تقديم وثيقة الاستقلال", kind: "PUBLIC_HOLIDAY", month: 1, day: 11, days: 1 },
  { name: "Fête du Travail", nameAr: "عيد الشغل", kind: "PUBLIC_HOLIDAY", month: 5, day: 1, days: 1 },
  { name: "Vacances de printemps", nameAr: "عطلة الربيع", kind: "SCHOOL_HOLIDAY", month: 4, day: 5, days: 12 },
  { name: "Fête du Trône", nameAr: "عيد العرش", kind: "PUBLIC_HOLIDAY", month: 7, day: 30, days: 1 },
];

export async function seedHolidays(
  db: SeedDb,
  schoolYearId: string,
  yearStart: Date,
  yearEnd: Date,
): Promise<number> {
  let written = 0;

  for (const holiday of HOLIDAYS) {
    // A school year straddles two calendar years: a November date belongs to
    // the first, a May date to the second. Deciding by month against the start
    // is what keeps that right without hard-coding either year.
    const calendarYear =
      holiday.month >= yearStart.getMonth() + 1
        ? yearStart.getFullYear()
        : yearStart.getFullYear() + 1;

    const startDate = new Date(calendarYear, holiday.month - 1, holiday.day);
    const endDate = new Date(
      calendarYear,
      holiday.month - 1,
      holiday.day + holiday.days - 1,
    );

    // A date the year does not cover is skipped rather than clamped: a school
    // whose year ends in June has no Fête du Trône to declare.
    if (startDate < yearStart || startDate > yearEnd) continue;

    // No natural unique key on the table — a school may legitimately declare
    // two closures with the same name — so idempotency is a find-then-write on
    // (year, name), which is what a re-run should match.
    const existing = await db.schoolHoliday.findFirst({
      where: { schoolYearId, name: holiday.name },
      select: { id: true },
    });

    const data = {
      nameAr: holiday.nameAr,
      kind: holiday.kind,
      startDate,
      endDate,
    };

    if (existing) {
      await db.schoolHoliday.update({ where: { id: existing.id }, data });
    } else {
      await db.schoolHoliday.create({
        data: { schoolYearId, name: holiday.name, ...data },
      });
    }
    written += 1;
  }

  log("holidays", written);
  return written;
}

/**
 * Numbers the year's teaching weeks, from the same pure planner the action uses.
 *
 * Runs after the holidays, because which weeks are taught depends on them.
 * Idempotent — upserts on `(schoolYearId, number)` and never deletes, so a week
 * a school renamed or re-parityed by hand keeps whatever it was given except
 * the dates and the rotation the plan owns.
 */
export async function seedSchoolWeeks(
  db: SeedDb,
  schoolYearId: string,
  yearStart: Date,
  yearEnd: Date,
): Promise<number> {
  const holidays = await db.schoolHoliday.findMany({
    where: { schoolYearId },
    select: { startDate: true, endDate: true },
  });

  const weeks = planSchoolWeeks({
    yearStart,
    yearEnd,
    holidays,
    firstParity: "A",
  });

  for (const week of weeks) {
    await db.schoolWeek.upsert({
      where: { schoolYearId_number: { schoolYearId, number: week.number } },
      update: {
        startsOn: week.startsOn,
        endsOn: week.endsOn,
        parity: week.parity,
      },
      create: {
        schoolYearId,
        number: week.number,
        startsOn: week.startsOn,
        endsOn: week.endsOn,
        parity: week.parity,
      },
    });
  }

  log("weeks", `${weeks.length} taught weeks`);
  return weeks.length;
}
