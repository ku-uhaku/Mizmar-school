import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";

/**
 * Reads for the school-years module. See modules/schools/queries.ts for the
 * contract.
 *
 * Note that the years of the *current* school are already loaded by the DAL for
 * the context switcher, so the school-years page reads `context.schoolYears`
 * rather than calling in here — a second query for the same rows would be
 * wasted work. These functions exist for the cases the DAL does not cover.
 */

/** Years of one school, newest first. Assumes the caller checked visibility. */
export function listSchoolYears(schoolId: string) {
  return db.schoolYear.findMany({
    where: { schoolId },
    orderBy: [{ startDate: "desc" }],
  });
}

/**
 * The year a school should land on when it becomes the working context:
 * its default, else the active one, else the most recent. Null when it has none.
 *
 * One pass rather than three queries — the three preferences are a fallback
 * chain over the same rows, and asking three times would be three round-trips
 * to answer one question. But only the three columns that decide it: this runs
 * on every school switch, and the caller keeps an id.
 */
export async function defaultSchoolYearFor(
  schoolId: string,
): Promise<{ id: string } | null> {
  const years = await db.schoolYear.findMany({
    where: { schoolId },
    orderBy: [{ startDate: "desc" }],
    select: { id: true, isDefault: true, status: true },
  });

  return (
    years.find((year) => year.isDefault) ??
    years.find((year) => year.status === "ACTIVE") ??
    years[0] ??
    null
  );
}

/** Live count for the dashboard, scoped to the schools this user can see. */
export function countSchoolYears(context: AuthContext): Promise<number> {
  return db.schoolYear.count({
    where: { schoolId: { in: context.schools.map((school) => school.id) } },
  });
}
