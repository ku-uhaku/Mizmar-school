import "server-only";

import type { AuthContext } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";
import { countRoles } from "@/modules/access/queries";
import { hrSummary } from "@/modules/hr/queries";
import { countSchoolYears } from "@/modules/school-years/queries";
import { countActiveSchools } from "@/modules/schools/queries";
import { loadSchoolLifeStats } from "@/modules/school-life/queries";
import { transportSummary } from "@/modules/transport/queries";
import { treasurySummary } from "@/modules/treasury/queries";
import { countUsers } from "@/modules/users/queries";

/**
 * The dashboard's live figures.
 *
 * Every count is scoped to what this user may see, so a school director does not
 * learn the size of the rest of the organisation. The dashboard deliberately
 * owns none of the scoping itself — it composes each module's own count, which
 * is what keeps the numbers consistent with that module's list screen.
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

/**
 * One headline per section, for the cards on the main dashboard.
 *
 * A section the reader may not open comes back `null` rather than zeroed: a
 * card reading "0 pupils" is a claim about the school, and the reader has not
 * earned it. The permission checked here is the same one that puts the section
 * in the sidebar, so the dashboard and the nav cannot disagree about what the
 * app contains.
 */
export type SectionHeadline = {
  /** The figure the card leads with. */
  value: number;
  /** A second figure, when the section has one worth carrying. */
  detail: number;
  /** Something waiting on somebody — drawn as a warning on the card. */
  attention: number;
};

export type SectionHeadlines = {
  vieScolaire: SectionHeadline | null;
  finance: SectionHeadline | null;
  logistique: SectionHeadline | null;
  rh: SectionHeadline | null;
};

export async function loadSectionHeadlines(
  context: AuthContext,
): Promise<SectionHeadlines> {
  const now = new Date();

  const [life, treasury, transport, hr] = await Promise.all([
    context.can(PERMISSIONS.SCHOOL_LIFE_VIEW)
      ? loadSchoolLifeStats(context)
      : null,
    context.can(PERMISSIONS.TREASURY_VIEW) ? treasurySummary(context) : null,
    context.can(PERMISSIONS.TRANSPORT_VIEW) ? transportSummary(context) : null,
    context.can(PERMISSIONS.HR_VIEW)
      ? hrSummary(context, now.getFullYear(), now.getMonth() + 1)
      : null,
  ]);

  return {
    vieScolaire: life
      ? {
          value: life.students.total,
          detail: life.enrolment.enrolled,
          attention: life.enrolment.unplaced,
        }
      : null,
    finance: treasury
      ? {
          // Dirhams, not centimes: the card prints it as money, and rounding at
          // the source stops every caller re-deciding the same thing.
          value: Math.round(treasury.collectedTodayCentimes / 100),
          detail: treasury.openRegisterCount,
          attention: treasury.chequesBouncedCount,
        }
      : null,
    logistique: transport
      ? {
          value: transport.riderCount,
          detail: transport.routeCount,
          attention: transport.paperworkDue,
        }
      : null,
    rh: hr
      ? {
          value: hr.headcount,
          detail: hr.pendingLeave,
          attention: hr.unmarkedToday,
        }
      : null,
  };
}
