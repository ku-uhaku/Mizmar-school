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
  { name: "2026-2027", start: "2026-09-07", end: "2027-07-02", status: "ACTIVE", isDefault: true },
];

/** Semesters, expressed as offsets so they follow whichever year they belong to. */
const TERMS = [
  { number: 1, name: "Semestre 1", nameAr: "الدورة الأولى", startMonth: 8, endMonth: 0 },
  { number: 2, name: "Semestre 2", nameAr: "الدورة الثانية", startMonth: 1, endMonth: 6 },
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
      update: { status: year.status, isDefault: year.isDefault },
      create: {
        schoolId,
        name: year.name,
        startDate: start,
        endDate: end,
        status: year.status,
        isDefault: year.isDefault,
      },
    });

    const terms: Record<number, string> = {};
    for (const term of TERMS) {
      // Semester 1 runs Sept → Jan of the following calendar year; semester 2
      // Feb → the end of the school year.
      const termStart =
        term.number === 1
          ? start
          : new Date(end.getFullYear(), term.startMonth, 1);
      const termEnd =
        term.number === 1
          ? new Date(end.getFullYear(), term.endMonth, 23)
          : end;

      const termRow = await db.term.upsert({
        where: { schoolYearId_number: { schoolYearId: row.id, number: term.number } },
        update: {
          name: term.name,
          nameAr: term.nameAr,
          startDate: termStart,
          endDate: termEnd,
          // Only the running year has a live semester.
          status:
            year.status === "ACTIVE"
              ? term.number === 1
                ? "ACTIVE"
                : "PLANNED"
              : year.status,
        },
        create: {
          schoolYearId: row.id,
          number: term.number,
          name: term.name,
          nameAr: term.nameAr,
          startDate: termStart,
          endDate: termEnd,
          status:
            year.status === "ACTIVE"
              ? term.number === 1
                ? "ACTIVE"
                : "PLANNED"
              : year.status,
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
