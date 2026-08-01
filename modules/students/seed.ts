import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The children on the books, hung off the dossiers seeded before them.
 *
 * Idempotent — upserted on `(schoolId, code)`. `status` is left alone: it is
 * derived from the enrolments, and the enrolment seed refreshes it after
 * inscribing, exactly as an action would.
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
 * Names are drawn from the families above so siblings share a surname — which
 * is what makes the sibling reduction demonstrable, and the class lists read
 * like real ones.
 */
export const STUDENT_SEEDS: StudentSeed[] = [
  { code: "E-2025-0001", familyCode: "F-2025-0001", firstName: "Adam", lastName: "Bennani", firstNameAr: "آدم", lastNameAr: "بناني", gender: "MALE", age: 6, birthCityCode: "CASA" },
  { code: "E-2025-0002", familyCode: "F-2025-0001", firstName: "Lina", lastName: "Bennani", firstNameAr: "لينا", lastNameAr: "بناني", gender: "FEMALE", age: 9, birthCityCode: "CASA" },
  { code: "E-2025-0003", familyCode: "F-2025-0001", firstName: "Ilyas", lastName: "Bennani", firstNameAr: "إلياس", lastNameAr: "بناني", gender: "MALE", age: 13, birthCityCode: "CASA" },
  { code: "E-2025-0004", familyCode: "F-2025-0002", firstName: "Yasmine", lastName: "El Amrani", firstNameAr: "ياسمين", lastNameAr: "العمراني", gender: "FEMALE", age: 7, birthCityCode: "CASA" },
  { code: "E-2025-0005", familyCode: "F-2025-0002", firstName: "Mehdi", lastName: "El Amrani", firstNameAr: "مهدي", lastNameAr: "العمراني", gender: "MALE", age: 11, birthCityCode: "CASA" },
  { code: "E-2025-0006", familyCode: "F-2025-0003", firstName: "Sofia", lastName: "Tazi", firstNameAr: "صوفيا", lastNameAr: "التازي", gender: "FEMALE", age: 15, birthCityCode: "CASA" },
  { code: "E-2025-0007", familyCode: "F-2025-0003", firstName: "Rayan", lastName: "Tazi", firstNameAr: "ريان", lastNameAr: "التازي", gender: "MALE", age: 8, birthCityCode: "CASA" },
  { code: "E-2025-0008", familyCode: "F-2025-0004", firstName: "Aya", lastName: "Ouazzani", firstNameAr: "آية", lastNameAr: "الوزاني", gender: "FEMALE", age: 10, birthCityCode: "CASA" },
  { code: "E-2025-0009", familyCode: "F-2025-0004", firstName: "Zakaria", lastName: "Ouazzani", firstNameAr: "زكرياء", lastNameAr: "الوزاني", gender: "MALE", age: 16, birthCityCode: "CASA" },
  { code: "E-2025-0010", familyCode: "F-2025-0005", firstName: "Malak", lastName: "Cherkaoui", firstNameAr: "ملاك", lastNameAr: "الشرقاوي", gender: "FEMALE", age: 12, birthCityCode: "CASA" },
  { code: "E-2025-0011", familyCode: "F-2025-0005", firstName: "Amine", lastName: "Cherkaoui", firstNameAr: "أمين", lastNameAr: "الشرقاوي", gender: "MALE", age: 17, birthCityCode: "CASA" },
  { code: "E-2025-0012", familyCode: "F-2025-0006", firstName: "Salma", lastName: "Idrissi", firstNameAr: "سلمى", lastNameAr: "الإدريسي", gender: "FEMALE", age: 6, birthCityCode: "CASA" },
  { code: "E-2025-0013", familyCode: "F-2025-0006", firstName: "Omar", lastName: "Idrissi", firstNameAr: "عمر", lastNameAr: "الإدريسي", gender: "MALE", age: 14, birthCityCode: "CASA" },
  { code: "E-2025-0014", familyCode: "F-2025-0007", firstName: "Hiba", lastName: "Sekkat", firstNameAr: "هبة", lastNameAr: "السقاط", gender: "FEMALE", age: 5, birthCityCode: "RABAT" },
  { code: "E-2025-0015", familyCode: "F-2025-0007", firstName: "Anas", lastName: "Sekkat", firstNameAr: "أنس", lastNameAr: "السقاط", gender: "MALE", age: 8, birthCityCode: "RABAT" },
  { code: "E-2025-0016", familyCode: "F-2025-0008", firstName: "Nour", lastName: "Benjelloun", firstNameAr: "نور", lastNameAr: "بنجلون", gender: "FEMALE", age: 7, birthCityCode: "RABAT" },
  { code: "E-2025-0017", familyCode: "F-2025-0008", firstName: "Ismail", lastName: "Benjelloun", firstNameAr: "إسماعيل", lastNameAr: "بنجلون", gender: "MALE", age: 10, birthCityCode: "RABAT" },
  { code: "E-2025-0018", familyCode: "F-2025-0009", firstName: "Douae", lastName: "Lamrani", firstNameAr: "دعاء", lastNameAr: "العمراني", gender: "FEMALE", age: 9, birthCityCode: "RABAT" },
  { code: "E-2025-0019", familyCode: "F-2025-0010", firstName: "Walid", lastName: "Zniber", firstNameAr: "وليد", lastNameAr: "زنيبر", gender: "MALE", age: 6, birthCityCode: "RABAT" },
  { code: "E-2025-0020", familyCode: "F-2025-0010", firstName: "Khadija", lastName: "Zniber", firstNameAr: "خديجة", lastNameAr: "زنيبر", gender: "FEMALE", age: 11, birthCityCode: "RABAT" },
];

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
