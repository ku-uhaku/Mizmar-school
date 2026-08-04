import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * One groupe scolaire, running the whole Moroccan cursus.
 */

export const SCHOOLS = [
  {
    code: "ALM-OUJDA",
    name: "Al Manar Oujda",
    level: "GROUP",
    city: "Oujda",
    region: "Oriental",
    postalCode: "60000",
    addressLine: "8, Boulevard Mohammed V",
    directorName: "Abdellah Berrada",
    capacity: 400,
    phone: "+212 536 68 90 12",
    email: "oujda@almanar.ma",
  },
] as const;

export async function seedSchools(db: SeedDb, organizationId: string) {
  const schools = [];

  for (const school of SCHOOLS) {
    const row = await db.school.upsert({
      where: { organizationId_code: { organizationId, code: school.code } },
      update: {},
      create: { organizationId, ...school },
    });

    /*
      An explicit settings row per school, created empty so every column takes
      its own default. The row is optional by design — `settingsOf` falls back
      to the same values — but seeding it means the configuration screen opens
      on something a demo can edit, and it proves the upsert path.

      `update: {}` for the same reason as the school above: a setting changed by
      hand survives a re-seed.
    */
    await db.schoolSettings.upsert({
      where: { schoolId: row.id },
      update: {},
      create: { schoolId: row.id },
    });

    schools.push(row);
  }

  log("schools", schools.length);
  return schools;
}
