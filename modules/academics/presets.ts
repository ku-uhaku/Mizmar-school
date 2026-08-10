import type { EducationCycle } from "@/modules/academics/enums";

/**
 * The Moroccan cursus as data: the cycles, the levels inside them, the filières
 * they stream into, the subjects taught and the programme that weights them.
 *
 * Pure data — no `server-only`, no `db`, no React — because it has four readers
 * that cannot share anything else. `modules/academics/seed.ts` lays it under
 * `tsx`, `modules/setup/service.ts` writes it inside a transaction, the setup
 * wizard renders it as checkboxes in the browser, and the tests assert on it.
 * Anything added here must stay importable from all four.
 *
 * It is applied once *per school*, which is what proves the configuration really
 * is per school rather than global: two schools come out with their own `Level`
 * rows, their own subjects and their own programmes, and editing one leaves the
 * other alone.
 *
 * NOTE ON MASSAR CODES: the values below are **placeholders** in the right
 * shape, not the Ministry's real nomenclature. Replace them with the codes from
 * your MASSAR export before relying on them for anything official.
 */

export type CyclePreset = {
  cycle: string;
  name: string;
  nameAr: string;
  position: number;
};

export type LevelPreset = {
  cycle: string;
  code: string;
  name: string;
  nameAr: string;
  gradeYear: number;
  massarCode: string;
};

export type TrackPreset = {
  levelCode: string;
  code: string;
  name: string;
  nameAr: string;
  massarCode: string;
};

export type SubjectPreset = {
  code: string;
  name: string;
  nameAr: string;
  shortName?: string;
  massarCode?: string;
  /** Code of the parent subject — makes this row a component. */
  parent?: string;
  isLanguage?: boolean;
  requiresLab?: boolean;
  colorHex?: string;
};

export type ProgrammePreset = {
  levelCode: string;
  /** Null applies the row to every track of the level. */
  trackCode: string | null;
  subjectCode: string;
  coefficient: number;
  weeklyMinutes?: number;
};

export type AcademicsPreset = {
  cycles: CyclePreset[];
  levels: LevelPreset[];
  tracks: TrackPreset[];
  subjects: SubjectPreset[];
  programme: ProgrammePreset[];
};

// ── Subjects ─────────────────────────────────────────────────────────────────

/** Arabic and its components — the split Moroccan primary report cards use. */
const ARABIC: SubjectPreset[] = [
  {
    code: "AR",
    name: "اللغة العربية",
    nameAr: "اللغة العربية",
    shortName: "Arabe",
    massarCode: "ARB",
    isLanguage: true,
    colorHex: "#16a34a",
  },
  { code: "AR-LEC", name: "القراءة", nameAr: "القراءة", massarCode: "ARB-LEC", parent: "AR" },
  { code: "AR-IML", name: "الإملاء", nameAr: "الإملاء", massarCode: "ARB-IML", parent: "AR" },
  {
    code: "AR-EXP",
    name: "التعبير الكتابي",
    nameAr: "التعبير الكتابي",
    massarCode: "ARB-EXP",
    parent: "AR",
  },
  {
    code: "AR-GRM",
    name: "الصرف والتحويل",
    nameAr: "الصرف والتحويل",
    massarCode: "ARB-GRM",
    parent: "AR",
  },
];

/** French and its components. */
const FRENCH: SubjectPreset[] = [
  {
    code: "FR",
    name: "Français",
    nameAr: "اللغة الفرنسية",
    shortName: "Fr",
    massarCode: "FRA",
    isLanguage: true,
    colorHex: "#2563eb",
  },
  { code: "FR-GRM", name: "Grammaire", nameAr: "القواعد", massarCode: "FRA-GRM", parent: "FR" },
  { code: "FR-CNJ", name: "Conjugaison", nameAr: "التصريف", massarCode: "FRA-CNJ", parent: "FR" },
  { code: "FR-ORT", name: "Orthographe", nameAr: "الإملاء", massarCode: "FRA-ORT", parent: "FR" },
  {
    code: "FR-EXP",
    name: "Expression écrite",
    nameAr: "التعبير الكتابي",
    massarCode: "FRA-EXP",
    parent: "FR",
  },
];

const COMMON: SubjectPreset[] = [
  { code: "MATH", name: "Mathématiques", nameAr: "الرياضيات", shortName: "Math", massarCode: "MAT", colorHex: "#dc2626" },
  { code: "ISL", name: "Éducation Islamique", nameAr: "التربية الإسلامية", shortName: "Isl", massarCode: "EIS", colorHex: "#0d9488" },
  { code: "EPS", name: "Éducation Physique et Sportive", nameAr: "التربية البدنية", shortName: "EPS", massarCode: "EPS", colorHex: "#ea580c" },
  { code: "AMZ", name: "Tamazight", nameAr: "اللغة الأمازيغية", shortName: "Amz", massarCode: "AMZ", isLanguage: true, colorHex: "#a855f7" },
];

/**
 * Every subject the cursus knows, parents before components.
 *
 * Order is load-bearing: `seedAcademics` and `applySetup` both write subjects in
 * list order, and a component may not precede its parent.
 */
export const SUBJECTS: SubjectPreset[] = [
  ...ARABIC,
  ...FRENCH,
  { code: "EN", name: "Anglais", nameAr: "اللغة الإنجليزية", shortName: "Ang", massarCode: "ANG", isLanguage: true, colorHex: "#7c3aed" },
  ...COMMON,
  { code: "SVT", name: "Sciences de la Vie et de la Terre", nameAr: "علوم الحياة والأرض", shortName: "SVT", massarCode: "SVT", requiresLab: true, colorHex: "#059669" },
  { code: "PC", name: "Physique-Chimie", nameAr: "الفيزياء والكيمياء", shortName: "PC", massarCode: "PHC", requiresLab: true, colorHex: "#0891b2" },
  { code: "HG", name: "Histoire-Géographie", nameAr: "التاريخ والجغرافيا", shortName: "HG", massarCode: "HGE", colorHex: "#b45309" },
  { code: "INFO", name: "Informatique", nameAr: "المعلوميات", shortName: "Info", massarCode: "INF", requiresLab: true, colorHex: "#475569" },
  { code: "PHILO", name: "Philosophie", nameAr: "الفلسفة", shortName: "Philo", massarCode: "PHI", colorHex: "#9333ea" },
];

// ── Préscolaire ──────────────────────────────────────────────────────────────

const PRESCHOOL_LEVELS: LevelPreset[] = [
  { cycle: "PRESCHOOL", code: "PS", name: "Petite section", nameAr: "القسم الصغير", gradeYear: 1, massarCode: "A1" },
  { cycle: "PRESCHOOL", code: "GS", name: "Grande section", nameAr: "القسم الكبير", gradeYear: 2, massarCode: "A2" },
];

/**
 * Language, numbers and movement — no components, because a préscolaire report
 * card grades the child rather than their orthographe.
 */
function preschoolProgramme(levelCode: string): ProgrammePreset[] {
  return [
    { levelCode, trackCode: null, subjectCode: "AR", coefficient: 4, weeklyMinutes: 480 },
    { levelCode, trackCode: null, subjectCode: "FR", coefficient: 2, weeklyMinutes: 180 },
    { levelCode, trackCode: null, subjectCode: "MATH", coefficient: 2, weeklyMinutes: 180 },
    { levelCode, trackCode: null, subjectCode: "ISL", coefficient: 1, weeklyMinutes: 60 },
    { levelCode, trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 180 },
    { levelCode, trackCode: null, subjectCode: "AMZ", coefficient: 1, weeklyMinutes: 60 },
  ];
}

// ── Primaire ─────────────────────────────────────────────────────────────────

const PRIMARY_LEVELS: LevelPreset[] = [1, 2, 3, 4, 5, 6].map((year) => ({
  cycle: "PRIMARY",
  code: `${year}AP`,
  name: `${year}${year === 1 ? "ère" : "ème"} année primaire`,
  nameAr: `السنة ${["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"][year - 1]} ابتدائي`,
  gradeYear: year,
  massarCode: `P${year}`,
}));

/** Arabic, French, maths, Islamic education, EPS and Tamazight at a primary level. */
function primaryProgramme(levelCode: string): ProgrammePreset[] {
  return [
    { levelCode, trackCode: null, subjectCode: "AR", coefficient: 6, weeklyMinutes: 480 },
    // Components divide the parent's 6 between themselves.
    { levelCode, trackCode: null, subjectCode: "AR-LEC", coefficient: 2 },
    { levelCode, trackCode: null, subjectCode: "AR-IML", coefficient: 1 },
    { levelCode, trackCode: null, subjectCode: "AR-EXP", coefficient: 2 },
    { levelCode, trackCode: null, subjectCode: "AR-GRM", coefficient: 1 },
    { levelCode, trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 300 },
    { levelCode, trackCode: null, subjectCode: "FR-GRM", coefficient: 1 },
    { levelCode, trackCode: null, subjectCode: "FR-CNJ", coefficient: 1 },
    { levelCode, trackCode: null, subjectCode: "FR-ORT", coefficient: 1 },
    { levelCode, trackCode: null, subjectCode: "FR-EXP", coefficient: 1 },
    { levelCode, trackCode: null, subjectCode: "MATH", coefficient: 5, weeklyMinutes: 300 },
    { levelCode, trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
    { levelCode, trackCode: null, subjectCode: "EPS", coefficient: 1, weeklyMinutes: 120 },
    { levelCode, trackCode: null, subjectCode: "AMZ", coefficient: 1, weeklyMinutes: 90 },
  ];
}

// ── Collège ──────────────────────────────────────────────────────────────────

const COLLEGE_LEVELS: LevelPreset[] = [1, 2, 3].map((year) => ({
  cycle: "SECONDARY_COLLEGE",
  code: `${year}AC`,
  name: `${year}${year === 1 ? "ère" : "ème"} année collégiale`,
  nameAr: `السنة ${["الأولى", "الثانية", "الثالثة"][year - 1]} إعدادي`,
  gradeYear: year,
  massarCode: `C${year}`,
}));

function collegeProgramme(levelCode: string): ProgrammePreset[] {
  return [
    { levelCode, trackCode: null, subjectCode: "AR", coefficient: 4, weeklyMinutes: 300 },
    { levelCode, trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 270 },
    { levelCode, trackCode: null, subjectCode: "EN", coefficient: 2, weeklyMinutes: 120 },
    { levelCode, trackCode: null, subjectCode: "MATH", coefficient: 4, weeklyMinutes: 300 },
    { levelCode, trackCode: null, subjectCode: "SVT", coefficient: 2, weeklyMinutes: 150 },
    { levelCode, trackCode: null, subjectCode: "PC", coefficient: 2, weeklyMinutes: 150 },
    { levelCode, trackCode: null, subjectCode: "HG", coefficient: 2, weeklyMinutes: 150 },
    { levelCode, trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
    { levelCode, trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 120 },
  ];
}

// ── Secondaire qualifiant ────────────────────────────────────────────────────

const QUALIFYING_LEVELS: LevelPreset[] = [
  { cycle: "SECONDARY_QUALIFYING", code: "TC", name: "Tronc commun", nameAr: "الجذع المشترك", gradeYear: 1, massarCode: "Q1" },
  { cycle: "SECONDARY_QUALIFYING", code: "1BAC", name: "1ère année baccalauréat", nameAr: "السنة الأولى بكالوريا", gradeYear: 2, massarCode: "Q2" },
  { cycle: "SECONDARY_QUALIFYING", code: "2BAC", name: "2ème année baccalauréat", nameAr: "السنة الثانية بكالوريا", gradeYear: 3, massarCode: "Q3" },
];

const QUALIFYING_TRACKS: TrackPreset[] = [
  { levelCode: "TC", code: "TC-S", name: "Tronc commun scientifique", nameAr: "جذع مشترك علمي", massarCode: "TCS" },
  { levelCode: "TC", code: "TC-LSH", name: "Tronc commun lettres et sciences humaines", nameAr: "جذع مشترك آداب وعلوم إنسانية", massarCode: "TCL" },
  { levelCode: "1BAC", code: "1B-SE", name: "Sciences expérimentales", nameAr: "علوم تجريبية", massarCode: "1SE" },
  { levelCode: "1BAC", code: "1B-SM", name: "Sciences mathématiques", nameAr: "علوم رياضية", massarCode: "1SM" },
  { levelCode: "1BAC", code: "1B-L", name: "Lettres et sciences humaines", nameAr: "آداب وعلوم إنسانية", massarCode: "1LSH" },
  { levelCode: "2BAC", code: "2B-SVT", name: "Sciences de la vie et de la terre", nameAr: "علوم الحياة والأرض", massarCode: "2SVT" },
  { levelCode: "2BAC", code: "2B-PC", name: "Sciences physiques et chimiques", nameAr: "علوم فيزيائية", massarCode: "2PC" },
  { levelCode: "2BAC", code: "2B-SM-A", name: "Sciences mathématiques A", nameAr: "علوم رياضية أ", massarCode: "2SMA" },
  { levelCode: "2BAC", code: "2B-L", name: "Lettres", nameAr: "آداب", massarCode: "2L" },
];

const QUALIFYING_PROGRAMME: ProgrammePreset[] = [
  // ── Tronc commun ──────────────────────────────────────────────────────────
  { levelCode: "TC", trackCode: "TC-S", subjectCode: "MATH", coefficient: 4, weeklyMinutes: 300 },
  { levelCode: "TC", trackCode: "TC-S", subjectCode: "SVT", coefficient: 3, weeklyMinutes: 180 },
  { levelCode: "TC", trackCode: "TC-S", subjectCode: "PC", coefficient: 3, weeklyMinutes: 180 },
  { levelCode: "TC", trackCode: "TC-S", subjectCode: "INFO", coefficient: 1, weeklyMinutes: 90 },
  { levelCode: "TC", trackCode: "TC-LSH", subjectCode: "MATH", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "TC", trackCode: "TC-LSH", subjectCode: "HG", coefficient: 4, weeklyMinutes: 240 },
  { levelCode: "TC", trackCode: "TC-LSH", subjectCode: "PHILO", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "TC", trackCode: null, subjectCode: "AR", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "TC", trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 240 },
  { levelCode: "TC", trackCode: null, subjectCode: "EN", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "TC", trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "TC", trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 120 },

  // ── 1ère année baccalauréat ───────────────────────────────────────────────
  // Sciences expérimentales.
  { levelCode: "1BAC", trackCode: "1B-SE", subjectCode: "SVT", coefficient: 5, weeklyMinutes: 270 },
  { levelCode: "1BAC", trackCode: "1B-SE", subjectCode: "PC", coefficient: 5, weeklyMinutes: 270 },
  { levelCode: "1BAC", trackCode: "1B-SE", subjectCode: "MATH", coefficient: 5, weeklyMinutes: 270 },
  // Sciences mathématiques — the same three, weighted for the stream.
  { levelCode: "1BAC", trackCode: "1B-SM", subjectCode: "MATH", coefficient: 7, weeklyMinutes: 390 },
  { levelCode: "1BAC", trackCode: "1B-SM", subjectCode: "PC", coefficient: 6, weeklyMinutes: 270 },
  { levelCode: "1BAC", trackCode: "1B-SM", subjectCode: "SVT", coefficient: 3, weeklyMinutes: 150 },
  // Lettres et sciences humaines.
  { levelCode: "1BAC", trackCode: "1B-L", subjectCode: "HG", coefficient: 5, weeklyMinutes: 240 },
  { levelCode: "1BAC", trackCode: "1B-L", subjectCode: "PHILO", coefficient: 4, weeklyMinutes: 180 },
  { levelCode: "1BAC", trackCode: "1B-L", subjectCode: "MATH", coefficient: 1, weeklyMinutes: 60 },
  // Common to every 1BAC track.
  { levelCode: "1BAC", trackCode: null, subjectCode: "AR", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "1BAC", trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 240 },
  { levelCode: "1BAC", trackCode: null, subjectCode: "EN", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "1BAC", trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "1BAC", trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 120 },

  // ── 2ème année baccalauréat ───────────────────────────────────────────────
  // Sciences de la Vie et de la Terre.
  { levelCode: "2BAC", trackCode: "2B-SVT", subjectCode: "SVT", coefficient: 7, weeklyMinutes: 330 },
  { levelCode: "2BAC", trackCode: "2B-SVT", subjectCode: "PC", coefficient: 5, weeklyMinutes: 240 },
  { levelCode: "2BAC", trackCode: "2B-SVT", subjectCode: "MATH", coefficient: 7, weeklyMinutes: 240 },
  // Sciences physiques et chimiques — the mirror of the above.
  { levelCode: "2BAC", trackCode: "2B-PC", subjectCode: "PC", coefficient: 7, weeklyMinutes: 330 },
  { levelCode: "2BAC", trackCode: "2B-PC", subjectCode: "MATH", coefficient: 7, weeklyMinutes: 270 },
  { levelCode: "2BAC", trackCode: "2B-PC", subjectCode: "SVT", coefficient: 5, weeklyMinutes: 210 },
  // Sciences Mathématiques A — the same subjects, weighted very differently.
  { levelCode: "2BAC", trackCode: "2B-SM-A", subjectCode: "MATH", coefficient: 9, weeklyMinutes: 480 },
  { levelCode: "2BAC", trackCode: "2B-SM-A", subjectCode: "PC", coefficient: 7, weeklyMinutes: 300 },
  { levelCode: "2BAC", trackCode: "2B-SM-A", subjectCode: "SVT", coefficient: 3, weeklyMinutes: 120 },
  // Lettres.
  { levelCode: "2BAC", trackCode: "2B-L", subjectCode: "HG", coefficient: 6, weeklyMinutes: 270 },
  { levelCode: "2BAC", trackCode: "2B-L", subjectCode: "PHILO", coefficient: 5, weeklyMinutes: 240 },
  // Common to every 2BAC track. Philosophie is examined in every stream, which
  // is why it is here as well as weighted higher in the lettres row above.
  { levelCode: "2BAC", trackCode: null, subjectCode: "PHILO", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "2BAC", trackCode: null, subjectCode: "AR", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "2BAC", trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 240 },
  { levelCode: "2BAC", trackCode: null, subjectCode: "EN", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "2BAC", trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
  { levelCode: "2BAC", trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 120 },
];

// ── The catalogue ────────────────────────────────────────────────────────────

export type CycleCatalogue = CyclePreset & {
  levels: LevelPreset[];
  tracks: TrackPreset[];
  programme: ProgrammePreset[];
};

/**
 * The cursus sliced by cycle, which is how the setup wizard reads it: a school
 * ticks the cycles it runs and everything below follows from that one choice.
 *
 * `position` is the order the cycles are taught in, so préscolaire takes 1 and
 * the rest keep the numbers they have always had.
 */
export const CYCLE_CATALOGUE: Record<EducationCycle, CycleCatalogue> = {
  PRESCHOOL: {
    cycle: "PRESCHOOL",
    name: "Enseignement préscolaire",
    nameAr: "التعليم الأولي",
    position: 1,
    levels: PRESCHOOL_LEVELS,
    tracks: [],
    programme: PRESCHOOL_LEVELS.flatMap((level) => preschoolProgramme(level.code)),
  },
  PRIMARY: {
    cycle: "PRIMARY",
    name: "Enseignement primaire",
    nameAr: "التعليم الابتدائي",
    position: 2,
    levels: PRIMARY_LEVELS,
    tracks: [],
    programme: PRIMARY_LEVELS.flatMap((level) => primaryProgramme(level.code)),
  },
  SECONDARY_COLLEGE: {
    cycle: "SECONDARY_COLLEGE",
    name: "Secondaire collégial",
    nameAr: "التعليم الثانوي الإعدادي",
    position: 3,
    levels: COLLEGE_LEVELS,
    tracks: [],
    programme: COLLEGE_LEVELS.flatMap((level) => collegeProgramme(level.code)),
  },
  SECONDARY_QUALIFYING: {
    cycle: "SECONDARY_QUALIFYING",
    name: "Secondaire qualifiant",
    nameAr: "التعليم الثانوي التأهيلي",
    position: 4,
    levels: QUALIFYING_LEVELS,
    tracks: QUALIFYING_TRACKS,
    programme: QUALIFYING_PROGRAMME,
  },
};

/** The cycle's own columns, without the levels and programme hanging off it. */
export function cyclePresetOf(entry: CycleCatalogue): CyclePreset {
  return {
    cycle: entry.cycle,
    name: entry.name,
    nameAr: entry.nameAr,
    position: entry.position,
  };
}

/**
 * The cycles `npm run db:seed` lays down — deliberately *without* préscolaire.
 *
 * The demonstration school is a groupe scolaire from 1AP to 2BAC, and adding a
 * fourth cycle to it would change every count the seed produces and every
 * fixture that asserts on them. Préscolaire is in the catalogue for the wizard,
 * where a school that runs it says so.
 */
const SEEDED_CYCLES = ["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_QUALIFYING"] as const;

/**
 * The preset `seedAcademics` applies.
 *
 * Assembled from `CYCLE_CATALOGUE` rather than written out again, so there is
 * one copy of the cursus. **Order is load-bearing**: `Level.position` and
 * `LevelSubject.position` are derived from the index in these arrays, so a
 * reordering here silently renumbers every school on the next seed.
 */
export const MOROCCAN_CURSUS: AcademicsPreset = {
  cycles: SEEDED_CYCLES.map((cycle) => cyclePresetOf(CYCLE_CATALOGUE[cycle])),
  levels: SEEDED_CYCLES.flatMap((cycle) => CYCLE_CATALOGUE[cycle].levels),
  tracks: SEEDED_CYCLES.flatMap((cycle) => CYCLE_CATALOGUE[cycle].tracks),
  subjects: SUBJECTS,
  programme: SEEDED_CYCLES.flatMap((cycle) => CYCLE_CATALOGUE[cycle].programme),
};
