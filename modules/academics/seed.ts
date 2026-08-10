import { levelSubjectScopeKey } from "@/modules/academics/enums";
import type { AcademicsPreset } from "@/modules/academics/presets";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Writes one school's academic configuration: cycles, levels, filières, subjects
 * (with their components) and the programme that weights them.
 *
 * The cursus itself lives in `modules/academics/presets.ts` — pure data, shared
 * with the setup wizard, which applies the same catalogue through
 * `modules/setup/service.ts` rather than a second copy of it.
 */



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
