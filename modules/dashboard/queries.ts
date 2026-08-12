import "server-only";

import type { AuthContext } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";
import { countRoles } from "@/modules/access/queries";
import { countEnrolmentsByLevel } from "@/modules/enrolment/queries";
import { hrSummary } from "@/modules/hr/queries";
import { countSchoolYears } from "@/modules/school-years/queries";
import { countActiveSchools } from "@/modules/schools/queries";
import { loadSchoolLifeSummary } from "@/modules/school-life/queries";
import { transportSummary } from "@/modules/transport/queries";
import {
  collectionsByMonth,
  schoolCollectionStanding,
  treasurySummary,
} from "@/modules/treasury/queries";
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
  /** Always answered: it counts the schools this reader can already see. */
  activeSchools: number;
  /** Null without `user.view`. */
  users: { total: number; active: number } | null;
  /** Null without `role.view` org-wide — a role is an organisation-level thing. */
  roleCount: number | null;
  /** Null without `schoolYear.view`. */
  yearCount: number | null;
};

/**
 * The four administrative tiles.
 *
 * ── Gated the same way the section cards are ────────────────────────────────
 * These used to be taken unconditionally, which put a figure on the screen for
 * every reader: a teacher's dashboard showed the headcount of every account in
 * their school and the number of roles in the *organisation* — `countRoles` is
 * scoped to the tenant and to nothing else, so it was the one figure here not
 * narrowed to what the reader can reach at all.
 *
 * A count is not contents, but it is still a claim about the school, and the
 * two functions below already refuse to make one on a reader's behalf. The page
 * knew the permissions too — it used them to decide whether each tile was a
 * *link*, so somebody without `role.view` got the number and no way to open it.
 *
 * `activeSchools` stays ungated because it counts `context.schools`, which is
 * the reader's own reach by construction.
 */
export async function loadDashboardStats(
  context: AuthContext,
): Promise<DashboardStats> {
  const canSeeUsers = context.can(PERMISSIONS.USER_VIEW);
  const canSeeRoles = context.canOrg(PERMISSIONS.ROLE_VIEW);
  const canSeeYears = context.can(PERMISSIONS.SCHOOL_YEAR_VIEW);

  const [activeSchools, users, roleCount, yearCount] = await Promise.all([
    countActiveSchools(context),
    canSeeUsers ? countUsers(context) : null,
    canSeeRoles ? countRoles(context) : null,
    canSeeYears ? countSchoolYears(context) : null,
  ]);

  return { activeSchools, users, roleCount, yearCount };
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
  /**
   * A second figure, when the section has one worth carrying — null when the
   * reader holds the section but not the code behind this particular number.
   * The card then omits the line rather than printing a zero it cannot stand
   * behind, which is the same rule the section itself is gated by.
   */
  detail: number | null;
  /** Something waiting on somebody — drawn as a warning on the card. */
  attention: number | null;
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
      ? loadSchoolLifeSummary(context)
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
          value: life.students,
          detail: life.enrolled,
          attention: life.unplaced,
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

/**
 * The series the dashboard charts.
 *
 * Composed from each owning module's own read, never queried here — the same
 * rule the counts follow. A section the reader may not open comes back empty
 * rather than zeroed: an empty chart says "nothing to show", and a zeroed one
 * makes a claim about the school the reader has not earned.
 */
export type DashboardCharts = {
  /** Pupils per level offered this year. Empty when enrolment is not visible. */
  enrolmentByLevel: { label: string; value: number }[];
  /** Collected per month, `YYYY-MM` labels — the caller formats them. */
  collectionsByMonth: { label: string; value: number }[];
  /** The year's fees, paid against outstanding. Null when money is hidden. */
  collection: {
    chargedCentimes: number;
    paidCentimes: number;
    outstandingCentimes: number;
    overdueCentimes: number;
  } | null;
};

export async function loadDashboardCharts(
  context: AuthContext,
): Promise<DashboardCharts> {
  const canSeeEnrolment = context.can(PERMISSIONS.ENROLMENT_VIEW);
  const canSeeMoney = context.can(PERMISSIONS.TREASURY_VIEW);

  const [enrolmentByLevel, collections, collection] = await Promise.all([
    canSeeEnrolment ? countEnrolmentsByLevel(context) : [],
    canSeeMoney ? collectionsByMonth(context) : [],
    canSeeMoney ? schoolCollectionStanding(context) : null,
  ]);

  return {
    enrolmentByLevel: byLevel(enrolmentByLevel),
    collectionsByMonth: collections,
    collection,
  };
}

/**
 * Folds each level's filières back into the level.
 *
 * The enrolment query splits by *offering*, so a qualifying cycle comes back as
 * "2BAC 2B-SVT", "2BAC 2B-PC", "2BAC 2B-SM-A", "2BAC 2B-L" — eighteen columns
 * for twelve levels, on a chart 220 pixels tall whose axis labels then collide
 * into an unreadable row.
 *
 * The dashboard is a glance, and at that altitude the question is "how big is
 * each level", not "how does 2BAC split across its filières" — which is the
 * classes screen's question, where there is room to answer it. So the tracks
 * are summed into their level here rather than upstream, and the full split
 * stays available to everyone else who calls the query.
 *
 * Order is preserved from the source, which is by year of study, so the axis
 * still reads 1AP through 2BAC rather than alphabetically.
 */
function byLevel(
  rows: { label: string; levelCode: string; value: number }[],
): { label: string; value: number }[] {
  const merged: { label: string; value: number }[] = [];
  const seen = new Map<string, number>();

  for (const row of rows) {
    const at = seen.get(row.levelCode);
    if (at === undefined) {
      seen.set(row.levelCode, merged.length);
      merged.push({ label: row.levelCode, value: row.value });
    } else {
      merged[at].value += row.value;
    }
  }

  return merged;
}
