/**
 * The kinds of evaluation a Moroccan school runs.
 *
 * Only the *types* are seeded, never the papers themselves. Generating a round
 * of contrôles attributes them to teachers and opens them for marking, and a
 * re-run of the seed would keep re-creating rows nobody planned — so the
 * calendar is set through the screen, which is also the shortest way to see the
 * generator work.
 *
 * Pure data: the seed and the setup wizard both write this list, so a school
 * configured through the screens marks on the same kinds a seeded one does.
 */

export type AssessmentTypeSeed = {
  code: string;
  name: string;
  nameAr: string;
  defaultCoefficient: number;
  defaultMaxScore: number;
  countsTowardAverage: boolean;
  /** Whether one paper covers the whole matière rather than each component. */
  gradesWholeSubject: boolean;
  /** Whether a teacher may set one from their own workspace. */
  allowTeacherCreate: boolean;
  colorHex: string;
  position: number;
};

export const ASSESSMENT_TYPE_SEEDS: AssessmentTypeSeed[] = [
  {
    code: "CC",
    name: "Contrôle continu",
    nameAr: "المراقبة المستمرة",
    defaultCoefficient: 1,
    defaultMaxScore: 20,
    countsTowardAverage: true,
    // A contrôle continu is sat on the matière: 1AP sits one paper for
    // اللغة العربية, not four for its components.
    gradesWholeSubject: true,
    allowTeacherCreate: false,
    colorHex: "#2a78d6",
    position: 1,
  },
  {
    code: "DS",
    name: "Devoir surveillé",
    nameAr: "فرض محروس",
    // Double a contrôle: a devoir surveillé is the longer, invigilated paper.
    defaultCoefficient: 2,
    defaultMaxScore: 20,
    countsTowardAverage: true,
    gradesWholeSubject: false,
    allowTeacherCreate: false,
    colorHex: "#eb6834",
    position: 2,
  },
  {
    code: "DM",
    name: "Devoir maison",
    nameAr: "واجب منزلي",
    defaultCoefficient: 1,
    defaultMaxScore: 20,
    countsTowardAverage: true,
    gradesWholeSubject: false,
    allowTeacherCreate: true,
    colorHex: "#1baf7a",
    position: 3,
  },
  {
    code: "ORAL",
    name: "Oral",
    nameAr: "شفوي",
    // Orals are commonly marked out of 10 and rescaled, which is exactly why
    // the denominator lives on the type rather than being fixed at 20.
    defaultCoefficient: 1,
    defaultMaxScore: 10,
    countsTowardAverage: true,
    // Same as a contrôle: an oral is passed on the matière, not on الإملاء.
    gradesWholeSubject: true,
    allowTeacherCreate: true,
    colorHex: "#8b5cf6",
    position: 4,
  },
  {
    code: "EXAM",
    name: "Examen normalisé",
    nameAr: "امتحان موحد",
    defaultCoefficient: 3,
    defaultMaxScore: 20,
    countsTowardAverage: true,
    gradesWholeSubject: false,
    allowTeacherCreate: false,
    colorHex: "#dc2626",
    position: 5,
  },
  {
    code: "REMED",
    name: "Remédiation",
    nameAr: "الدعم",
    defaultCoefficient: 1,
    defaultMaxScore: 20,
    // Marked and shown to the family, but never moves the average — that is the
    // whole point of the column.
    countsTowardAverage: false,
    gradesWholeSubject: false,
    allowTeacherCreate: true,
    colorHex: "#64748b",
    position: 6,
  },
];

/**
 * The barèmes a Moroccan school actually runs, keyed by the Ministry level and
 * subject codes the seed resolves to ids — see `MOROCCAN_CURSUS` in
 * modules/academics/presets.ts.
 *
 * Deliberately not empty: a feature nobody can see in the demonstration is a
 * feature the next reader takes out. A contrôle continu is marked out of 10
 * through the primaire and out of 20 from the collège up — the case that made
 * `GradingRule` necessary — and the oral in اللغة العربية is kept at 20 there,
 * exercising the subject-scoped tier over the level-wide one.
 */
export const GRADING_RULE_SEEDS: {
  typeCode: string;
  levelCode: string | null;
  subjectCode: string | null;
  maxScore: number;
  coefficient: number | null;
}[] = [
  { typeCode: "CC", levelCode: "1AP", subjectCode: null, maxScore: 10, coefficient: null },
  { typeCode: "CC", levelCode: "2AP", subjectCode: null, maxScore: 10, coefficient: null },
  { typeCode: "CC", levelCode: "3AP", subjectCode: null, maxScore: 10, coefficient: null },
  { typeCode: "ORAL", levelCode: "1AP", subjectCode: "AR", maxScore: 20, coefficient: null },
];

/** Niveaux whose report cards are written on their own scale, by Ministry code. */
export const LEVEL_REPORT_SCALES: Record<string, number> = {
  "1AP": 10,
  "2AP": 10,
  "3AP": 10,
};
