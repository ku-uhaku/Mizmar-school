import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * A starting list of towns, so the pupil form has something to pick from on the
 * first day rather than an empty dropdown and a secretary who cannot save.
 *
 * The dozen largest Moroccan cities and nothing more — a school adds the douar
 * its pupils actually come from, and a seed that shipped every commune in the
 * kingdom would bury it.
 */

export type CitySeed = { code: string; name: string; nameAr: string; region: string };

export const MOROCCAN_CITIES: CitySeed[] = [
  { code: "CASA", name: "Casablanca", nameAr: "الدار البيضاء", region: "Casablanca-Settat" },
  { code: "RABAT", name: "Rabat", nameAr: "الرباط", region: "Rabat-Salé-Kénitra" },
  { code: "FES", name: "Fès", nameAr: "فاس", region: "Fès-Meknès" },
  { code: "MARRAKECH", name: "Marrakech", nameAr: "مراكش", region: "Marrakech-Safi" },
  { code: "TANGER", name: "Tanger", nameAr: "طنجة", region: "Tanger-Tétouan-Al Hoceïma" },
  { code: "AGADIR", name: "Agadir", nameAr: "أكادير", region: "Souss-Massa" },
  { code: "MEKNES", name: "Meknès", nameAr: "مكناس", region: "Fès-Meknès" },
  { code: "OUJDA", name: "Oujda", nameAr: "وجدة", region: "Oriental" },
  { code: "KENITRA", name: "Kénitra", nameAr: "القنيطرة", region: "Rabat-Salé-Kénitra" },
  { code: "TETOUAN", name: "Tétouan", nameAr: "تطوان", region: "Tanger-Tétouan-Al Hoceïma" },
  { code: "SALE", name: "Salé", nameAr: "سلا", region: "Rabat-Salé-Kénitra" },
  { code: "MOHAMMEDIA", name: "Mohammedia", nameAr: "المحمدية", region: "Casablanca-Settat" },
];

/**
 * Towns for one school. Returns the ids by code, for the pupils that follow.
 *
 * Upserts on the *name*, not the code: the migration that introduced this table
 * backfilled a row per town already typed into a pupil's file, keyed on a code
 * derived from the name ("CASABLANCA"). Matching on the name lets this hand that
 * row its proper code and its Arabic spelling instead of colliding with it.
 */
export async function seedCities(
  db: SeedDb,
  schoolId: string,
  cities: CitySeed[] = MOROCCAN_CITIES,
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};

  for (const city of cities) {
    const row = await db.city.upsert({
      where: { schoolId_name: { schoolId, name: city.name } },
      update: { code: city.code, nameAr: city.nameAr, region: city.region },
      create: {
        schoolId,
        code: city.code,
        name: city.name,
        nameAr: city.nameAr,
        region: city.region,
      },
    });
    idByCode[city.code] = row.id;
  }

  log("cities", cities.length);
  return idByCode;
}

/**
 * A few quartiers of Casablanca and Rabat, so the bus stops the transport seed
 * lays down have somewhere to be.
 *
 * Keyed on the city *code* rather than an id, so the caller passes the map
 * `seedCities` just returned and the two stay in step.
 */
export type NeighbourhoodSeed = {
  cityCode: string;
  code: string;
  name: string;
  nameAr: string;
};

export const MOROCCAN_NEIGHBOURHOODS: NeighbourhoodSeed[] = [
  { cityCode: "CASA", code: "MAARIF", name: "Maârif", nameAr: "المعاريف" },
  { cityCode: "CASA", code: "ANFA", name: "Anfa", nameAr: "أنفا" },
  { cityCode: "CASA", code: "AIN-DIAB", name: "Aïn Diab", nameAr: "عين الذياب" },
  { cityCode: "CASA", code: "SIDI-MAAROUF", name: "Sidi Maârouf", nameAr: "سيدي معروف" },
  { cityCode: "CASA", code: "BOURGOGNE", name: "Bourgogne", nameAr: "بورغون" },
  { cityCode: "RABAT", code: "AGDAL", name: "Agdal", nameAr: "أكدال" },
  { cityCode: "RABAT", code: "HASSAN", name: "Hassan", nameAr: "حسان" },
  { cityCode: "RABAT", code: "SOUISSI", name: "Souissi", nameAr: "السويسي" },
];

export async function seedNeighbourhoods(
  db: SeedDb,
  schoolId: string,
  cityIdByCode: Record<string, string>,
  neighbourhoods: NeighbourhoodSeed[] = MOROCCAN_NEIGHBOURHOODS,
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};

  for (const neighbourhood of neighbourhoods) {
    const cityId = cityIdByCode[neighbourhood.cityCode];
    // A school whose city list was trimmed simply has fewer quartiers, rather
    // than a seed that dies on a missing key.
    if (!cityId) continue;

    const row = await db.neighbourhood.upsert({
      where: { schoolId_code: { schoolId, code: neighbourhood.code } },
      update: {
        cityId,
        name: neighbourhood.name,
        nameAr: neighbourhood.nameAr,
      },
      create: {
        schoolId,
        cityId,
        code: neighbourhood.code,
        name: neighbourhood.name,
        nameAr: neighbourhood.nameAr,
      },
    });
    idByCode[neighbourhood.code] = row.id;
  }

  log("neighbourhoods", Object.keys(idByCode).length);
  return idByCode;
}
