/**
 * The towns and quartiers a school starts from.
 *
 * Pure data, so both writers can share one list: `seed.ts` lays it down for the
 * demonstration, and the setup wizard writes the same rows for a school created
 * through the screens. A second copy under `modules/setup` would be a city list
 * that drifted from the one the seed uses within a release.
 */

export type CitySeed = { code: string; name: string; nameAr: string; region: string };

/**
 * A starting list of towns, so the pupil form has something to pick from on the
 * first day rather than an empty dropdown and a secretary who cannot save.
 *
 * The dozen largest Moroccan cities and nothing more — a school adds the douar
 * its pupils actually come from, and a list of every commune in the kingdom
 * would bury it.
 */
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
 * A town's code from the name a school records itself as standing in.
 *
 * `School.city` is free text — a school types where it is — so the caller has to
 * meet it on the name rather than on a code it never had. Undefined for a town
 * outside the starting list, which leaves the quartier list unfiltered rather
 * than silently laying down none.
 */
export function cityCodeByName(name: string | null): string | undefined {
  if (!name) return undefined;
  return MOROCCAN_CITIES.find(
    (city) => city.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  )?.code;
}

/**
 * Quartiers for each town a school might stand in, so the bus stops the
 * transport seed lays down have somewhere to be.
 *
 * The whole list is never given to one school — both writers take the town and
 * lay down only its own. Keyed on the city *code* rather than an id, so the
 * caller passes the map the city write just returned and the two stay in step.
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
  { cityCode: "OUJDA", code: "SIDI-YAHYA", name: "Sidi Yahya", nameAr: "سيدي يحيى" },
  { cityCode: "OUJDA", code: "AL-QODS", name: "Al Qods", nameAr: "القدس" },
  { cityCode: "OUJDA", code: "LAZARET", name: "Lazaret", nameAr: "لازاريت" },
  { cityCode: "OUJDA", code: "HAY-SALAM", name: "Hay Salam", nameAr: "حي السلام" },
  { cityCode: "OUJDA", code: "AL-MASSIRA", name: "Al Massira", nameAr: "المسيرة" },
];
