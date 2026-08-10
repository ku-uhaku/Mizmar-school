import {
  TERM_NAMES_2,
  termSpans,
  termStatus,
} from "@/modules/school-years/presets";
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
    for (const [index, term] of TERM_NAMES_2.entries()) {
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

  log("school years", `${seeded.length} × ${TERM_NAMES_2.length} terms`);
  return seeded;
}
