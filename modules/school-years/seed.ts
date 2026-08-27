import {
  TERM_NAMES_2,
  termSpans,
  termStatus,
} from "@/modules/school-years/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Two school years per school — the one just finished and the one being
 * taught — each split into the two semesters Moroccan schools work in.
 *
 * Two rather than one because a year is the unit every screen scopes itself
 * by, and a database holding a single year can never show that: the year
 * switcher has nothing to switch to, "l'an dernier" is empty everywhere, and a
 * closed year — whose marks are locked and whose receipts are history — is a
 * state no screen is ever seen in. The closed one comes first so the app opens
 * on the running year, which is the `isDefault` one.
 *
 * Two and not three: everything year-scoped is seeded once per year, so each
 * extra year is another full roster, timetable and année de recettes. Two is
 * what it takes to make the distinction visible; the third only makes the seed
 * slower.
 */

export type YearSeed = {
  name: string;
  start: string;
  end: string;
  status: string;
  isDefault: boolean;
};

export const YEARS: YearSeed[] = [
  // Closed, and seeded in full: last year's class lists, marks and receipts are
  // what makes "the year before" a thing you can open rather than a filter that
  // returns nothing.
  { name: "2025-2026", start: "2025-03-05", end: "2026-02-17", status: "CLOSED", isDefault: false },
  // The running year, and the one a session opens on.
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
