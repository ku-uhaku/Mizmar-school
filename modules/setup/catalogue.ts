import {
  CYCLE_CATALOGUE,
  cycleCatalogueFor,
  ministryLevelCode,
  primaryLevels,
  SUBJECTS,
  type LevelPreset,
  type ProgrammePreset,
  type SubjectPreset,
  type TrackPreset,
} from "@/modules/academics/presets";
import {
  EDUCATION_CYCLES,
  LEVEL_NOMENCLATURES,
  type EducationCycle,
  type LevelNomenclature,
} from "@/modules/academics/enums";
import { FEE_TYPES, FEE_RATES, DISCOUNTS } from "@/modules/billing/presets";
import { SPECIALIST_ROOMS, classroomBlock, type RoomPreset } from "@/modules/facilities/presets";

/**
 * What the wizard offers, sliced by what has been ticked so far.
 *
 * Pure data and pure derivation — it is imported by the browser (the steps read
 * it to render their checkboxes) and by the server (the action resolves every
 * posted code back through it, so a forged name never reaches the database).
 * That double duty is the whole point: the list the user ticked and the list the
 * action trusts are the same list.
 */

export const SETUP_CYCLES: EducationCycle[] = [...EDUCATION_CYCLES].sort(
  (a, b) => CYCLE_CATALOGUE[a].position - CYCLE_CATALOGUE[b].position,
);

/**
 * The default naming of the primary years, and what every function here falls
 * back to. A school that never touches the setting gets 1AP…6AP exactly as
 * before.
 */
export const DEFAULT_NOMENCLATURE: LevelNomenclature = "MOROCCAN";

export function cycleEntry(
  cycle: EducationCycle,
  nomenclature: LevelNomenclature = DEFAULT_NOMENCLATURE,
) {
  return cycleCatalogueFor(cycle, nomenclature);
}

/** Every level of the ticked cycles, in teaching order. */
export function levelsFor(
  cycles: readonly EducationCycle[],
  nomenclature: LevelNomenclature = DEFAULT_NOMENCLATURE,
): LevelPreset[] {
  return SETUP_CYCLES.filter((cycle) => cycles.includes(cycle)).flatMap(
    (cycle) => cycleCatalogueFor(cycle, nomenclature).levels,
  );
}

/** The filières of the ticked levels. Only the qualifying cycle has any. */
export function tracksFor(levelCodes: readonly string[]): TrackPreset[] {
  return SETUP_CYCLES.flatMap((cycle) => CYCLE_CATALOGUE[cycle].tracks).filter(
    (track) => levelCodes.includes(track.levelCode),
  );
}

/**
 * The programme rows the ticked levels and filières imply.
 *
 * A row naming a track that was not ticked is dropped — its subject usually
 * survives through the level's "all tracks" row, which is what makes unticking
 * a filière cost the school nothing it still teaches.
 */
export function programmeFor(
  levelCodes: readonly string[],
  trackCodes: readonly string[],
  nomenclature: LevelNomenclature = DEFAULT_NOMENCLATURE,
): ProgrammePreset[] {
  return SETUP_CYCLES.flatMap(
    (cycle) => cycleCatalogueFor(cycle, nomenclature).programme,
  ).filter(
    (row) =>
      levelCodes.includes(row.levelCode) &&
      (row.trackCode === null || trackCodes.includes(row.trackCode)),
  );
}

/** The subjects those programme rows need, in catalogue order. */
export function subjectsFor(rows: readonly ProgrammePreset[]): SubjectPreset[] {
  const needed = new Set(rows.map((row) => row.subjectCode));
  // A component drags its parent in: a subject with no parent row has nothing
  // to hang its coefficient off.
  for (const subject of SUBJECTS) {
    if (subject.parent && needed.has(subject.code)) needed.add(subject.parent);
  }
  return SUBJECTS.filter((subject) => needed.has(subject.code));
}

export function subjectByCode(code: string): SubjectPreset | undefined {
  return SUBJECTS.find((subject) => subject.code === code);
}

/**
 * A level from its code, under either naming of the primary years.
 *
 * Both are searched rather than the nomenclature being posted alongside: the
 * codes cannot collide (1AP…6AP against CP…6EME), so the code alone says which
 * list it came from, and the action has one less field to be lied to about.
 * Which set the wizard *offered* is a client-side matter.
 */
export function levelByCode(code: string): LevelPreset | undefined {
  return LEVEL_NOMENCLATURES.flatMap((nomenclature) =>
    SETUP_CYCLES.flatMap((cycle) => cycleCatalogueFor(cycle, nomenclature).levels),
  ).find((level) => level.code === code);
}

/**
 * The naming a set of posted level codes belongs to, or the default when none
 * of them is a primary level. Used by the action to refuse a plan that mixes
 * 3AP with CE2 — six primary levels, not twelve.
 */
export function nomenclatureOf(
  codes: readonly string[],
): LevelNomenclature | null {
  const french = new Set(primaryLevels("FRENCH").map((level) => level.code));
  const moroccan = new Set(primaryLevels("MOROCCAN").map((level) => level.code));

  const seen = new Set(
    codes
      .map((code) =>
        french.has(code) ? "FRENCH" : moroccan.has(code) ? "MOROCCAN" : null,
      )
      .filter((value): value is LevelNomenclature => value !== null),
  );

  return seen.size === 1 ? [...seen][0] : null;
}

export function trackByCode(code: string): TrackPreset | undefined {
  return SETUP_CYCLES.flatMap((cycle) => CYCLE_CATALOGUE[cycle].tracks).find(
    (track) => track.code === code,
  );
}

export function feeTypeByCode(code: string) {
  return FEE_TYPES.find((fee) => fee.code === code);
}

export function discountByCode(code: string) {
  return DISCOUNTS.find((discount) => discount.code === code);
}

/** What the catalogue charges for a level, in dirhams, or the flat price. */
export function suggestedFeeAmount(feeCode: string, levelCode: string | null): number | null {
  // The price list is written once, against the Ministry's years — a school
  // running CE2 is charged the 3AP price rather than falling through to the
  // flat rate and showing a blank scolarité.
  const ministry = levelCode === null ? null : ministryLevelCode(levelCode);
  const exact = FEE_RATES.find(
    (rate) => rate.feeCode === feeCode && rate.levelCode === ministry,
  );
  if (exact) return exact.dirhams;
  const flat = FEE_RATES.find((rate) => rate.feeCode === feeCode && rate.levelCode === null);
  return flat?.dirhams ?? null;
}

/** Which lab kinds the chosen programme actually needs a room for. */
export function labKindsFor(subjectCodes: readonly string[]): string[] {
  const kinds: string[] = [];
  const needsScience = subjectCodes.some((code) => code === "SVT" || code === "PC");
  if (needsScience) kinds.push("LAB_SCIENCE");
  if (subjectCodes.includes("INFO")) kinds.push("LAB_COMPUTER");
  if (subjectCodes.includes("EPS")) kinds.push("SPORTS");
  return kinds;
}

/** The letter and building a cycle's classrooms are numbered under. */
const CYCLE_BUILDING: Record<EducationCycle, { letter: string; building: string; capacity: number }> = {
  PRESCHOOL: { letter: "P", building: "Bâtiment P — préscolaire", capacity: 24 },
  PRIMARY: { letter: "A", building: "Bâtiment A — primaire", capacity: 30 },
  SECONDARY_COLLEGE: { letter: "B", building: "Bâtiment B — collège", capacity: 36 },
  SECONDARY_QUALIFYING: { letter: "C", building: "Bâtiment C — lycée", capacity: 36 },
};

/**
 * A room list sized to what the school is actually opening.
 *
 * One salle per class per cycle plus the specialist rooms its programme needs —
 * a school that teaches no science is not offered two laboratoires, and a school
 * opening thirty classes is not left with the demonstration's twenty-four
 * salles. Always at least one classroom per cycle, so a cycle with no class
 * counts yet still shows its building.
 */
export function suggestedRooms(input: {
  cycles: readonly EducationCycle[];
  classCountByCycle: Partial<Record<EducationCycle, number>>;
  subjectCodes: readonly string[];
}): RoomPreset[] {
  const classrooms = SETUP_CYCLES.filter((cycle) => input.cycles.includes(cycle)).flatMap(
    (cycle) =>
      classroomBlock({
        ...CYCLE_BUILDING[cycle],
        count: Math.max(1, input.classCountByCycle[cycle] ?? 1),
      }),
  );

  const kinds = labKindsFor(input.subjectCodes);
  const specialist = SPECIALIST_ROOMS.filter(
    (room) =>
      kinds.includes(room.kind) || room.kind === "LIBRARY" || room.kind === "OUTDOOR",
  );

  return [...classrooms, ...specialist];
}

/**
 * The class codes an offering will produce — `3AP-A`, `2BAC-2B-SVT-B`.
 *
 * The same convention `seedClasses` uses, so a wizard-built school and a seeded
 * one name their classes the same way.
 */
export const CLASS_SECTIONS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function classCodesFor(
  levelCode: string,
  trackCode: string | null,
  count: number,
): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    [levelCode, trackCode, CLASS_SECTIONS[index]].filter(Boolean).join("-"),
  );
}
