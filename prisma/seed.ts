import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../lib/generated/prisma/client";
import { PERMISSION_GROUPS, type PermissionCode } from "../lib/permissions";
import { SYSTEM_ROLES } from "../modules/access/system-roles";

/**
 * Idempotent seed: safe to re-run. It upserts the permission catalogue and the
 * system roles, then creates a demo organisation with three schools and a set
 * of users covering each role, so the dashboard has something to show.
 */

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@groupescolaire.ma";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

async function seedPermissions() {
  for (const { group, codes } of PERMISSION_GROUPS) {
    for (const code of codes) {
      await db.permission.upsert({
        where: { code },
        update: { group },
        create: { code, group },
      });
    }
  }
  console.log("  permissions ✓");
}

async function seedOrganization() {
  const existing = await db.organization.findFirst();
  if (existing) return existing;

  return db.organization.create({
    data: {
      name: "Groupe Scolaire Al Manar",
      legalName: "Groupe Scolaire Al Manar SARL",
      ice: "001945872000047",
      taxId: "14582369",
      email: "contact@almanar.ma",
      phone: "+212 522 45 67 89",
      website: "https://almanar.ma",
      addressLine: "12, Boulevard Zerktouni",
      city: "Casablanca",
      region: "Casablanca-Settat",
      postalCode: "20250",
      country: "MA",
      defaultLocale: "fr",
    },
  });
}

async function seedRoles(organizationId: string) {
  const permissions = await db.permission.findMany();
  const idByCode = new Map(permissions.map((p) => [p.code, p.id]));

  const roles = new Map<string, string>();

  for (const definition of SYSTEM_ROLES) {
    const role = await db.role.upsert({
      where: {
        organizationId_name: { organizationId, name: definition.name },
      },
      update: {
        description: definition.description,
        scope: definition.scope,
        isSystem: true,
      },
      create: {
        organizationId,
        name: definition.name,
        description: definition.description,
        scope: definition.scope,
        isSystem: true,
      },
    });

    // Reset to the declared permission set so re-running the seed repairs any
    // drift in the built-in roles.
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: definition.permissions
        .map((code: PermissionCode) => idByCode.get(code))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    });

    roles.set(definition.name, role.id);
  }

  console.log(`  roles ✓ (${roles.size})`);
  return roles;
}

const SCHOOLS = [
  {
    code: "ALM-CASA",
    name: "Al Manar Casablanca",
    level: "GROUP",
    city: "Casablanca",
    region: "Casablanca-Settat",
    postalCode: "20250",
    addressLine: "12, Boulevard Zerktouni",
    directorName: "Nadia Benali",
    capacity: 840,
    phone: "+212 522 45 67 90",
    email: "casablanca@almanar.ma",
  },
  {
    code: "ALM-RABAT",
    name: "Al Manar Rabat Agdal",
    level: "PRIMARY",
    city: "Rabat",
    region: "Rabat-Salé-Kénitra",
    postalCode: "10090",
    addressLine: "45, Avenue de France, Agdal",
    directorName: "Youssef El Amrani",
    capacity: 520,
    phone: "+212 537 77 12 34",
    email: "rabat@almanar.ma",
  },
  {
    code: "ALM-MARR",
    name: "Al Manar Marrakech",
    level: "HIGH",
    city: "Marrakech",
    region: "Marrakech-Safi",
    postalCode: "40000",
    addressLine: "Route de Targa, Quartier Semlalia",
    directorName: "Salma Cherkaoui",
    capacity: 610,
    phone: "+212 524 43 21 08",
    email: "marrakech@almanar.ma",
  },
];

async function seedSchools(organizationId: string) {
  const schools = [];
  for (const school of SCHOOLS) {
    schools.push(
      await db.school.upsert({
        where: {
          organizationId_code: { organizationId, code: school.code },
        },
        update: {},
        create: { organizationId, ...school },
      }),
    );
  }
  console.log(`  schools ✓ (${schools.length})`);
  return schools;
}

/** Three years per school: last one closed, current active, next planned. */
async function seedSchoolYears(schoolIds: string[]) {
  let count = 0;
  const definitions = [
    { name: "2024-2025", start: "2024-09-09", end: "2025-07-04", status: "CLOSED", isDefault: false },
    { name: "2025-2026", start: "2025-09-08", end: "2026-07-03", status: "ACTIVE", isDefault: true },
    { name: "2026-2027", start: "2026-09-07", end: "2027-07-02", status: "PLANNED", isDefault: false },
  ];

  for (const schoolId of schoolIds) {
    for (const year of definitions) {
      await db.schoolYear.upsert({
        where: { schoolId_name: { schoolId, name: year.name } },
        update: {},
        create: {
          schoolId,
          name: year.name,
          startDate: new Date(year.start),
          endDate: new Date(year.end),
          status: year.status,
          isDefault: year.isDefault,
        },
      });
      count += 1;
    }
  }
  console.log(`  school years ✓ (${count})`);
}

async function seedUsers(
  organizationId: string,
  roles: Map<string, string>,
  schools: { id: string; name: string }[],
) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const defaultYear = await db.schoolYear.findFirst({
    where: { schoolId: schools[0].id, isDefault: true },
  });

  // Language and appearance are reset on every seed so re-running restores a
  // known demo state. Everything else about an existing user is left alone.
  const DEFAULT_PREFS = {
    locale: "fr",
    themeMode: "system",
    accent: "blue",
    fontFamily: "geist",
    fontSize: "md",
    radius: "md",
  };

  // The super administrator. Deliberately keeps `isSuperAdmin` so the org can
  // never be locked out by an unlucky role edit.
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      profile: { update: { ...DEFAULT_PREFS, birthDate: new Date("1978-04-12") } },
    },
    create: {
      organizationId,
      email: ADMIN_EMAIL,
      passwordHash,
      isSuperAdmin: true,
      orgRoleId: roles.get("Administrateur"),
      currentSchoolId: schools[0].id,
      currentSchoolYearId: defaultYear?.id,
      profile: {
        create: {
          firstName: "Amine",
          lastName: "Tazi",
          jobTitle: "Directeur général",
          phone: "+212 661 23 45 67",
          birthDate: new Date("1978-04-12"),
          locale: "fr",
        },
      },
    },
  });

  const staff = [
    {
      email: "pedagogie@almanar.ma",
      firstName: "Hafsa",
      birthDate: new Date("1985-09-03"),
      lastName: "Idrissi",
      jobTitle: "Responsable pédagogique",
      orgRole: "Responsable pédagogique",
      memberships: [] as { schoolIndex: number; role: string }[],
    },
    {
      email: "directeur.casa@almanar.ma",
      firstName: "Nadia",
      birthDate: new Date("1981-01-27"),
      lastName: "Benali",
      jobTitle: "Directrice",
      orgRole: null,
      memberships: [{ schoolIndex: 0, role: "Directeur d'école" }],
    },
    {
      email: "directeur.rabat@almanar.ma",
      firstName: "Youssef",
      birthDate: new Date("1976-11-15"),
      lastName: "El Amrani",
      jobTitle: "Directeur",
      orgRole: null,
      memberships: [{ schoolIndex: 1, role: "Directeur d'école" }],
    },
    {
      email: "secretariat.casa@almanar.ma",
      firstName: "Imane",
      birthDate: new Date("1993-06-08"),
      lastName: "Ouazzani",
      jobTitle: "Secrétaire",
      orgRole: null,
      memberships: [{ schoolIndex: 0, role: "Secrétaire" }],
    },
    {
      email: "prof.marrakech@almanar.ma",
      firstName: "Karim",
      birthDate: new Date("1990-02-19"),
      lastName: "Bennis",
      jobTitle: "Enseignant",
      orgRole: null,
      memberships: [{ schoolIndex: 2, role: "Enseignant" }],
    },
  ];

  for (const person of staff) {
    const firstSchool = person.memberships[0]
      ? schools[person.memberships[0].schoolIndex]
      : schools[0];

    const year = await db.schoolYear.findFirst({
      where: { schoolId: firstSchool.id, isDefault: true },
    });

    const user = await db.user.upsert({
      where: { email: person.email },
      update: {
        profile: { update: { ...DEFAULT_PREFS, birthDate: person.birthDate } },
      },
      create: {
        organizationId,
        email: person.email,
        passwordHash,
        orgRoleId: person.orgRole ? roles.get(person.orgRole) : null,
        currentSchoolId: firstSchool.id,
        currentSchoolYearId: year?.id,
        profile: {
          create: {
            firstName: person.firstName,
            lastName: person.lastName,
            jobTitle: person.jobTitle,
            birthDate: person.birthDate,
            locale: "fr",
          },
        },
      },
    });

    for (const membership of person.memberships) {
      const roleId = roles.get(membership.role);
      if (!roleId) continue;
      await db.membership.upsert({
        where: {
          userId_schoolId: {
            userId: user.id,
            schoolId: schools[membership.schoolIndex].id,
          },
        },
        update: { roleId },
        create: {
          userId: user.id,
          schoolId: schools[membership.schoolIndex].id,
          roleId,
        },
      });
    }
  }

  console.log(`  users ✓ (${staff.length + 1})`);
}

async function main() {
  console.log("Seeding…");

  await seedPermissions();

  const organization = await seedOrganization();
  const roles = await seedRoles(organization.id);
  const schools = await seedSchools(organization.id);
  await seedSchoolYears(schools.map((school) => school.id));
  await seedUsers(organization.id, roles, schools);

  console.log(`\nDone. Sign in with:\n  ${ADMIN_EMAIL}\n  ${ADMIN_PASSWORD}\n`);
  console.log(
    "Other accounts share the same password: pedagogie@, directeur.casa@,\n" +
      "directeur.rabat@, secretariat.casa@, prof.marrakech@almanar.ma\n",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
