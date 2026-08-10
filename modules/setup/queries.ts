import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { settingsOf, type SchoolSettingsValues } from "@/lib/school-settings";

/**
 * What a school already has, for the wizard's second entry point.
 *
 * A school reached through `/schools/[schoolId]/setup` is usually not empty —
 * that is the case the wizard is most wanted for — so the steps pre-tick what
 * is already there and default to leaving it alone. Counts drive the banner
 * that says so.
 */

export type SetupSnapshot = {
  school: {
    id: string;
    code: string;
    name: string;
    city: string | null;
  };
  settings: SchoolSettingsValues;
  years: { id: string; name: string; startDate: Date; endDate: Date; isDefault: boolean }[];
  cycles: string[];
  levelCodes: string[];
  trackCodes: string[];
  subjectCodes: string[];
  feeTypeCodes: string[];
  counts: {
    levels: number;
    tracks: number;
    subjects: number;
    programme: number;
    rooms: number;
    timeSlots: number;
    classes: number;
    feeTypes: number;
  };
};

export async function setupSnapshot(
  context: AuthContext,
  schoolId: string,
): Promise<SetupSnapshot | null> {
  // Scoped by the organisation *and* by what the session can reach, so an id
  // from another tenant resolves to nothing rather than to a 403 that confirms
  // the school exists.
  if (!context.schools.some((school) => school.id === schoolId)) return null;

  const school = await db.school.findFirst({
    where: { id: schoolId, organizationId: context.organization.id },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      settings: true,
      schoolYears: {
        select: { id: true, name: true, startDate: true, endDate: true, isDefault: true },
        orderBy: { startDate: "desc" },
      },
      educationLevels: { select: { cycle: true } },
      levels: { select: { code: true }, orderBy: { position: "asc" } },
      subjects: { select: { code: true }, orderBy: { code: "asc" } },
      feeTypes: { select: { code: true }, orderBy: { position: "asc" } },
      _count: { select: { levels: true, subjects: true, rooms: true, classes: true, feeTypes: true } },
    },
  });
  if (!school) return null;

  const [tracks, programme, timeSlots] = await Promise.all([
    db.track.findMany({
      where: { level: { schoolId } },
      select: { code: true },
      orderBy: { position: "asc" },
    }),
    db.levelSubject.count({ where: { level: { schoolId } } }),
    db.timeSlot.count({ where: { schoolYear: { schoolId } } }),
  ]);

  return {
    school: { id: school.id, code: school.code, name: school.name, city: school.city },
    settings: settingsOf(school.settings),
    years: school.schoolYears,
    cycles: school.educationLevels.map((row) => row.cycle),
    levelCodes: school.levels.map((row) => row.code),
    trackCodes: tracks.map((row) => row.code),
    subjectCodes: school.subjects.map((row) => row.code),
    feeTypeCodes: school.feeTypes.map((row) => row.code),
    counts: {
      levels: school._count.levels,
      tracks: tracks.length,
      subjects: school._count.subjects,
      programme,
      rooms: school._count.rooms,
      timeSlots,
      classes: school._count.classes,
      feeTypes: school._count.feeTypes,
    },
  };
}
