import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The children on the books, hung off the dossiers seeded before them.
 *
 * Idempotent — upserted on `(schoolId, code)`. `status` is left alone: it is
 * derived from the enrolments, and the enrolment seed refreshes it after
 * inscribing, exactly as an action would.
 *
 * The children themselves are built by `prisma/seed/roster.ts`, which sizes each
 * level's intake to the classes the school opens and hangs siblings off one
 * dossier. This file only knows how to write one.
 */

export type StudentSeed = {
  /** Matricule, and the key the seed is idempotent on. */
  code: string;
  /** Dossier this child belongs to. */
  familyCode: string;
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  gender: "MALE" | "FEMALE";
  /** Age in whole years at the start of the school year, used to pick a level. */
  age: number;
  /** Town of birth, by `City.code` — see modules/geography/seed.ts. */
  birthCityCode: string;
};

/**
 * A birth date that makes the child `age` at the start of the school year.
 *
 * Derived rather than hard-coded so re-seeding in a later year still produces a
 * 6-year-old in 1AP, instead of a demo database that ages out of its own levels.
 */
function birthDateFor(yearStart: Date, age: number): Date {
  return new Date(yearStart.getFullYear() - age, 8, 15);
}

export async function seedStudents(
  db: SeedDb,
  {
    schoolId,
    yearStart,
    familyIdByCode,
    cityIdByCode,
    students,
  }: {
    schoolId: string;
    yearStart: Date;
    familyIdByCode: Record<string, string>;
    cityIdByCode: Record<string, string>;
    students: StudentSeed[];
  },
): Promise<Record<string, { id: string; age: number }>> {
  const byCode: Record<string, { id: string; age: number }> = {};

  for (const seed of students) {
    const familyId = familyIdByCode[seed.familyCode];
    if (!familyId) continue;

    const data = {
      familyId,
      firstName: seed.firstName,
      lastName: seed.lastName,
      firstNameAr: seed.firstNameAr,
      lastNameAr: seed.lastNameAr,
      gender: seed.gender,
      birthDate: birthDateFor(yearStart, seed.age),
      birthCityId: cityIdByCode[seed.birthCityCode] ?? null,
      entryDate: yearStart,
    };

    const student = await db.student.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      // `status` is deliberately absent: it is derived from the enrolments.
      update: data,
      create: { schoolId, code: seed.code, ...data },
      select: { id: true },
    });

    byCode[seed.code] = { id: student.id, age: seed.age };
  }

  log("students", Object.keys(byCode).length);
  return byCode;
}
