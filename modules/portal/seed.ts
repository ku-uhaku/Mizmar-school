import bcrypt from "bcryptjs";

import type { SeedDb } from "@/prisma/seed/client";
import { seedStaffFunctions } from "@/modules/users/seed";

/**
 * Portal accounts — the logins the native app is for.
 *
 * Two kinds, and neither is a member of the office staff:
 *
 * * a **chauffeur**, whose `Staff` row already drives a bus, given the school
 *   membership that puts a working year in their context — without one, their
 *   own runs resolve to an empty day.
 * * a handful of **parents**, each the primary contact on a dossier, linked
 *   through `Guardian.userId`. That column exists precisely for this: a
 *   guardian is a row in the family file first and only becomes an account when
 *   a school opens the portal, so seeding it the other way round would put
 *   thousands of dormant logins in front of the permission system.
 *
 * Seeded here rather than in `modules/users/seed.ts` because what makes these
 * accounts exist is a portal being opened, not a post being filled. They are
 * upserted on the username — what they sign in with, and the only column every
 * account has — so re-running changes nothing.
 *
 * Every seeded username carries the school it belongs to. A username is unique
 * across the whole organisation while the things these are derived from are only
 * unique within a school: both établissements number their dossiers from
 * `F-2026-0001`, and both employ a chauffeur the staff seed calls Hassan Alaoui.
 * Without the suffix the second school's upsert would find the first school's
 * account and hand it that school's children — the exact cross-tenant read
 * `householdScope` exists to prevent.
 *
 * Neither kind gets an email address. Nothing signs in with one, and the
 * `parent.f2025-0142@famille.ma` this used to mint was a mailbox that does not
 * exist sitting in a column the reports print. See User.email.
 */

export type SeededPortalAccounts = {
  driverUsername: string | null;
  parentUsernames: string[];
};

export async function seedPortalAccounts(
  db: SeedDb,
  {
    organizationId,
    schoolId,
    schoolCode,
    schoolYearId,
    roles,
    password,
    parentCount = 3,
  }: {
    organizationId: string;
    schoolId: string;
    /** `School.code`, e.g. `ALM-OUJDA` — what distinguishes the usernames. */
    schoolCode: string;
    schoolYearId: string;
    roles: Record<string, string>;
    password: string;
    /** How many households get a login. Three is enough to demonstrate. */
    parentCount?: number;
  },
): Promise<SeededPortalAccounts> {
  const passwordHash = await bcrypt.hash(password, 12);
  const suffix = schoolSuffix(schoolCode);

  const driverUsername = await seedDriverAccount(db, {
    organizationId,
    schoolId,
    schoolYearId,
    suffix,
    roleId: roles["Chauffeur"],
    passwordHash,
  });

  const parentUsernames = await seedParentAccounts(db, {
    organizationId,
    schoolId,
    suffix,
    passwordHash,
    parentCount,
  });

  return { driverUsername, parentUsernames };
}

async function seedDriverAccount(
  db: SeedDb,
  {
    organizationId,
    schoolId,
    schoolYearId,
    suffix,
    roleId,
    passwordHash,
  }: {
    organizationId: string;
    schoolId: string;
    schoolYearId: string;
    suffix: string;
    roleId: string | undefined;
    passwordHash: string;
  },
): Promise<string | null> {
  // Whoever is actually behind a wheel. Picking the driver off the vehicle
  // rather than off a job title means the account always matches the bus the
  // app will show them.
  const vehicle = await db.vehicle.findFirst({
    where: { schoolId, driverId: { not: null } },
    orderBy: { registration: "asc" },
    select: { driver: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });

  const driver = vehicle?.driver;
  if (!driver || !roleId) return null;

  // The school's own list, upserted by the users seed and re-read here rather
  // than duplicated: the chauffeur's fonction is the same row the office sees.
  const functions = await seedStaffFunctions(db, schoolId);

  // The same shape the staff seed derives, so a chauffeur types what everybody
  // else types — plus the school, since the group employs a driver of this name
  // at each of them.
  const username = `${slug(driver.firstName)}.${slug(driver.lastName)}.${suffix}`;

  const user = await db.user.upsert({
    where: { username },
    update: {},
    create: {
      organizationId,
      username,
      passwordHash,
      currentSchoolId: schoolId,
      currentSchoolYearId: schoolYearId,
      profile: {
        create: {
          firstName: driver.firstName,
          lastName: driver.lastName,
          jobFunctionId: functions["Chauffeur"] ?? null,
          phone: driver.phone,
          locale: "fr",
        },
      },
    },
    select: { id: true },
  });

  await db.membership.upsert({
    where: { userId_schoolId: { userId: user.id, schoolId } },
    update: { roleId },
    create: { userId: user.id, schoolId, roleId },
  });

  // The link the app matches on: `listMyRuns` finds a driver's circuits through
  // Vehicle → Staff → User, so the account is worth nothing until the payroll
  // record points at it.
  await db.staff.update({
    where: { id: driver.id },
    data: { userId: user.id },
  });

  return username;
}

async function seedParentAccounts(
  db: SeedDb,
  {
    organizationId,
    schoolId,
    suffix,
    passwordHash,
    parentCount,
  }: {
    organizationId: string;
    schoolId: string;
    suffix: string;
    passwordHash: string;
    parentCount: number;
  },
): Promise<string[]> {
  // Households with children actually enrolled — a portal account on an empty
  // dossier would open onto nothing and prove nothing.
  const guardians = await db.guardian.findMany({
    where: {
      isPrimaryContact: true,
      isActive: true,
      family: {
        schoolId,
        children: { some: { enrollments: { some: {} } } },
      },
    },
    orderBy: { lastName: "asc" },
    take: parentCount,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      userId: true,
      family: { select: { code: true } },
    },
  });

  const usernames: string[] = [];

  for (const guardian of guardians) {
    // Keyed on the dossier, not the surname: two families called Bennani would
    // otherwise fight over one username, and the upsert would hand the second
    // one the first one's children. The school is on the end for the same
    // reason one level up — dossier numbers restart at each établissement. A
    // code like `f-2025-0142.oujda` satisfies USERNAME_PATTERN and its 30-char
    // limit as it stands — see modules/users/enums.ts.
    const username = `${guardian.family.code.toLowerCase()}.${suffix}`;

    const user = await db.user.upsert({
      where: { username },
      update: {},
      create: {
        organizationId,
        username,
        passwordHash,
        // No membership and no role, deliberately: a parent is not staff, and
        // everything they may read is scoped by the household instead. See
        // modules/portal/queries.ts.
        profile: {
          create: {
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            phone: guardian.phone,
            locale: "fr",
          },
        },
      },
      select: { id: true },
    });

    await db.guardian.update({
      where: { id: guardian.id },
      data: { userId: user.id },
    });

    usernames.push(username);
  }

  return usernames;
}

/**
 * The part of a school code that tells two schools apart: `ALM-OUJDA` → `oujda`.
 * Kept short because a username stops at 30 characters and this is appended to
 * one that is already built.
 */
function schoolSuffix(schoolCode: string): string {
  const tail = schoolCode.split("-").pop() ?? schoolCode;
  return slug(tail).slice(0, 8);
}

/** Strips accents so a name becomes a usable username. */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "");
}
