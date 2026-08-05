import { log, type SeedDb } from "@/prisma/seed/client";

import { DEFAULT_SETTINGS, teachingDaysOf } from "@/lib/school-settings";
import { attendanceScopeKey } from "@/modules/classroom/enums";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";

/**
 * The register and the carnet de liaison.
 *
 * ── Why these are seeded at all ─────────────────────────────────────────────
 * The same reason the contrôles are — see modules/assessments/seed.ts. A
 * demonstration with a timetable, a roster and a year of receipts but an empty
 * register showed nothing at all on the half of the pupil's dashboard that is
 * about *being there*: no rate, no ring, no month-by-month line, and a carnet
 * with nothing in it.
 *
 * ── Why it is safe to re-run ────────────────────────────────────────────────
 * Every status is derived from a hash of the pupil and the day rather than from
 * `Math.random()`, so a re-run would write exactly what is already there — which
 * is why nothing is rewritten at all: the days already marked are read first and
 * only the gaps are filled, on `(enrollmentId, date, scopeKey)`. Remarks carry
 * no unique index (a teacher may legitimately write two on one day), so they are
 * matched on what the seed itself wrote before creating.
 *
 * ── What it deliberately does not do ────────────────────────────────────────
 * Whole-day marks only, with `timeSlotId` null. A per-lesson register is what a
 * collège actually keeps and what the teacher's workspace writes, but seeding
 * one would mean a row per pupil per period per day — tens of thousands of rows
 * to demonstrate a figure that reads identically either way.
 */

/** A deterministic 0..1 from a string — see the note in the assessments seed. */
function unitOf(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

/**
 * The days a register is taken on, thinned to keep the volume sane.
 *
 * Every `stride`th teaching day rather than all of them: the dashboard's
 * monthly line wants several months of evidence, not every morning of the year,
 * and a full register would be a hundred rows per pupil to say the same thing.
 */
function registerDays(
  startsOn: Date,
  endsOn: Date,
  stride: number,
  cap: number,
): Date[] {
  const teaching = teachingDaysOf(DEFAULT_SETTINGS);
  const days: Date[] = [];

  const cursor = new Date(startsOn);
  cursor.setHours(0, 0, 0, 0);
  let seen = 0;

  while (cursor <= endsOn && days.length < cap) {
    // `getDay()` is 0..6 from Sunday; the school's week is 1..7 from Monday.
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (teaching.includes(weekday as (typeof teaching)[number])) {
      if (seen % stride === 0) days.push(new Date(cursor));
      seen += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/**
 * What a school's register actually looks like: mostly present, a little
 * lateness, the occasional absence and fewer still with a paper behind them.
 */
function statusFor(seed: string): {
  status: string;
  minutesLate: number | null;
  isJustified: boolean;
  reason: string | null;
} {
  const roll = unitOf(seed);

  if (roll < 0.86) {
    return { status: "PRESENT", minutesLate: null, isJustified: false, reason: null };
  }
  if (roll < 0.93) {
    return {
      status: "LATE",
      // 5 to 25 minutes — a retard, not a morning missed.
      minutesLate: 5 + Math.floor(unitOf(`${seed}:late`) * 20),
      isJustified: false,
      reason: null,
    };
  }
  if (roll < 0.97) {
    return {
      status: "EXCUSED",
      minutesLate: null,
      isJustified: true,
      reason: "Certificat médical",
    };
  }
  return { status: "ABSENT", minutesLate: null, isJustified: false, reason: null };
}

/**
 * The sentences a carnet actually carries.
 *
 * Written out rather than generated, and in French, because these are read on
 * screen at a demonstration — a lorem ipsum carnet tells a head of studies
 * nothing about whether the screen is any use.
 */
const REMARKS = [
  {
    kind: "WORK",
    tone: "POSITIVE",
    body: "Travail sérieux et régulier ce trimestre. Participe volontiers à l'oral.",
    visible: true,
  },
  {
    kind: "BEHAVIOUR",
    tone: "CONCERN",
    body: "Bavardages répétés en fin d'heure. Averti à deux reprises.",
    visible: false,
  },
  {
    kind: "PROGRESS",
    tone: "POSITIVE",
    body: "Nets progrès depuis le premier contrôle. Continue ainsi.",
    visible: true,
  },
  {
    kind: "ATTENDANCE",
    tone: "CONCERN",
    body: "Plusieurs retards le matin. Merci de veiller à la ponctualité.",
    visible: true,
  },
  {
    kind: "WORK",
    tone: "CONCERN",
    body: "Devoirs non rendus à deux reprises. Doit se remettre à jour.",
    visible: false,
  },
  {
    kind: "OTHER",
    tone: "NEUTRAL",
    body: "A représenté la classe au concours de lecture.",
    visible: true,
  },
] as const;

export type SeedClassroomInput = {
  /** The staffed classes, as `seedClasses` returns them. */
  classes: {
    id: string;
    assignments: { subjectId: string; teacherId: string }[];
  }[];
  /** The year's terms, by id — their dates are read here. */
  termIds: string[];
};

export async function seedClassroom(
  db: SeedDb,
  input: SeedClassroomInput,
): Promise<{ marks: number; remarks: number }> {
  const terms = await db.term.findMany({
    where: { id: { in: input.termIds } },
    orderBy: { number: "asc" },
    select: { startDate: true, endDate: true },
  });
  if (terms.length === 0) return { marks: 0, remarks: 0 };

  /*
    Every third teaching day, capped per term.

    Dense enough that each month of the term carries several marks — the
    dashboard's monthly line ignores a month with fewer than three, precisely so
    a term's last fortnight cannot read as a collapse — and far short of the
    hundred-odd mornings a real register holds.
  */
  const days = terms.flatMap((term) =>
    registerDays(term.startDate, term.endDate, 3, 30),
  );

  let marks = 0;
  let remarks = 0;

  for (const schoolClass of input.classes) {
    const roster = await db.enrollment.findMany({
      where: {
        schoolClassId: schoolClass.id,
        status: { in: [...LIVE_ENROLMENT_STATUSES] },
      },
      select: { id: true },
    });
    if (roster.length === 0) continue;

    const teacherId = schoolClass.assignments[0]?.teacherId ?? null;
    const scopeKey = attendanceScopeKey(null);

    /*
      One read and one insert for the whole class, not an upsert per pupil per
      day. The register never changes on a re-run — the status is a hash of the
      pupil and the date — so the rows that exist need no write, and writing
      them anyway cost minutes over a seeded school. As `markDayInBulk` does in
      the RH module: read what is marked, insert the gaps.
    */
    const existing = await db.studentAttendance.findMany({
      where: {
        enrollmentId: { in: roster.map((enrolment) => enrolment.id) },
        scopeKey,
      },
      select: { enrollmentId: true, date: true },
    });
    const marked = new Set(
      existing.map((row) => `${row.enrollmentId}:${row.date.getTime()}`),
    );

    const register = roster.flatMap((enrolment) =>
      days
        .filter((date) => !marked.has(`${enrolment.id}:${date.getTime()}`))
        .map((date) => {
          const mark = statusFor(
            `${enrolment.id}:${date.toISOString().slice(0, 10)}`,
          );
          return {
            enrollmentId: enrolment.id,
            date,
            // Whole-day, so no slot and no subject — see the note above.
            timeSlotId: null,
            subjectId: null,
            status: mark.status,
            minutesLate: mark.minutesLate,
            reason: mark.reason,
            isJustified: mark.isJustified,
            recordedById: teacherId,
            scopeKey,
          };
        }),
    );

    if (register.length > 0) {
      const written = await db.studentAttendance.createMany({ data: register });
      marks += written.count;
    }

    for (const enrolment of roster) {

      /*
        Roughly half the class has something written about them, and those who
        do have one or two — a carnet in which every child has an entry is one
        nobody would believe.
      */
      const wanted = Math.floor(unitOf(`${enrolment.id}:remarks`) * 4);
      for (let index = 0; index < wanted; index += 1) {
        const template =
          REMARKS[
            Math.floor(unitOf(`${enrolment.id}:remark:${index}`) * REMARKS.length)
          ];
        const term = terms[index % terms.length];
        const occurredOn = new Date(term.startDate);
        occurredOn.setDate(
          occurredOn.getDate() +
            14 +
            Math.floor(unitOf(`${enrolment.id}:when:${index}`) * 60),
        );
        occurredOn.setHours(0, 0, 0, 0);

        const subjectId =
          schoolClass.assignments[index % schoolClass.assignments.length]
            ?.subjectId ?? null;

        // No unique index to upsert on — a teacher may write two remarks on one
        // day — so the seed matches what it wrote before rather than stacking a
        // second copy on every run.
        const already = await db.studentRemark.findFirst({
          where: {
            enrollmentId: enrolment.id,
            occurredOn,
            body: template.body,
          },
          select: { id: true },
        });
        if (already) continue;

        await db.studentRemark.create({
          data: {
            enrollmentId: enrolment.id,
            subjectId,
            kind: template.kind,
            tone: template.tone,
            body: template.body,
            occurredOn,
            isVisibleToFamily: template.visible,
            authorId: teacherId,
          },
        });
        remarks += 1;
      }
    }
  }

  log("classroom", `${marks} register marks, ${remarks} remarks`);
  return { marks, remarks };
}
