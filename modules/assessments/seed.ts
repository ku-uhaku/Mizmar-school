import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The kinds of evaluation a Moroccan school runs.
 *
 * Only the *types* are seeded, never the papers themselves. Generating a round
 * of contrôles attributes them to teachers and opens them for marking, and a
 * re-run of the seed would keep re-creating rows nobody planned — so the
 * calendar is set through the screen, which is also the shortest way to see the
 * generator work.
 *
 * Idempotent: upserts on `(schoolId, code)`.
 */

export type AssessmentTypeSeed = {
  code: string;
  name: string;
  nameAr: string;
  defaultCoefficient: number;
  defaultMaxScore: number;
  countsTowardAverage: boolean;
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
    allowTeacherCreate: true,
    colorHex: "#64748b",
    position: 6,
  },
];

export async function seedAssessmentTypes(
  db: SeedDb,
  schoolId: string,
): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();

  for (const seed of ASSESSMENT_TYPE_SEEDS) {
    const type = await db.assessmentType.upsert({
      where: { schoolId_code: { schoolId, code: seed.code } },
      update: {
        name: seed.name,
        nameAr: seed.nameAr,
        defaultCoefficient: seed.defaultCoefficient,
        defaultMaxScore: seed.defaultMaxScore,
        countsTowardAverage: seed.countsTowardAverage,
        allowTeacherCreate: seed.allowTeacherCreate,
        colorHex: seed.colorHex,
        position: seed.position,
      },
      create: {
        schoolId,
        code: seed.code,
        name: seed.name,
        nameAr: seed.nameAr,
        defaultCoefficient: seed.defaultCoefficient,
        defaultMaxScore: seed.defaultMaxScore,
        countsTowardAverage: seed.countsTowardAverage,
        allowTeacherCreate: seed.allowTeacherCreate,
        colorHex: seed.colorHex,
        position: seed.position,
      },
      select: { id: true },
    });
    idByCode.set(seed.code, type.id);
  }

  log("assessment types", idByCode.size);
  return idByCode;
}
