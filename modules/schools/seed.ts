import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The group's two établissements, both running the whole Moroccan cursus.
 *
 * They exist to be different in exactly one way, and it is the difference the
 * demonstration is about: Oujda is a school in its second term — a staff, four
 * hundred pupils, a timetable and a year of receipts — and Casablanca is the
 * same school on the day before it opens, fully configured and with nobody in
 * it yet. Which of the two gets populated is not decided here; `prisma/seed.ts`
 * declares a `SchoolPlan` for Oujda and none for Casablanca, and a school with
 * no plan is configured and left empty.
 *
 * Casablanca is the group's own town — see `seedOrganization` — so the second
 * school is the siège's, which is also why its quartiers are the ones the
 * geography seed lays for it.
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
  {
    code: "ALM-CASA",
    name: "Al Manar Casablanca",
    level: "GROUP",
    city: "Casablanca",
    region: "Casablanca-Settat",
    postalCode: "20250",
    addressLine: "45, Rue Ibn Batouta, Maârif",
    directorName: "Nadia Benjelloun",
    capacity: 400,
    phone: "+212 522 98 41 33",
    email: "casablanca@almanar.ma",
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
