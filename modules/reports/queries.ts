import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolId, currentSchoolYearId } from "@/lib/scope";

/**
 * The choices the report filter bar offers.
 *
 * Loaded together because a report screen shows several at once and one round
 * trip per dropdown is three round trips for one page. Everything is scoped to
 * the working context, so a filter narrows a report and can never widen it.
 */

export type FilterChoice = {
  id: string;
  label: string;
  /**
   * What this choice hangs off, so the filter bar can cascade without a round
   * trip: a level carries its cycle, a class carries its level offering. The
   * whole set is small — a few dozen rows — so shipping it once and narrowing
   * in the browser beats a request per dropdown.
   */
  parentId?: string;
};

export type ReportFilterChoices = {
  levels: FilterChoice[];
  classes: FilterChoice[];
  cycles: FilterChoice[];
  staff: FilterChoice[];
  feeTypes: FilterChoice[];
};

export async function loadFilterChoices(
  context: AuthContext,
): Promise<ReportFilterChoices> {
  const schoolId = currentSchoolId(context);
  const schoolYearId = currentSchoolYearId(context);

  const [levels, classes, cycles, staff, feeTypes] = await Promise.all([
    db.levelOffering.findMany({
      where: { schoolYearId, isActive: true },
      orderBy: [{ level: { position: "asc" } }],
      select: {
        id: true,
        level: {
          select: {
            name: true,
            educationLevel: { select: { cycle: true } },
          },
        },
        track: { select: { name: true } },
      },
    }),
    db.schoolClass.findMany({
      where: { schoolId, levelOffering: { schoolYearId }, isActive: true },
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, levelOfferingId: true },
    }),
    db.educationLevel.findMany({
      where: { schoolId },
      orderBy: [{ position: "asc" }],
      select: { cycle: true, name: true },
    }),
    db.staff.findMany({
      where: { schoolId },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, code: true, firstName: true, lastName: true },
    }),
    db.feeType.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ position: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return {
    levels: levels.map((offering) => ({
      id: offering.id,
      label: offering.track
        ? `${offering.level.name} — ${offering.track.name}`
        : offering.level.name,
      parentId: offering.level.educationLevel.cycle,
    })),
    classes: classes.map((row) => ({
      id: row.id,
      label: row.code,
      parentId: row.levelOfferingId,
    })),
    // Keyed on the cycle string rather than the row id: `Level.educationLevel`
    // is per school, and the filter is asked in terms of the cycle itself.
    cycles: cycles.map((row) => ({ id: row.cycle, label: row.name })),
    staff: staff.map((row) => ({
      id: row.id,
      label: `${row.lastName} ${row.firstName} — ${row.code}`,
    })),
    feeTypes: feeTypes.map((row) => ({ id: row.id, label: row.name })),
  };
}

/**
 * Which reports this reader has starred.
 *
 * Returned as a Set of catalogue ids rather than rows: the only question any
 * caller asks is "is this one starred", and the index page asks it fifty times.
 * Ids naming a report that no longer exists are simply never matched — see the
 * note on `ReportFavourite.reportId`.
 */
export async function loadFavouriteReportIds(
  context: AuthContext,
): Promise<Set<string>> {
  const rows = await db.reportFavourite.findMany({
    where: { userId: context.user.id },
    select: { reportId: true },
  });
  return new Set(rows.map((row) => row.reportId));
}
