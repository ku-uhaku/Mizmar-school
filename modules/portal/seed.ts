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
 * upserted on the email like every other seeded account, so re-running changes
 * nothing.
 */

export type SeededPortalAccounts = {
  driverEmail: string | null;
  parentEmails: string[];
};

export async function seedPortalAccounts(
  db: SeedDb,
  {
    organizationId,
    schoolId,
    schoolYearId,
    roles,
    password,
    parentCount = 3,
  }: {
    organizationId: string;
    schoolId: string;
    schoolYearId: string;
    roles: Record<string, string>;
    password: string;
    /** How many households get a login. Three is enough to demonstrate. */
    parentCount?: number;
  },
): Promise<SeededPortalAccounts> {
  const passwordHash = await bcrypt.hash(password, 12);

  const driverEmail = await seedDriverAccount(db, {
    organizationId,
    schoolId,
    schoolYearId,
    roleId: roles["Chauffeur"],
    passwordHash,
  });

  const parentEmails = await seedParentAccounts(db, {
    organizationId,
    schoolId,
    passwordHash,
    parentCount,
  });

  return { driverEmail, parentEmails };
}

async function seedDriverAccount(
  db: SeedDb,
  {
    organizationId,
    schoolId,
    schoolYearId,
    roleId,
    passwordHash,
  }: {
    organizationId: string;
    schoolId: string;
    schoolYearId: string;
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

  const email = `${slug(driver.firstName)}.${slug(driver.lastName)}@almanar.ma`;

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      organizationId,
      email,
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

  return email;
}

async function seedParentAccounts(
  db: SeedDb,
  {
    organizationId,
    schoolId,
    passwordHash,
    parentCount,
  }: {
    organizationId: string;
    schoolId: string;
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

  const emails: string[] = [];

  for (const guardian of guardians) {
    // Keyed on the dossier, not the surname: two families called Bennani would
    // otherwise fight over one address, and the upsert would hand the second
    // one the first one's children.
    const email = `parent.${guardian.family.code.toLowerCase()}@famille.ma`;

    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        organizationId,
        email,
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

    emails.push(email);
  }

  return emails;
}

/** Strips accents so a name becomes a usable local part. */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "");
}
