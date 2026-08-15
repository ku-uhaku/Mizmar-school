import {
  MOROCCAN_CITIES,
  MOROCCAN_NEIGHBOURHOODS,
  type CitySeed,
  type NeighbourhoodSeed,
} from "@/modules/geography/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The towns and quartiers, written for one school.
 *
 * The lists themselves are `presets.ts` — pure data the setup wizard writes
 * too, so a school configured through the screens starts from the same
 * geography as a seeded one.
 */

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

export async function seedNeighbourhoods(
  db: SeedDb,
  schoolId: string,
  cityIdByCode: Record<string, string>,
  /**
   * The town the school stands in. Given, only its quartiers are laid down.
   *
   * ── Why this is not optional in practice ────────────────────────────────────
   * The towns are seeded in full on purpose: a birthplace is anywhere, so the
   * city list has to cover the country. A quartier is not — it is a residential
   * address, and the only addresses a school records are the ones its pupils
   * live at. Seeding all thirteen gave a school in Oujda a Quartiers screen
   * two-thirds full of Maârif, Anfa and Agdal: rows no pupil, no bus stop and
   * no route ever referenced, sitting in front of the five that mattered every
   * time a secretary opened the dropdown.
   *
   * The rest of the seed already worked this way — `buildRoster` takes only the
   * town's quartiers, and `seedTransport` picks its lines by `cityCode`. This
   * was the one step that ignored the school's town.
   */
  cityCode?: string,
  neighbourhoods: NeighbourhoodSeed[] = MOROCCAN_NEIGHBOURHOODS,
): Promise<Record<string, string>> {
  const idByCode: Record<string, string> = {};

  const wanted = cityCode
    ? neighbourhoods.filter((quartier) => quartier.cityCode === cityCode)
    : neighbourhoods;

  for (const neighbourhood of wanted) {
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
