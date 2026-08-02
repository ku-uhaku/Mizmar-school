import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";

/**
 * Reads for the schools module.
 *
 * Every function takes the `AuthContext` and scopes its own `where` clause to
 * what that actor may see. Keeping the scoping here rather than in the pages
 * means the list and the detail view can never disagree about visibility, and a
 * new screen gets it right by calling the same function.
 */

/** The shape the schools table and form both render. */
export type SchoolRow = {
  id: string;
  code: string;
  name: string;
  /** The code établissement in MASSAR. Null until an administrator maps it. */
  massarCode: string | null;
  level: string;
  directorName: string | null;
  capacity: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  isActive: boolean;
  yearCount: number;
  memberCount: number;
};

/** Counts the table shows next to each school. */
const WITH_COUNTS = {
  _count: { select: { schoolYears: true, memberships: true } },
} as const;

type SchoolWithCounts = Awaited<
  ReturnType<typeof db.school.findFirstOrThrow<{ include: typeof WITH_COUNTS }>>
>;

function toRow(school: SchoolWithCounts): SchoolRow {
  return {
    id: school.id,
    code: school.code,
    name: school.name,
    massarCode: school.massarCode,
    level: school.level,
    directorName: school.directorName,
    capacity: school.capacity,
    email: school.email,
    phone: school.phone,
    website: school.website,
    logoUrl: school.logoUrl,
    addressLine: school.addressLine,
    city: school.city,
    region: school.region,
    postalCode: school.postalCode,
    country: school.country,
    isActive: school.isActive,
    yearCount: school._count.schoolYears,
    memberCount: school._count.memberships,
  };
}

/** Only the schools this user can see. Callers still check SCHOOL_VIEW. */
export async function listSchools(context: AuthContext): Promise<SchoolRow[]> {
  const schools = await db.school.findMany({
    where: { id: { in: context.schools.map((school) => school.id) } },
    orderBy: { name: "asc" },
    include: WITH_COUNTS,
  });
  return schools.map(toRow);
}

/**
 * One school, scoped by organisation so a crafted id cannot reach another
 * tenant's row. Returns null when it does not exist or is out of reach; callers
 * turn that into `notFound()`.
 */
export async function findSchool(
  context: AuthContext,
  schoolId: string,
): Promise<SchoolRow | null> {
  const school = await db.school.findFirst({
    where: { id: schoolId, organizationId: context.organization.id },
    include: WITH_COUNTS,
  });
  return school ? toRow(school) : null;
}

/** Live counts for the dashboard, scoped to the schools this user can see. */
export async function countActiveSchools(
  context: AuthContext,
): Promise<number> {
  return db.school.count({
    where: {
      id: { in: context.schools.map((school) => school.id) },
      isActive: true,
    },
  });
}
