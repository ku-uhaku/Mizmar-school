import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Two schools, deliberately unalike: a groupe scolaire running every cycle, and
 * a preschool-and-primary school. Configuration is per school, and two schools
 * with identical setups would prove nothing.
 */

export const SCHOOLS = [
  {
    code: "ALM-CASA",
    name: "Al Manar Casablanca",
    level: "GROUP",
    city: "Casablanca",
    region: "Casablanca-Settat",
    postalCode: "20250",
    addressLine: "12, Boulevard Zerktouni",
    directorName: "Nadia Benali",
    capacity: 1200,
    phone: "+212 522 45 67 90",
    email: "casablanca@almanar.ma",
  },
  {
    code: "ALM-RABAT",
    name: "Al Manar Rabat Agdal",
    level: "PRIMARY",
    city: "Rabat",
    region: "Rabat-Salé-Kénitra",
    postalCode: "10090",
    addressLine: "45, Avenue de France, Agdal",
    directorName: "Youssef El Amrani",
    capacity: 420,
    phone: "+212 537 77 12 34",
    email: "rabat@almanar.ma",
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
