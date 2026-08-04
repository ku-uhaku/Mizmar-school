import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Which spaces of the native app an account may open.
 *
 * The mobile app is not a smaller copy of the web app: it is four small
 * experiences, and an account gets the ones it has grounds for. Two of them are
 * decided by *what the person is* rather than by a permission — a parent is a
 * guardian on a dossier, a chauffeur is the driver of a bus — because neither
 * fact is expressible as a permission code and neither should put the person in
 * the permission system at all.
 *
 * This only decides what the app offers. It grants nothing: every endpoint
 * still authorizes on its own, so an account that lies about its space reaches
 * exactly as much as it could without lying.
 */
export const MOBILE_SPACES = [
  "family",
  "teacher",
  "driver",
  "director",
] as const;

export type MobileSpace = (typeof MOBILE_SPACES)[number];

export type MobileIdentity = {
  userId: string;
  email: string;
  fullName: string;
  organizationName: string;
  schoolName: string | null;
  schoolYearName: string | null;
  spaces: MobileSpace[];
  /** The one the app opens on — the richest space the account holds. */
  defaultSpace: MobileSpace | null;
};

export async function loadMobileIdentity(
  context: AuthContext,
): Promise<MobileIdentity> {
  const userId = context.user.id;

  const [guardianCount, teachingCount, drivesCount] = await Promise.all([
    db.guardian.count({ where: { userId, isActive: true } }),
    // Either actually assigned to teach, or holding the classroom permission —
    // a supply teacher with no assignments yet still needs the space.
    db.teachingAssignment.count({ where: { teacherId: userId } }),
    db.vehicle.count({ where: { driver: { userId } } }),
  ]);

  const spaces: MobileSpace[] = [];
  if (guardianCount > 0) spaces.push("family");
  if (teachingCount > 0 || context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
    spaces.push("teacher");
  }
  if (drivesCount > 0 || context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
    spaces.push("driver");
  }
  if (context.can(PERMISSIONS.SCHOOL_LIFE_VIEW) || context.isSuperAdmin) {
    spaces.push("director");
  }

  const profile = context.user.profile;
  const fullName =
    profile && (profile.firstName || profile.lastName)
      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
      : context.user.email;

  // Ordered by how much the space carries, so a director who also teaches lands
  // on the dashboard rather than on their own timetable.
  const preference: MobileSpace[] = ["director", "teacher", "driver", "family"];

  return {
    userId,
    email: context.user.email,
    fullName,
    organizationName: context.organization.name,
    schoolName: context.currentSchool?.name ?? null,
    schoolYearName: context.currentSchoolYear?.name ?? null,
    spaces,
    defaultSpace: preference.find((space) => spaces.includes(space)) ?? null,
  };
}
