import {
  activeVersionKeyOf,
  bookingKeyOf,
  planSchoolWeeks,
} from "@/modules/timetable/enums";
import { HOLIDAYS, ramadanSlots, standardSlots } from "@/modules/timetable/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The bell schedule for a year, and a worked week of lessons for the classes
 * that have one.
 *
 * Two grids are seeded for every year: the standard one, and the compressed
 * continuous day Moroccan schools switch to during Ramadan. Both come from
 * `modules/timetable/presets.ts`, which is also what the setup wizard lays and
 * what `generateTimeSlots` upserts — one copy of the arithmetic, three callers.
 *
 * ── Why this does not call `generateTimeSlots` ──────────────────────────────
 * A seed script runs under plain `tsx`, outside the Next.js bundler that makes
 * a `server-only` import a no-op, and `service.ts` starts with one. That throws
 * unconditionally under tsx (see `node_modules/server-only/index.js`), so no
 * seed file may import a module's `service.ts`. The shared part lives in
 * `presets.ts` instead, which is pure and therefore importable from anywhere.
 */

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
 *
 * Those three "busy" sets are primed from the grid that is already there, not
 * just from what this run places. A week laid out in the app — by the generator
 * or by hand — is written with `termId: null`, so its rows carry a different
 * `bookingKey` from the seed's and the upsert below cannot see them: without
 * the priming, re-seeding lays a second week over the first and puts teachers
 * in two classrooms at once. Filling only what is genuinely free is also the
 * only reading of "idempotent" that holds once somebody has used the app.
 */
/**
 * Finds (or creates, on a first seed) the ACTIVE `TimetableVersion` for one
 * bell schedule of one year.
 *
 * A seed script cannot import `service.ts`'s `ensureActiveVersion` — that file
 * starts with `import "server-only"`, which throws unconditionally outside the
 * Next.js bundler — so the same small piece of logic is inlined here. Race
 * safety does not matter the way it does for a concurrent web request: a seed
 * runs alone.
 */
async function ensureSeedVersion(
  db: SeedDb,
  schoolYearId: string,
  scheduleKind: string,
): Promise<string> {
  const activeKey = activeVersionKeyOf(schoolYearId, scheduleKind);
  const existing = await db.timetableVersion.findUnique({ where: { activeKey } });
  if (existing) return existing.id;

  const created = await db.timetableVersion.create({
    data: { schoolYearId, scheduleKind, status: "ACTIVE", activeKey, label: "Seed data" },
  });
  return created.id;
}

export async function seedTimetable(
  db: SeedDb,
  {
    schoolYearId,
    classes,
    slots,
    termId,
    labRoomIds,
  }: {
    schoolYearId: string;
    classes: TimetableClass[];
    slots: SeededSlot[];
    termId: string;
    labRoomIds: string[];
  },
): Promise<number> {
  const versionId = await ensureSeedVersion(db, schoolYearId, "STANDARD");
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

  // Whatever already stands on these periods, whichever term or booking key it
  // was written under — see the note above.
  const standing = await db.timetableEntry.findMany({
    where: {
      versionId,
      timeSlotId: { in: teachable.map((slot) => slot.id) },
    },
    select: {
      schoolClassId: true,
      timeSlotId: true,
      teacherId: true,
      roomId: true,
    },
  });

  const alreadyTimetabled = new Set<string>();
  for (const entry of standing) {
    alreadyTimetabled.add(entry.schoolClassId);
    busyClass.add(`${entry.schoolClassId}:${entry.timeSlotId}`);
    if (entry.teacherId) {
      busyTeacher.add(`${entry.teacherId}:${entry.timeSlotId}`);
    }
    if (entry.roomId) busyRoom.add(`${entry.roomId}:${entry.timeSlotId}`);
  }

  let created = 0;

  for (const [classIndex, klass] of classes.entries()) {
    if (klass.assignments.length === 0) continue;
    // A class that already has a week keeps it, untouched. Filling its gaps
    // would be the seed editing a grid somebody laid out — and since the rows
    // it writes carry a booking key of their own, "filling a gap" on re-run
    // means adding lessons, not settling on the same ones. Nothing to add is
    // what makes re-seeding a used database change nothing.
    if (alreadyTimetabled.has(klass.id)) continue;

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
              versionId_schoolClassId_timeSlotId_bookingKey: {
                versionId,
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
              versionId,
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

  log("weeks", `${weeks.length} taught weeks`);
  return weeks.length;
}

/**
 * The periods each teacher does not work — their horaire, as a school actually
 * negotiates it.
 *
 * Not everybody is available all week, and a demo where everybody is teaches
 * nothing about the constraint the generator has to respect. So a stable slice
 * of the staff gets a standing commitment: one has no Monday morning, the next
 * no Wednesday afternoon, and so on around the week.
 *
 * ── Why it blocks a session and not a period ────────────────────────────────
 * Because that is how the arrangement is actually made. Nobody is "unavailable
 * at 10:15"; they are away Wednesday afternoon, or they arrive after the first
 * two hours on a Monday. Blocking single periods scattered across the week
 * would be noise no timetable could work around and no head of studies would
 * recognise.
 *
 * Every third teacher, by index rather than at random, so a re-seed reproduces
 * the same horaires and therefore the same timetable. Only the standard bell
 * schedule: the Ramadan one is a different week and a school renegotiates it.
 *
 * Idempotent on (teacherId, timeSlotId), and it never clears a block somebody
 * set by hand — a seed does not overrule the office.
 */
export async function seedTeacherAvailability(
  db: SeedDb,
  {
    slots,
    teachers,
  }: {
    slots: SeededSlot[];
    teachers: { id: string }[];
  },
): Promise<number> {
  const teaching = slots.filter(
    (slot) => !slot.isBreak && slot.scheduleKind === "STANDARD",
  );
  if (teaching.length === 0) return 0;

  // The half-days that exist in this bell schedule, in a stable order, so the
  // rule below does not assume a six-day week or an afternoon session.
  const sessions = [
    ...new Map(
      teaching.map((slot) => [
        `${slot.dayOfWeek}:${slot.startTime < "12:00" ? "AM" : "PM"}`,
        slot,
      ]),
    ).keys(),
  ].sort();

  let written = 0;

  for (const [index, teacher] of teachers.entries()) {
    if (index % 3 !== 0) continue;

    const session = sessions[index % sessions.length];
    const [day, half] = session.split(":");

    const blocked = teaching.filter(
      (slot) =>
        String(slot.dayOfWeek) === day &&
        (slot.startTime < "12:00" ? "AM" : "PM") === half,
    );

    for (const slot of blocked) {
      await db.teacherUnavailability.upsert({
        where: {
          teacherId_timeSlotId: {
            teacherId: teacher.id,
            timeSlotId: slot.id,
          },
        },
        update: {},
        create: {
          teacherId: teacher.id,
          timeSlotId: slot.id,
          reason: half === "AM" ? "Indisponible le matin" : "Indisponible l'après-midi",
        },
      });
      written += 1;
    }
  }

  log("timetable", `${written} unavailable periods across the staff`);
  return written;
}
