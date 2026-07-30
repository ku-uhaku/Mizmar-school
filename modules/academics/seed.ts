import { levelSubjectScopeKey } from "@/modules/academics/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Academic configuration for one school: cycles, levels, filières, subjects
 * (with their components) and the programme that weights them.
 *
 * Two presets, because the two seeded schools are deliberately different — a
 * groupe scolaire running every cycle, and a primary school running only
 * preschool and primaire. Seeding both is what proves the configuration really
 * is per school rather than global.
 *
 * NOTE ON MASSAR CODES: the values below are **placeholders** in the right
 * shape, not the Ministry's real nomenclature. Replace them with the codes from
 * your MASSAR export before relying on them for anything official.
 */

type CycleSeed = {
  cycle: string;
  name: string;
  nameAr: string;
  position: number;
};

type LevelSeed = {
  cycle: string;
  code: string;
  name: string;
  nameAr: string;
  gradeYear: number;
  massarCode: string;
};

type TrackSeed = {
  levelCode: string;
  code: string;
  name: string;
  nameAr: string;
  massarCode: string;
};

type SubjectSeed = {
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

type ProgrammeSeed = {
  levelCode: string;
  /** Null applies the row to every track of the level. */
  trackCode: string | null;
  subjectCode: string;
  coefficient: number;
  weeklyMinutes?: number;
};

export type AcademicsPreset = {
  cycles: CycleSeed[];
  levels: LevelSeed[];
  tracks: TrackSeed[];
  subjects: SubjectSeed[];
  programme: ProgrammeSeed[];
};

// ── Shared subjects ──────────────────────────────────────────────────────────

/** Arabic and its components — the split Moroccan primary report cards use. */
const ARABIC: SubjectSeed[] = [
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
const FRENCH: SubjectSeed[] = [
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

const COMMON: SubjectSeed[] = [
  { code: "MATH", name: "Mathématiques", nameAr: "الرياضيات", shortName: "Math", massarCode: "MAT", colorHex: "#dc2626" },
  { code: "ISL", name: "Éducation Islamique", nameAr: "التربية الإسلامية", shortName: "Isl", massarCode: "EIS", colorHex: "#0d9488" },
  { code: "EPS", name: "Éducation Physique et Sportive", nameAr: "التربية البدنية", shortName: "EPS", massarCode: "EPS", colorHex: "#ea580c" },
  { code: "AMZ", name: "Tamazight", nameAr: "اللغة الأمازيغية", shortName: "Amz", massarCode: "AMZ", isLanguage: true, colorHex: "#a855f7" },
];

const PRIMARY_LEVELS: LevelSeed[] = [1, 2, 3, 4, 5, 6].map((year) => ({
  cycle: "PRIMARY",
  code: `${year}AP`,
  name: `${year}${year === 1 ? "ère" : "ème"} année primaire`,
  nameAr: `السنة ${["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"][year - 1]} ابتدائي`,
  gradeYear: year,
  massarCode: `P${year}`,
}));

/** Arabic, French, maths, Islamic education, EPS and Tamazight at a primary level. */
function primaryProgramme(levelCode: string): ProgrammeSeed[] {
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

// ── Preset A: a groupe scolaire running every cycle ──────────────────────────

const COLLEGE_LEVELS: LevelSeed[] = [1, 2, 3].map((year) => ({
  cycle: "SECONDARY_COLLEGE",
  code: `${year}AC`,
  name: `${year}${year === 1 ? "ère" : "ème"} année collégiale`,
  nameAr: `السنة ${["الأولى", "الثانية", "الثالثة"][year - 1]} إعدادي`,
  gradeYear: year,
  massarCode: `C${year}`,
}));

function collegeProgramme(levelCode: string): ProgrammeSeed[] {
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

export const FULL_RANGE_PRESET: AcademicsPreset = {
  cycles: [
    { cycle: "PRIMARY", name: "Enseignement primaire", nameAr: "التعليم الابتدائي", position: 2 },
    { cycle: "SECONDARY_COLLEGE", name: "Secondaire collégial", nameAr: "التعليم الثانوي الإعدادي", position: 3 },
    { cycle: "SECONDARY_QUALIFYING", name: "Secondaire qualifiant", nameAr: "التعليم الثانوي التأهيلي", position: 4 },
  ],
  levels: [
    ...PRIMARY_LEVELS,
    ...COLLEGE_LEVELS,
    { cycle: "SECONDARY_QUALIFYING", code: "TC", name: "Tronc commun", nameAr: "الجذع المشترك", gradeYear: 1, massarCode: "Q1" },
    { cycle: "SECONDARY_QUALIFYING", code: "1BAC", name: "1ère année baccalauréat", nameAr: "السنة الأولى بكالوريا", gradeYear: 2, massarCode: "Q2" },
    { cycle: "SECONDARY_QUALIFYING", code: "2BAC", name: "2ème année baccalauréat", nameAr: "السنة الثانية بكالوريا", gradeYear: 3, massarCode: "Q3" },
  ],
  tracks: [
    { levelCode: "TC", code: "TC-S", name: "Tronc commun scientifique", nameAr: "جذع مشترك علمي", massarCode: "TCS" },
    { levelCode: "TC", code: "TC-LSH", name: "Tronc commun lettres et sciences humaines", nameAr: "جذع مشترك آداب وعلوم إنسانية", massarCode: "TCL" },
    { levelCode: "1BAC", code: "1B-SE", name: "Sciences expérimentales", nameAr: "علوم تجريبية", massarCode: "1SE" },
    { levelCode: "1BAC", code: "1B-SM", name: "Sciences mathématiques", nameAr: "علوم رياضية", massarCode: "1SM" },
    { levelCode: "1BAC", code: "1B-L", name: "Lettres et sciences humaines", nameAr: "آداب وعلوم إنسانية", massarCode: "1LSH" },
    { levelCode: "2BAC", code: "2B-SVT", name: "Sciences de la vie et de la terre", nameAr: "علوم الحياة والأرض", massarCode: "2SVT" },
    { levelCode: "2BAC", code: "2B-PC", name: "Sciences physiques et chimiques", nameAr: "علوم فيزيائية", massarCode: "2PC" },
    { levelCode: "2BAC", code: "2B-SM-A", name: "Sciences mathématiques A", nameAr: "علوم رياضية أ", massarCode: "2SMA" },
    { levelCode: "2BAC", code: "2B-L", name: "Lettres", nameAr: "آداب", massarCode: "2L" },
  ],
  subjects: [
    ...ARABIC,
    ...FRENCH,
    { code: "EN", name: "Anglais", nameAr: "اللغة الإنجليزية", shortName: "Ang", massarCode: "ANG", isLanguage: true, colorHex: "#7c3aed" },
    ...COMMON,
    { code: "SVT", name: "Sciences de la Vie et de la Terre", nameAr: "علوم الحياة والأرض", shortName: "SVT", massarCode: "SVT", requiresLab: true, colorHex: "#059669" },
    { code: "PC", name: "Physique-Chimie", nameAr: "الفيزياء والكيمياء", shortName: "PC", massarCode: "PHC", requiresLab: true, colorHex: "#0891b2" },
    { code: "HG", name: "Histoire-Géographie", nameAr: "التاريخ والجغرافيا", shortName: "HG", massarCode: "HGE", colorHex: "#b45309" },
    { code: "INFO", name: "Informatique", nameAr: "المعلوميات", shortName: "Info", massarCode: "INF", requiresLab: true, colorHex: "#475569" },
    { code: "PHILO", name: "Philosophie", nameAr: "الفلسفة", shortName: "Philo", massarCode: "PHI", colorHex: "#9333ea" },
  ],
  programme: [
    // Every level the school runs gets a programme, so every class it opens has
    // subjects to timetable.
    ...["1AP", "2AP", "3AP", "4AP", "5AP", "6AP"].flatMap(primaryProgramme),
    ...["1AC", "2AC", "3AC"].flatMap(collegeProgramme),

    // Tronc commun scientifique.
    { levelCode: "TC", trackCode: "TC-S", subjectCode: "MATH", coefficient: 4, weeklyMinutes: 300 },
    { levelCode: "TC", trackCode: "TC-S", subjectCode: "SVT", coefficient: 3, weeklyMinutes: 180 },
    { levelCode: "TC", trackCode: "TC-S", subjectCode: "PC", coefficient: 3, weeklyMinutes: 180 },
    { levelCode: "TC", trackCode: null, subjectCode: "AR", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "TC", trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 240 },
    { levelCode: "TC", trackCode: null, subjectCode: "EN", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "TC", trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "TC", trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 120 },

    // 2BAC Sciences de la Vie et de la Terre.
    { levelCode: "2BAC", trackCode: "2B-SVT", subjectCode: "SVT", coefficient: 7, weeklyMinutes: 330 },
    { levelCode: "2BAC", trackCode: "2B-SVT", subjectCode: "PC", coefficient: 5, weeklyMinutes: 240 },
    { levelCode: "2BAC", trackCode: "2B-SVT", subjectCode: "MATH", coefficient: 7, weeklyMinutes: 240 },
    // 2BAC Sciences Mathématiques A — the same subjects, weighted very differently.
    { levelCode: "2BAC", trackCode: "2B-SM-A", subjectCode: "MATH", coefficient: 9, weeklyMinutes: 480 },
    { levelCode: "2BAC", trackCode: "2B-SM-A", subjectCode: "PC", coefficient: 7, weeklyMinutes: 300 },
    { levelCode: "2BAC", trackCode: "2B-SM-A", subjectCode: "SVT", coefficient: 3, weeklyMinutes: 120 },
    // Common to every 2BAC track.
    { levelCode: "2BAC", trackCode: null, subjectCode: "PHILO", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "2BAC", trackCode: null, subjectCode: "AR", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "2BAC", trackCode: null, subjectCode: "FR", coefficient: 4, weeklyMinutes: 240 },
    { levelCode: "2BAC", trackCode: null, subjectCode: "EN", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "2BAC", trackCode: null, subjectCode: "ISL", coefficient: 2, weeklyMinutes: 120 },
    { levelCode: "2BAC", trackCode: null, subjectCode: "EPS", coefficient: 2, weeklyMinutes: 120 },
  ],
};

// ── Preset B: a preschool + primary school ───────────────────────────────────

export const PRIMARY_ONLY_PRESET: AcademicsPreset = {
  cycles: [
    { cycle: "PRESCHOOL", name: "Enseignement préscolaire", nameAr: "التعليم الأولي", position: 1 },
    { cycle: "PRIMARY", name: "Enseignement primaire", nameAr: "التعليم الابتدائي", position: 2 },
  ],
  levels: [
    { cycle: "PRESCHOOL", code: "MS", name: "Moyenne section", nameAr: "القسم المتوسط", gradeYear: 1, massarCode: "A1" },
    { cycle: "PRESCHOOL", code: "GS", name: "Grande section", nameAr: "القسم الكبير", gradeYear: 2, massarCode: "A2" },
    ...PRIMARY_LEVELS,
  ],
  // No tracks: streaming starts in the qualifying cycle.
  tracks: [],
  subjects: [
    ...ARABIC,
    ...FRENCH,
    ...COMMON,
    { code: "ACT", name: "Activités d'éveil", nameAr: "أنشطة الإيقاظ", shortName: "Act", massarCode: "ACT", colorHex: "#f59e0b" },
  ],
  programme: [
    // Preschool is marked on activities rather than a weighted average, so the
    // rows exist but carry no coefficient weight worth speaking of.
    { levelCode: "GS", trackCode: null, subjectCode: "AR", coefficient: 2, weeklyMinutes: 300 },
    { levelCode: "GS", trackCode: null, subjectCode: "FR", coefficient: 2, weeklyMinutes: 240 },
    { levelCode: "GS", trackCode: null, subjectCode: "ACT", coefficient: 2, weeklyMinutes: 360 },
    { levelCode: "GS", trackCode: null, subjectCode: "EPS", coefficient: 1, weeklyMinutes: 120 },
    ...["1AP", "2AP", "3AP", "4AP", "5AP", "6AP"].flatMap(primaryProgramme),
  ],
};

// ── Seeding ──────────────────────────────────────────────────────────────────

export type AcademicsIds = {
  levelIdByCode: Record<string, string>;
  trackIdByCode: Record<string, string>;
  subjectIdByCode: Record<string, string>;
};

export async function seedAcademics(
  db: SeedDb,
  schoolId: string,
  preset: AcademicsPreset,
): Promise<AcademicsIds> {
  const cycleIdByCode: Record<string, string> = {};
  for (const cycle of preset.cycles) {
    const row = await db.educationLevel.upsert({
      where: { schoolId_cycle: { schoolId, cycle: cycle.cycle } },
      update: { name: cycle.name, nameAr: cycle.nameAr, position: cycle.position },
      create: { schoolId, ...cycle },
    });
    cycleIdByCode[cycle.cycle] = row.id;
  }

  const levelIdByCode: Record<string, string> = {};
  for (const [index, level] of preset.levels.entries()) {
    const row = await db.level.upsert({
      where: { schoolId_code: { schoolId, code: level.code } },
      update: {
        name: level.name,
        nameAr: level.nameAr,
        gradeYear: level.gradeYear,
        massarCode: level.massarCode,
        position: index,
      },
      create: {
        schoolId,
        educationLevelId: cycleIdByCode[level.cycle],
        code: level.code,
        name: level.name,
        nameAr: level.nameAr,
        gradeYear: level.gradeYear,
        massarCode: level.massarCode,
        position: index,
      },
    });
    levelIdByCode[level.code] = row.id;
  }

  const trackIdByCode: Record<string, string> = {};
  for (const [index, track] of preset.tracks.entries()) {
    const row = await db.track.upsert({
      where: {
        levelId_code: { levelId: levelIdByCode[track.levelCode], code: track.code },
      },
      update: { name: track.name, nameAr: track.nameAr, massarCode: track.massarCode, position: index },
      create: {
        levelId: levelIdByCode[track.levelCode],
        code: track.code,
        name: track.name,
        nameAr: track.nameAr,
        massarCode: track.massarCode,
        position: index,
      },
    });
    trackIdByCode[track.code] = row.id;
  }

  // Parents first, so a component always finds its parent id.
  const subjectIdByCode: Record<string, string> = {};
  const ordered = [
    ...preset.subjects.filter((subject) => !subject.parent),
    ...preset.subjects.filter((subject) => subject.parent),
  ];
  for (const subject of ordered) {
    const data = {
      name: subject.name,
      nameAr: subject.nameAr,
      shortName: subject.shortName ?? null,
      massarCode: subject.massarCode ?? null,
      parentId: subject.parent ? subjectIdByCode[subject.parent] : null,
      isLanguage: subject.isLanguage ?? false,
      requiresLab: subject.requiresLab ?? false,
      colorHex: subject.colorHex ?? null,
    };
    const row = await db.subject.upsert({
      where: { schoolId_code: { schoolId, code: subject.code } },
      update: data,
      create: { schoolId, code: subject.code, ...data },
    });
    subjectIdByCode[subject.code] = row.id;
  }

  for (const [index, entry] of preset.programme.entries()) {
    const trackId = entry.trackCode ? trackIdByCode[entry.trackCode] : null;
    const levelId = levelIdByCode[entry.levelCode];
    const subjectId = subjectIdByCode[entry.subjectCode];
    if (!levelId || !subjectId) continue;

    const scopeKey = levelSubjectScopeKey(trackId);
    await db.levelSubject.upsert({
      where: { levelId_subjectId_scopeKey: { levelId, subjectId, scopeKey } },
      update: {
        coefficient: entry.coefficient,
        weeklyMinutes: entry.weeklyMinutes ?? null,
        position: index,
      },
      create: {
        levelId,
        trackId,
        subjectId,
        scopeKey,
        coefficient: entry.coefficient,
        weeklyMinutes: entry.weeklyMinutes ?? null,
        position: index,
      },
    });
  }

  log(
    "academics",
    `${preset.cycles.length} cycles, ${preset.levels.length} levels, ${preset.tracks.length} tracks, ${preset.subjects.length} subjects, ${preset.programme.length} programme rows`,
  );

  return { levelIdByCode, trackIdByCode, subjectIdByCode };
}
