import { log, type SeedDb } from "@/prisma/seed/client";

import { DEFAULT_SETTINGS, teachingDaysOf } from "@/lib/school-settings";
import {
  attendanceScopeKey,
  sessionScopeKey,
} from "@/modules/classroom/enums";
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
 *
 * ── The séances are the exception ───────────────────────────────────────────
 * Those *are* seeded per lesson, because there is one row per séance rather
 * than one per pupil: a fortnight of them is a few hundred rows, and without
 * them the cahier de textes and the period list are empty on the screen built
 * to show them. Only the last fortnight, and only the theme — the registers
 * underneath stay whole-day, for the reason above.
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

/**
 * What a cahier de textes actually reads like.
 *
 * Deliberately subject-neutral: a pool of physics chapters would be wrong
 * against اللغة العربية, and inventing a syllabus per matière is a great deal
 * of fiction to demonstrate a screen. These are the sentences that turn up in
 * every subject's cahier.
 */
const THEMES = [
  {
    theme: "Nouvelle leçon : découverte et application.",
    homework: "Relire la leçon et refaire les exercices traités en classe.",
  },
  {
    theme: "Exercices d'application et correction collective.",
    homework: "Terminer les exercices non corrigés.",
  },
  {
    theme: "Correction du devoir surveillé et remédiation.",
    homework: "Revoir les questions manquées.",
  },
  {
    theme: "Révision générale avant le contrôle.",
    homework: "Préparer le contrôle de la semaine prochaine.",
  },
  {
    theme: "Travail en groupes et mise en commun.",
    homework: "Rédiger le compte rendu de l'activité.",
  },
  {
    theme: "Évaluation diagnostique et reprise des acquis.",
    homework: null,
  },
] as const;

/**
 * The last teaching days of the year so far, newest first.
 *
 * Only a fortnight: the journal is read from the top and a term of séances is
 * rows nobody scrolls to. Bounded by today as well as by the term, so a seeded
 * school does not claim to have taught next month.
 */
function recentTeachingDays(
  terms: { startDate: Date; endDate: Date }[],
  count: number,
): Date[] {
  const teaching = teachingDaysOf(DEFAULT_SETTINGS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last = terms[terms.length - 1];
  if (!last) return [];

  const cursor = new Date(Math.min(today.getTime(), last.endDate.getTime()));
  cursor.setHours(0, 0, 0, 0);

  const first = terms[0]!.startDate;
  const days: Date[] = [];

  while (days.length < count && cursor >= first) {
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
    const inTerm = terms.some(
      (term) => cursor >= term.startDate && cursor <= term.endDate,
    );
    if (inTerm && teaching.includes(weekday as (typeof teaching)[number])) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return days;
}

/**
 * A fortnight of séances, with what was taught in them.
 *
 * Read from the grid rather than invented: a séance the timetable never planned
 * would show in the journal and nowhere else, and the period list would not
 * find it. Only the ACTIVE version's rows, for the reason every read of this
 * table gives — an untouched class's lesson exists once per version.
 */
async function seedSessions(
  db: SeedDb,
  schoolClassId: string,
  days: Date[],
): Promise<number> {
  const entries = await db.timetableEntry.findMany({
    where: {
      schoolClassId,
      version: { status: "ACTIVE" },
      timeSlot: { scheduleKind: "STANDARD", isBreak: false },
    },
    // Day then period, so the run that makes up a block is contiguous in the
    // array — position alone interleaves every weekday.
    orderBy: [
      { timeSlot: { dayOfWeek: "asc" } },
      { timeSlot: { position: "asc" } },
    ],
    select: {
      id: true,
      classGroupId: true,
      subjectId: true,
      teacherId: true,
      termId: true,
      timeSlot: {
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  });
  if (entries.length === 0) return 0;

  /*
    A double period is one séance, exactly as `listClassLessons` reads it: two
    consecutive hours of the same subject are one lesson, one theme and one
    appel. Seeding both halves would put a séance in the journal that the period
    list never offers, since the list merges the run and keys it on the hour it
    began.
  */
  const blockHeads = entries.filter((entry, index) => {
    const previous = entries[index - 1];
    return !(
      previous !== undefined &&
      previous.timeSlot.dayOfWeek === entry.timeSlot.dayOfWeek &&
      previous.timeSlot.endTime === entry.timeSlot.startTime &&
      previous.subjectId === entry.subjectId &&
      previous.teacherId === entry.teacherId &&
      previous.classGroupId === entry.classGroupId &&
      previous.termId === entry.termId
    );
  });

  let written = 0;

  for (const date of days) {
    const weekday = date.getDay() === 0 ? 7 : date.getDay();

    for (const entry of blockHeads) {
      if (entry.timeSlot.dayOfWeek !== weekday) continue;

      const pick =
        THEMES[
          Math.floor(
            unitOf(`${entry.id}:${date.toISOString().slice(0, 10)}`) *
              THEMES.length,
          )
        ]!;
      const scopeKey = sessionScopeKey(entry.timeSlot.id, entry.classGroupId);

      const data = {
        classGroupId: entry.classGroupId,
        timetableEntryId: entry.id,
        timeSlotId: entry.timeSlot.id,
        subjectId: entry.subjectId,
        teacherId: entry.teacherId,
        theme: pick.theme,
        homework: pick.homework,
        status: "HELD",
        // Closed, as a séance a teacher has finished with would be. The screen
        // opens on today, where nothing is seeded, so the demonstration still
        // has an empty register to take.
        closedAt: date,
        closedById: entry.teacherId,
      };

      await db.classSession.upsert({
        where: {
          schoolClassId_date_scopeKey: { schoolClassId, date, scopeKey },
        },
        create: { schoolClassId, date, scopeKey, ...data },
        update: data,
      });
      written += 1;
    }
  }

  return written;
}

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
): Promise<{ marks: number; remarks: number; sessions: number }> {
  const terms = await db.term.findMany({
    where: { id: { in: input.termIds } },
    orderBy: { number: "asc" },
    select: { startDate: true, endDate: true },
  });
  if (terms.length === 0) return { marks: 0, remarks: 0, sessions: 0 };

  /** A fortnight of teaching days, which is what the journal shows. */
  const recentDays = recentTeachingDays([...terms], 10);
  const recentKeys = new Set(recentDays.map((day) => day.getTime()));

  /*
    Every third teaching day, capped per term.

    Dense enough that each month of the term carries several marks — the
    dashboard's monthly line ignores a month with fewer than three, precisely so
    a term's last fortnight cannot read as a collapse — and far short of the
    hundred-odd mornings a real register holds.

    The recent fortnight is taken out: those days are seeded per period, with a
    theme on each séance, and a whole-day register on top of them would count
    every pupil twice — once against the day and once against each of its
    lessons. The two halves of the demonstration are the same school recording
    the same year two ways, a fortnight apart.
  */
  /*
    Never past today.

    A register is a record of a morning that happened. The year runs to June, so
    walking each term to its end wrote registers — and now séances — for dates
    months in the future, which read as a school that has already taken the
    appel for a lesson nobody has taught. Harmless while it was only a figure on
    a dashboard; plainly wrong the moment a cahier de textes lists it.
  */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = terms
    .flatMap((term) =>
      registerDays(
        term.startDate,
        term.endDate < today ? term.endDate : today,
        3,
        30,
      ),
    )
    .filter((day) => !recentKeys.has(day.getTime()));

  let marks = 0;
  let remarks = 0;
  let sessions = 0;

  for (const schoolClass of input.classes) {
    sessions += await seedSessions(db, schoolClass.id, recentDays);

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
      The whole-day séance each of those registers was taken in.

      It is what says the register happened at all: presence is the absence of a
      row, so without a séance a class where nobody was ever away is
      indistinguishable from a class nobody ever marked, and every rate on the
      pupil's file would read as "no data". One row per class per day.
    */
    const dayScopeKey = sessionScopeKey(null, null);
    const sessionByDay = new Map<number, string>();

    for (const date of days) {
      const held = {
        teacherId,
        status: "HELD",
        closedAt: date,
        closedById: teacherId,
      };
      const session = await db.classSession.upsert({
        where: {
          schoolClassId_date_scopeKey: {
            schoolClassId: schoolClass.id,
            date,
            scopeKey: dayScopeKey,
          },
        },
        create: {
          schoolClassId: schoolClass.id,
          date,
          scopeKey: dayScopeKey,
          ...held,
        },
        update: held,
        select: { id: true },
      });
      sessionByDay.set(date.getTime(), session.id);
      sessions += 1;
    }

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

    const register = roster
      .flatMap((enrolment) =>
        days
          .filter((date) => !marked.has(`${enrolment.id}:${date.getTime()}`))
          .map((date) => {
            const mark = statusFor(
              `${enrolment.id}:${date.toISOString().slice(0, 10)}`,
            );
            return {
              enrollmentId: enrolment.id,
              date,
              // The séance it was taken in, so the journal can count what each
              // register found rather than showing every day as untroubled.
              sessionId: sessionByDay.get(date.getTime()) ?? null,
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
      )
      // Presence is the absence of a row — see `saveSession`. Roughly seven
      // rows in eight of a real register are a child who simply turned up, and
      // writing them would be seeding a model the app no longer keeps.
      .filter((row) => row.status !== "PRESENT");

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

  log(
    "classroom",
    `${marks} register marks, ${remarks} remarks, ${sessions} séances`,
  );
  return { marks, remarks, sessions };
}
