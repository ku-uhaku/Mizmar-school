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
 *
 * ── Sized for the school, not for a sample ──────────────────────────────────
 * The demonstration seats 432 pupils in some 205 dossiers, which is upwards of
 * 800 people once the guardians are counted. Pools of thirty produced a class
 * list with four Bennani boys on it — the sort of data that makes a reader
 * distrust every screen it appears on. These are large enough that
 * `buildRoster`'s uniqueness guard almost never has to intervene; it is there
 * for the almost.
 *
 * ── Disjoint from the staff ─────────────────────────────────────────────────
 * None of these surnames appears in the teacher pool (`FIRST_NAMES` /
 * `LAST_NAMES` in modules/users/seed.ts), among the office accounts seeded
 * there, or in `STAFF_SEEDS` in modules/hr/seed.ts. That is what keeps a pupil
 * from turning up under the same full name as their own maths teacher, without
 * either seed having to know about the other. Adding a surname here means
 * checking it against those three lists.
 */

export type Name = { fr: string; ar: string };

/** Family names, used for a household and every child in it. */
export const SURNAMES: Name[] = [
  { fr: "Bennani", ar: "بناني" },
  { fr: "Ouazzani", ar: "الوزاني" },
  { fr: "Cherkaoui", ar: "الشرقاوي" },
  { fr: "Sekkat", ar: "السقاط" },
  { fr: "Benjelloun", ar: "بنجلون" },
  { fr: "Zniber", ar: "زنيبر" },
  { fr: "Kabbaj", ar: "القباج" },
  { fr: "Bouzoubaa", ar: "بوزوبع" },
  { fr: "Benkirane", ar: "بنكيران" },
  { fr: "Mekouar", ar: "مكوار" },
  { fr: "Guessous", ar: "كسوس" },
  { fr: "Bouhlal", ar: "بوهلال" },
  { fr: "Belmekki", ar: "بلمكي" },
  { fr: "Hakimi", ar: "الحكيمي" },
  { fr: "Rachidi", ar: "الرشيدي" },
  { fr: "Saidi", ar: "السعيدي" },
  { fr: "Berrechid", ar: "برشيد" },
  { fr: "Moutawakil", ar: "المتوكل" },
  { fr: "Benslimane", ar: "بنسليمان" },
  { fr: "El Ghazali", ar: "الغزالي" },
  { fr: "Draoui", ar: "الدراوي" },
  { fr: "Bekkali", ar: "البقالي" },
  { fr: "Hammadi", ar: "الحمادي" },
  { fr: "Belkhayat", ar: "بلخياط" },
  { fr: "Tahiri", ar: "الطاهري" },
  { fr: "Benabdellah", ar: "بنعبد الله" },
  { fr: "Sefrioui", ar: "السفريوي" },
  { fr: "Lazrak", ar: "الأزرق" },
  { fr: "Benchekroun", ar: "بنشقرون" },
  { fr: "Mrabet", ar: "المرابط" },
  { fr: "Belghiti", ar: "البغيطي" },
  { fr: "Alami", ar: "العلمي" },
  { fr: "Slaoui", ar: "السلاوي" },
  { fr: "Doukkali", ar: "الدكالي" },
  { fr: "Marrakchi", ar: "المراكشي" },
  { fr: "Meknassi", ar: "المكناسي" },
  { fr: "Ghallab", ar: "غلاب" },
  { fr: "Sbihi", ar: "السبيهي" },
  { fr: "Kadiri", ar: "القادري" },
  { fr: "Boukhris", ar: "بوخريص" },
  { fr: "Aissaoui", ar: "العيساوي" },
  { fr: "Hachimi", ar: "الهاشمي" },
  { fr: "Semlali", ar: "السملالي" },
  { fr: "Chaoui", ar: "الشاوي" },
  { fr: "Bargach", ar: "برݣاش" },
  { fr: "Tounsi", ar: "التونسي" },
  { fr: "Ait Taleb", ar: "آيت طالب" },
  { fr: "Benhima", ar: "بنهيمة" },
  { fr: "Lakhdar", ar: "الأخضر" },
  { fr: "Zerouali", ar: "الزروالي" },
  { fr: "Boutaleb", ar: "بوطالب" },
  { fr: "Nejjar", ar: "النجار" },
  { fr: "Attar", ar: "العطار" },
  { fr: "Fenjiro", ar: "فنجيرو" },
  { fr: "Bensouda", ar: "بنسودة" },
  { fr: "Belfqih", ar: "بلفقيه" },
  { fr: "Harrak", ar: "الحراق" },
  { fr: "Karam", ar: "كرم" },
  { fr: "Mansouri", ar: "المنصوري" },
  { fr: "Hassani", ar: "الحسني" },
  { fr: "Ammari", ar: "العماري" },
  { fr: "Zouiten", ar: "الزويتن" },
  { fr: "Benmoussa", ar: "بنموسى" },
  { fr: "Talbi", ar: "الطالبي" },
  { fr: "Riahi", ar: "الرياحي" },
  { fr: "Jaidi", ar: "الجعيدي" },
  { fr: "Benaissa", ar: "بنعيسى" },
  { fr: "Ouahbi", ar: "الوهبي" },
  { fr: "Serghini", ar: "الصرغيني" },
  { fr: "Bahri", ar: "البحري" },
  { fr: "Loukili", ar: "اللوكيلي" },
  { fr: "Dahbi", ar: "الذهبي" },
  { fr: "Kabbouri", ar: "القبوري" },
  { fr: "Benzakour", ar: "بنزاكور" },
  { fr: "Chorfi", ar: "الشرفي" },
  { fr: "Hilali", ar: "الهلالي" },
  { fr: "Bennaceur", ar: "بناصر" },
  { fr: "Ait Lahcen", ar: "آيت لحسن" },
  { fr: "Boukili", ar: "البوكيلي" },
  { fr: "Raissouni", ar: "الريسوني" },
  { fr: "Sebti", ar: "السبتي" },
  { fr: "Tadlaoui", ar: "التادلاوي" },
  { fr: "Zemmouri", ar: "الزموري" },
  { fr: "Nouri", ar: "النوري" },
  { fr: "Baddou", ar: "بادو" },
  { fr: "Kacimi", ar: "القاسمي" },
  { fr: "Lemseffer", ar: "المصفر" },
  { fr: "Ouarzazi", ar: "الورزازي" },
  { fr: "Ghazouani", ar: "الغزواني" },
  { fr: "Belhaj", ar: "بلحاج" },
  { fr: "Zaoui", ar: "الزاوي" },
  { fr: "Tabet", ar: "ثابت" },
  { fr: "Yousfi", ar: "اليوسفي" },
  { fr: "Bourkia", ar: "بوركية" },
  { fr: "Ait Ali", ar: "آيت علي" },
  { fr: "Fadili", ar: "الفاضيلي" },
  { fr: "Zerhouni", ar: "الزرهوني" },
  { fr: "Cherradi", ar: "الشرادي" },
  { fr: "Bennouna", ar: "بنونة" },
  { fr: "Hadaoui", ar: "الهدوي" },
  { fr: "Mrini", ar: "المريني" },
  { fr: "Sabir", ar: "صابر" },
  { fr: "Nadifi", ar: "النظيفي" },
  { fr: "Boulaich", ar: "بولعيش" },
  { fr: "Khattabi", ar: "الخطابي" },
  { fr: "Zaidi", ar: "الزايدي" },
  { fr: "Andaloussi", ar: "الأندلسي" },
  { fr: "Bencheikh", ar: "بنشيخ" },
  { fr: "Soussi", ar: "السوسي" },
  { fr: "Maghraoui", ar: "المغراوي" },
  { fr: "Chergui", ar: "الشرقي" },
  { fr: "Bouazza", ar: "بوعزة" },
  { fr: "Lahrichi", ar: "الحريشي" },
  { fr: "Taibi", ar: "الطيبي" },
  { fr: "Ouazzine", ar: "الوزين" },
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
  { fr: "Aymane", ar: "أيمن" },
  { fr: "Hicham", ar: "هشام" },
  { fr: "Imad", ar: "عماد" },
  { fr: "Yahya", ar: "يحيى" },
  { fr: "Idriss", ar: "إدريس" },
  { fr: "Jad", ar: "جاد" },
  { fr: "Ziad", ar: "زياد" },
  { fr: "Adnane", ar: "عدنان" },
  { fr: "Achraf", ar: "أشرف" },
  { fr: "Mounir", ar: "منير" },
  { fr: "Naoufal", ar: "نوفل" },
  { fr: "Abdelali", ar: "عبد العالي" },
  { fr: "Abdessamad", ar: "عبد الصمد" },
  { fr: "Jaouad", ar: "جواد" },
  { fr: "Khalil", ar: "خليل" },
  { fr: "Sami", ar: "سامي" },
  { fr: "Firas", ar: "فراس" },
  { fr: "Iyad", ar: "إياد" },
  { fr: "Rachid", ar: "رشيد" },
  { fr: "Tarek", ar: "طارق" },
  { fr: "Kamal", ar: "كمال" },
  { fr: "Nassim", ar: "نسيم" },
  { fr: "Wassim", ar: "وسيم" },
  { fr: "Hatim", ar: "حاتم" },
  { fr: "Zouhair", ar: "زهير" },
  { fr: "Redouane", ar: "رضوان" },
  { fr: "Ahmed", ar: "أحمد" },
  { fr: "Ali", ar: "علي" },
  { fr: "Hassan", ar: "حسن" },
  { fr: "Hussein", ar: "حسين" },
  { fr: "Ibrahim", ar: "إبراهيم" },
  { fr: "Chouaib", ar: "شعيب" },
  { fr: "Souhail", ar: "سهيل" },
  { fr: "Oussama", ar: "أسامة" },
  { fr: "Salim", ar: "سليم" },
  { fr: "Nader", ar: "نادر" },
  { fr: "Ryad", ar: "رياض" },
  { fr: "Fouad", ar: "فؤاد" },
  { fr: "Jalal", ar: "جلال" },
  { fr: "Amir", ar: "أمير" },
  { fr: "Bassim", ar: "باسم" },
  { fr: "Ghali", ar: "غالي" },
  { fr: "Haitham", ar: "هيثم" },
  { fr: "Kacem", ar: "قاسم" },
  { fr: "Lotfi", ar: "لطفي" },
  { fr: "Malik", ar: "مالك" },
  { fr: "Moustafa", ar: "مصطفى" },
  { fr: "Saad", ar: "سعد" },
  { fr: "Salah", ar: "صلاح" },
  { fr: "Samir", ar: "سمير" },
  { fr: "Yazid", ar: "يزيد" },
  { fr: "Zaid", ar: "زيد" },
  { fr: "Abdellatif", ar: "عبد اللطيف" },
  { fr: "Abdelmajid", ar: "عبد المجيد" },
  { fr: "Anouar", ar: "أنور" },
  { fr: "Bouchaib", ar: "بوشعيب" },
  { fr: "Farid", ar: "فريد" },
  { fr: "Hamid", ar: "حميد" },
  { fr: "Hafid", ar: "حفيظ" },
  { fr: "Jamal", ar: "جمال" },
  { fr: "Khalid", ar: "خالد" },
  { fr: "Majid", ar: "ماجد" },
  { fr: "Mounssif", ar: "منصف" },
  { fr: "Rabii", ar: "ربيع" },
  { fr: "Tawfik", ar: "توفيق" },
  { fr: "Youness", ar: "يونس" },
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
  { fr: "Nouhaila", ar: "نهيلة" },
  { fr: "Oumaima", ar: "أميمة" },
  { fr: "Hajar", ar: "هاجر" },
  { fr: "Soukaina", ar: "سكينة" },
  { fr: "Fatima", ar: "فاطمة" },
  { fr: "Asmae", ar: "أسماء" },
  { fr: "Btissam", ar: "ابتسام" },
  { fr: "Ikram", ar: "إكرام" },
  { fr: "Loubna", ar: "لبنى" },
  { fr: "Manal", ar: "منال" },
  { fr: "Widad", ar: "وداد" },
  { fr: "Saloua", ar: "سلوى" },
  { fr: "Nawal", ar: "نوال" },
  { fr: "Sanae", ar: "سناء" },
  { fr: "Hanane", ar: "حنان" },
  { fr: "Siham", ar: "سهام" },
  { fr: "Dounia", ar: "دنيا" },
  { fr: "Fadwa", ar: "فدوى" },
  { fr: "Ilham", ar: "إلهام" },
  { fr: "Jihane", ar: "جيهان" },
  { fr: "Kaoutar", ar: "كوثر" },
  { fr: "Lamia", ar: "لمياء" },
  { fr: "Mouna", ar: "منى" },
  { fr: "Nezha", ar: "نزهة" },
  { fr: "Ouafae", ar: "وفاء" },
  { fr: "Rachida", ar: "رشيدة" },
  { fr: "Safae", ar: "صفاء" },
  { fr: "Sabrine", ar: "صابرين" },
  { fr: "Touria", ar: "ثريا" },
  { fr: "Zahra", ar: "زهرة" },
  { fr: "Aicha", ar: "عائشة" },
  { fr: "Bouchra", ar: "بشرى" },
  { fr: "Chadia", ar: "شادية" },
  { fr: "Dalal", ar: "دلال" },
  { fr: "Firdaous", ar: "فردوس" },
  { fr: "Hind", ar: "هند" },
  { fr: "Jamila", ar: "جميلة" },
  { fr: "Karima", ar: "كريمة" },
  { fr: "Maha", ar: "مها" },
  { fr: "Najoua", ar: "نجوى" },
  { fr: "Oumnia", ar: "أمنية" },
  { fr: "Rabab", ar: "رباب" },
  { fr: "Rihab", ar: "رحاب" },
  { fr: "Sabah", ar: "صباح" },
  { fr: "Tasnim", ar: "تسنيم" },
  { fr: "Yakout", ar: "ياقوت" },
  { fr: "Zakia", ar: "زكية" },
  { fr: "Amal", ar: "أمل" },
  { fr: "Doha", ar: "ضحى" },
  { fr: "Farah", ar: "فرح" },
  { fr: "Ghizlane", ar: "غزلان" },
  { fr: "Houda", ar: "هدى" },
  { fr: "Israe", ar: "إسراء" },
  { fr: "Leila", ar: "ليلى" },
  { fr: "Marwa", ar: "مروة" },
  { fr: "Nisrine", ar: "نسرين" },
  { fr: "Wissal", ar: "وصال" },
  { fr: "Zoubida", ar: "زبيدة" },
  { fr: "Bahija", ar: "بهيجة" },
];

/**
 * Adult given names, for the guardians on a dossier.
 *
 * A generation older than the pupils on purpose: the fathers and mothers of
 * today's 1AP are not called Rayan and Malak, and a demo where they are reads
 * as generated the moment somebody opens a family file.
 */
export const FATHERS: string[] = [
  "Youssef", "Hicham", "Driss", "Rachid", "Khalid", "Abdellah",
  "Mustapha", "Said", "Aziz", "Noureddine", "Jamal", "Tarik",
  "Abdelaziz", "Mounir", "Larbi", "Brahim", "Hassan", "Abdelkrim",
  "Mohamed", "Ahmed", "Abderrahmane", "Lahcen", "Mohcine", "Fouad",
  "Abdeljalil", "Hamid", "Mohammed Amine", "Redouane", "Nourdine", "Kamal",
  "Abdelilah", "Ali", "Bachir", "Chakib", "Elhoussine", "Fahd",
  "Ghali", "Hafid", "Ismail", "Jaouad", "Lotfi", "Mehdi",
  "Nabil", "Omar", "Rabie", "Samir", "Toufik", "Zouhair",
  "Abdenbi", "Bouazza", "Charaf", "Farid", "Elmehdi", "Idriss",
  "Karim", "Majid", "Naoufal", "Othmane", "Salah", "Yassin",
];

export const MOTHERS: string[] = [
  "Nadia", "Salma", "Imane", "Btissam", "Latifa", "Fatima Zahra",
  "Souad", "Naima", "Hakima", "Rajae", "Karima", "Samira",
  "Bouchra", "Malika", "Zohra", "Amina", "Aicha", "Halima",
  "Khadija", "Rachida", "Saida", "Fouzia", "Nezha", "Hayat",
  "Jamila", "Mina", "Ouafae", "Rkia", "Siham", "Touria",
  "Zineb", "Asmae", "Dounia", "Fatiha", "Ghizlane", "Hasnae",
  "Ilham", "Kaoutar", "Loubna", "Meryem", "Nawal", "Nabila",
  "Rabia", "Sanae", "Wafae", "Yamina", "Zahra", "Hanane",
  "Amal", "Chadia", "Fadila", "Hind", "Jalila", "Khadouj",
  "Lamia", "Milouda", "Najat", "Rabab", "Soumia", "Widad",
];

export const PROFESSIONS: string[] = [
  "Ingénieur", "Pharmacienne", "Commerçant", "Enseignante", "Médecin",
  "Comptable", "Fonctionnaire", "Artisan", "Infirmière", "Avocat",
  "Architecte", "Technicien", "Gestionnaire", "Agriculteur", "Chauffeur",
  "Couturière", "Banquier", "Journaliste", "Menuisier", "Électricien",
  "Coiffeuse", "Plombier", "Restaurateur", "Vétérinaire", "Dentiste",
  "Kinésithérapeute", "Libraire", "Boulanger", "Mécanicien", "Assistante sociale",
  "Traductrice", "Agent immobilier", "Épicier", "Photographe", "Assureur",
  "Transporteur", "Bijoutier", "Peintre en bâtiment", "Secrétaire médicale", "Employé de banque",
];

/** Street lines, paired with a quartier by the roster builder. */
export const STREETS: string[] = [
  "rue Ibn Batouta", "boulevard Zerktouni", "rue Al Farabi",
  "avenue Hassan II", "rue Oukaimeden", "boulevard Anfa",
  "rue Moulay Youssef", "avenue Mohammed V", "rue Ibn Sina",
  "boulevard Ghandi", "rue Jbel Toubkal", "avenue Al Massira",
  "rue Tarik Ibn Ziad", "boulevard Al Qods", "rue Assafa",
  "rue Ibn Khaldoun", "avenue des FAR", "rue Al Andalous",
  "boulevard Moulay Ismail", "rue Sidi Bennour", "avenue Allal Ben Abdellah",
  "rue Abou Bakr Seddik", "boulevard Idriss Al Akbar", "rue Al Baraka",
  "avenue Oued El Makhazine", "rue Al Wahda", "boulevard Mohammed VI",
  "rue Ibn Rochd", "avenue Annakhil", "rue Al Amal",
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

/**
 * The first entry of a pool whose full name is not already taken.
 *
 * Large pools make a clash rare; they do not make it impossible, and the one
 * place it is unacceptable is a household — two sisters called Salma Bennani is
 * not a coincidence a reader forgives. So every name the roster hands out goes
 * through here: it starts where the hash put it and walks forward until the
 * combination is free, which keeps the choice a pure function of the index and
 * the roster reproducible to the letter.
 *
 * Falls back to the hashed pick when the pool is exhausted, since a duplicate
 * name is a better failure than a seed that cannot finish.
 */
export function pickUnique<T>(
  pool: readonly T[],
  index: number,
  surname: string,
  taken: Set<string>,
  nameOf: (entry: T) => string,
): T {
  const start = index % pool.length;

  for (let step = 0; step < pool.length; step += 1) {
    const candidate = pool[(start + step) % pool.length];
    const key = `${nameOf(candidate)}|${surname}`.toLowerCase();
    if (!taken.has(key)) {
      taken.add(key);
      return candidate;
    }
  }

  return pool[start];
}
