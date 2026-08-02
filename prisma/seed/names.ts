/**
 * The Moroccan name vocabulary the roster is drawn from.
 *
 * Pure data, shared by the family and pupil seeds through `roster.ts`. It lives
 * here rather than in either module because neither owns it: a surname is not a
 * fact about families any more than about pupils, and duplicating the list in
 * both is how siblings end up with different names.
 *
 * Every entry carries its Arabic form. The app is trilingual and a class list
 * that reads correctly in French and falls back to a transliteration in Arabic
 * is exactly the sort of half-done data that hides an RTL bug.
 */

export type Name = { fr: string; ar: string };

/** Family names, used for a household and every child in it. */
export const SURNAMES: Name[] = [
  { fr: "Bennani", ar: "بناني" },
  { fr: "El Amrani", ar: "العمراني" },
  { fr: "Tazi", ar: "التازي" },
  { fr: "Ouazzani", ar: "الوزاني" },
  { fr: "Cherkaoui", ar: "الشرقاوي" },
  { fr: "Idrissi", ar: "الإدريسي" },
  { fr: "Sekkat", ar: "السقاط" },
  { fr: "Benjelloun", ar: "بنجلون" },
  { fr: "Lamrani", ar: "اللمراني" },
  { fr: "Zniber", ar: "زنيبر" },
  { fr: "Alaoui", ar: "العلوي" },
  { fr: "Berrada", ar: "بردة" },
  { fr: "El Fassi", ar: "الفاسي" },
  { fr: "Kabbaj", ar: "القباج" },
  { fr: "Lahlou", ar: "لحلو" },
  { fr: "Sqalli", ar: "الصقلي" },
  { fr: "Bouzoubaa", ar: "بوزوبع" },
  { fr: "Chraibi", ar: "الشرايبي" },
  { fr: "Benkirane", ar: "بنكيران" },
  { fr: "Naciri", ar: "الناصري" },
  { fr: "Mekouar", ar: "مكوار" },
  { fr: "Guessous", ar: "كسوس" },
  { fr: "Bouhlal", ar: "بوهلال" },
  { fr: "Belmekki", ar: "بلمكي" },
  { fr: "Hakimi", ar: "الحكيمي" },
  { fr: "Rachidi", ar: "الرشيدي" },
  { fr: "Saidi", ar: "السعيدي" },
  { fr: "Filali", ar: "الفيلالي" },
  { fr: "Berrechid", ar: "برشيد" },
  { fr: "Moutawakil", ar: "المتوكل" },
  { fr: "Skalli", ar: "السقلي" },
  { fr: "Benslimane", ar: "بنسليمان" },
  { fr: "El Ghazali", ar: "الغزالي" },
  { fr: "Draoui", ar: "الدراوي" },
  { fr: "Bekkali", ar: "البقالي" },
  { fr: "Hammadi", ar: "الحمادي" },
];

export const BOYS: Name[] = [
  { fr: "Adam", ar: "آدم" },
  { fr: "Ilyas", ar: "إلياس" },
  { fr: "Mehdi", ar: "مهدي" },
  { fr: "Rayan", ar: "ريان" },
  { fr: "Zakaria", ar: "زكرياء" },
  { fr: "Amine", ar: "أمين" },
  { fr: "Omar", ar: "عمر" },
  { fr: "Anas", ar: "أنس" },
  { fr: "Ismail", ar: "إسماعيل" },
  { fr: "Walid", ar: "وليد" },
  { fr: "Yassine", ar: "ياسين" },
  { fr: "Hamza", ar: "حمزة" },
  { fr: "Ayoub", ar: "أيوب" },
  { fr: "Bilal", ar: "بلال" },
  { fr: "Karim", ar: "كريم" },
  { fr: "Reda", ar: "رضى" },
  { fr: "Nabil", ar: "نبيل" },
  { fr: "Soufiane", ar: "سفيان" },
  { fr: "Taha", ar: "طه" },
  { fr: "Youssef", ar: "يوسف" },
  { fr: "Marouane", ar: "مروان" },
  { fr: "Othmane", ar: "عثمان" },
  { fr: "Mohammed", ar: "محمد" },
  { fr: "Abderrahim", ar: "عبد الرحيم" },
  { fr: "Badr", ar: "بدر" },
  { fr: "Nizar", ar: "نزار" },
];

export const GIRLS: Name[] = [
  { fr: "Lina", ar: "لينا" },
  { fr: "Yasmine", ar: "ياسمين" },
  { fr: "Sofia", ar: "صوفيا" },
  { fr: "Aya", ar: "آية" },
  { fr: "Malak", ar: "ملاك" },
  { fr: "Salma", ar: "سلمى" },
  { fr: "Hiba", ar: "هبة" },
  { fr: "Nour", ar: "نور" },
  { fr: "Douae", ar: "دعاء" },
  { fr: "Khadija", ar: "خديجة" },
  { fr: "Ines", ar: "إيناس" },
  { fr: "Rania", ar: "رانية" },
  { fr: "Meryem", ar: "مريم" },
  { fr: "Sara", ar: "سارة" },
  { fr: "Imane", ar: "إيمان" },
  { fr: "Ghita", ar: "غيثة" },
  { fr: "Chaimae", ar: "شيماء" },
  { fr: "Kenza", ar: "كنزة" },
  { fr: "Assia", ar: "آسية" },
  { fr: "Nada", ar: "ندى" },
  { fr: "Wiam", ar: "وئام" },
  { fr: "Zineb", ar: "زينب" },
  { fr: "Hafsa", ar: "حفصة" },
  { fr: "Amina", ar: "أمينة" },
  { fr: "Rim", ar: "ريم" },
  { fr: "Basma", ar: "بسمة" },
];

/** Adult given names, for the guardians on a dossier. */
export const FATHERS: string[] = [
  "Youssef", "Hicham", "Driss", "Rachid", "Khalid", "Abdellah",
  "Mustapha", "Said", "Aziz", "Noureddine", "Jamal", "Tarik",
  "Abdelaziz", "Mounir", "Larbi",
];

export const MOTHERS: string[] = [
  "Nadia", "Salma", "Imane", "Btissam", "Latifa", "Fatima Zahra",
  "Souad", "Naima", "Hakima", "Rajae", "Karima", "Samira",
  "Bouchra", "Malika", "Zohra",
];

export const PROFESSIONS: string[] = [
  "Ingénieur", "Pharmacienne", "Commerçant", "Enseignante", "Médecin",
  "Comptable", "Fonctionnaire", "Artisan", "Infirmière", "Avocat",
  "Architecte", "Technicien", "Gestionnaire", "Agriculteur", "Chauffeur",
  "Couturière", "Banquier", "Journaliste",
];

/** Street lines, paired with a quartier by the roster builder. */
export const STREETS: string[] = [
  "rue Ibn Batouta", "boulevard Zerktouni", "rue Al Farabi",
  "avenue Hassan II", "rue Oukaimeden", "boulevard Anfa",
  "rue Moulay Youssef", "avenue Mohammed V", "rue Ibn Sina",
  "boulevard Ghandi", "rue Jbel Toubkal", "avenue Al Massira",
  "rue Tarik Ibn Ziad", "boulevard Al Qods", "rue Assafa",
];

/**
 * Picks the nth entry of a pool, wrapping.
 *
 * Every choice in the roster is made this way rather than at random: the seed
 * must be idempotent, and a roster that re-rolls its names on each run would
 * upsert the same matricule onto a different child every time.
 */
export function pick<T>(pool: readonly T[], index: number): T {
  return pool[((index % pool.length) + pool.length) % pool.length];
}

/**
 * Scatters an index, so a pool picked along an arithmetic progression does not
 * come out in lockstep with it.
 *
 * The roster walks its pupils by rotating through the levels, which means the
 * pupils of one class sit at a fixed stride apart — and picking a name at
 * `index % pool.length` along a fixed stride yields a fixed cycle. The first
 * version of this seed produced a 1AP class of twenty-one boys sharing three
 * surnames, which is not a class list. A multiplicative hash breaks the
 * progression while staying a pure function of the index, so the roster is
 * still reproducible to the letter.
 */
export function spread(index: number): number {
  const mixed = Math.imul(index + 0x9e37, 0x27d4eb2d) >>> 0;
  return (mixed ^ (mixed >>> 15)) >>> 0;
}
