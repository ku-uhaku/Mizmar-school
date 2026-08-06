import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * One school year per school — the one being taught — split into the two
 * semesters Moroccan schools work in.
 *
 * A single year rather than a closed / running / planned trio: everything
 * year-scoped is seeded three times over otherwise, and a demo database whose
 * pupil counts are three parallel realities is harder to read than one school
 * year with a full class list behind it. The app handles several years — the
 * screens are all year-scoped — but proving that is the tests' job, not the
 * seed's.
 */

export type YearSeed = {
  name: string;
  start: string;
  end: string;
  status: string;
  isDefault: boolean;
};

export const YEARS: YearSeed[] = [
  { name: "2026-2027", start: "2026-03-05", end: "2027-02-17", status: "ACTIVE", isDefault: true },
];

/**
 * The semesters, named only — their dates are a split of whatever span the year
 * declares.
 *
 * They used to be written as calendar months, which quietly assumed a September
 * rentrée: a year running March to February came out as an eleven-month first
 * semester and a seventeen-day second. Halving the span instead is right for any
 * shape of year, and it is the same arithmetic a school does on paper.
 */
const TERMS = [
  { number: 1, name: "Semestre 1", nameAr: "الدورة الأولى" },
  { number: 2, name: "Semestre 2", nameAr: "الدورة الثانية" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The two halves of a year, back to back with no gap and no overlap.
 *
 * Semester 1 takes the first half and semester 2 the rest, so the pair always
 * covers the year exactly — a mark or an absence dated anywhere in the year
 * falls in precisely one of them, which is what every screen that groups by
 * semester relies on.
 */
function termSpans(start: Date, end: Date): { start: Date; end: Date }[] {
  const midpoint = addDays(start, Math.floor((end.getTime() - start.getTime()) / DAY_MS / 2));
  return [
    { start, end: midpoint },
    { start: addDays(midpoint, 1), end },
  ];
}

/**
 * Which semester is running, by today's date.
 *
 * Derived rather than hardcoded so the demonstration reads as a school in the
 * middle of its year whenever it is seeded — the first semester was pinned
 * ACTIVE, which was only true while the year happened to start in September.
 * A year seeded before it opens or after it closes falls back to its first
 * semester, since a year marked ACTIVE with no live term is a state no screen
 * expects.
 */
function termStatus(
  yearStatus: string,
  span: { start: Date; end: Date },
  isFirst: boolean,
  now: Date,
): string {
  if (yearStatus !== "ACTIVE") return yearStatus;
  if (now >= span.start && now <= span.end) return "ACTIVE";
  if (now > span.end) return "CLOSED";
  return isFirst ? "ACTIVE" : "PLANNED";
}

export type SeededYear = {
  id: string;
  name: string;
  status: string;
  /** Carried through so later seeds can date rows against the year rather than
   *  against today — an enrolment's ages and due dates both hang off it. */
  startDate: Date;
  endDate: Date;
  /** Term number → id. */
  terms: Record<number, string>;
};

export async function seedSchoolYears(
  db: SeedDb,
  schoolId: string,
): Promise<SeededYear[]> {
  const seeded: SeededYear[] = [];

  for (const year of YEARS) {
    const start = new Date(year.start);
    const end = new Date(year.end);

    const row = await db.schoolYear.upsert({
      where: { schoolId_name: { schoolId, name: year.name } },
      // The dates are updated as well as created: moving the demonstration's
      // year is the whole reason somebody edits `YEARS`, and leaving them out
      // meant a re-seed silently kept the span the row was first written with.
      update: {
        startDate: start,
        endDate: end,
        status: year.status,
        isDefault: year.isDefault,
      },
      create: {
        schoolId,
        name: year.name,
        startDate: start,
        endDate: end,
        status: year.status,
        isDefault: year.isDefault,
      },
    });

    const spans = termSpans(start, end);
    const now = new Date();

    const terms: Record<number, string> = {};
    for (const [index, term] of TERMS.entries()) {
      const span = spans[index];
      const status = termStatus(year.status, span, index === 0, now);

      const termRow = await db.term.upsert({
        where: { schoolYearId_number: { schoolYearId: row.id, number: term.number } },
        update: {
          name: term.name,
          nameAr: term.nameAr,
          startDate: span.start,
          endDate: span.end,
          status,
        },
        create: {
          schoolYearId: row.id,
          number: term.number,
          name: term.name,
          nameAr: term.nameAr,
          startDate: span.start,
          endDate: span.end,
          status,
        },
      });
      terms[term.number] = termRow.id;
    }

    seeded.push({
      id: row.id,
      name: row.name,
      status: row.status,
      startDate: start,
      endDate: end,
      terms,
    });
  }

  log("school years", `${seeded.length} × ${TERMS.length} terms`);
  return seeded;
}
