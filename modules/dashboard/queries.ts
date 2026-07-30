import "server-only";

import type { AuthContext } from "@/lib/dal";
import { countRoles } from "@/modules/access/queries";
import { countSchoolYears } from "@/modules/school-years/queries";
import { countActiveSchools } from "@/modules/schools/queries";
import { countUsers } from "@/modules/users/queries";

/**
 * The dashboard's live figures.
 *
 * Every count is scoped to what this user may see, so a school director does not
 * learn the size of the rest of the organisation. The dashboard deliberately
 * owns none of the scoping itself — it composes each module's own count, which
 * is what keeps the numbers consistent with that module's list screen.
 *
 * Placeholder figures for the academic widgets live in `preview.ts`, kept well
 * apart from this file so a demo number cannot be mistaken for a real one.
 */
export type DashboardStats = {
  activeSchools: number;
  userCount: number;
  activeUserCount: number;
  roleCount: number;
  yearCount: number;
};

export async function loadDashboardStats(
  context: AuthContext,
): Promise<DashboardStats> {
  const [activeSchools, users, roleCount, yearCount] = await Promise.all([
    countActiveSchools(context),
    countUsers(context),
    countRoles(context),
    countSchoolYears(context),
  ]);

  return {
    activeSchools,
    userCount: users.total,
    activeUserCount: users.active,
    roleCount,
    yearCount,
  };
}
