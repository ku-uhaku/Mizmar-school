import bcrypt from "bcryptjs";

import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Staff accounts: the administrator, the office, and enough teachers per school
 * for every class to have a titulaire and every subject an assignment.
 *
 * Language and appearance are reset on every seed so re-running restores a known
 * demo state; everything else about an existing user is left alone.
 */

const DEFAULT_PREFS = {
  locale: "fr",
  themeMode: "system",
  accent: "blue",
  fontFamily: "geist",
  fontSize: "md",
  radius: "md",
};

/** Teachers, per school code. Enough of them that no one is double-booked. */
const TEACHERS: Record<string, { first: string; last: string; subject: string }[]> = {
  "ALM-CASA": [
    { first: "Karim", last: "Bennis", subject: "Mathématiques" },
    { first: "Sanaa", last: "Lahlou", subject: "Arabe" },
    { first: "Mehdi", last: "Fassi", subject: "Français" },
    { first: "Leila", last: "Berrada", subject: "Anglais" },
    { first: "Omar", last: "Chraibi", subject: "SVT" },
    { first: "Hind", last: "Alaoui", subject: "Physique-Chimie" },
    { first: "Rachid", last: "Naciri", subject: "Histoire-Géographie" },
    { first: "Fatima", last: "Zahiri", subject: "Éducation Islamique" },
    { first: "Younes", last: "Sabri", subject: "EPS" },
    { first: "Meryem", last: "Kettani", subject: "Informatique" },
    { first: "Adil", last: "Regragui", subject: "Philosophie" },
    { first: "Khadija", last: "Amrani", subject: "Tamazight" },
  ],
  "ALM-RABAT": [
    { first: "Samira", last: "Bouzidi", subject: "Primaire" },
    { first: "Hamza", last: "Ouali", subject: "Primaire" },
    { first: "Najat", last: "Skalli", subject: "Primaire" },
    { first: "Tarik", last: "Belkacem", subject: "Primaire" },
    { first: "Amina", last: "Rifai", subject: "Préscolaire" },
    { first: "Zineb", last: "Haddad", subject: "Préscolaire" },
    { first: "Anas", last: "Moujahid", subject: "EPS" },
  ],
};

function emailFor(first: string, last: string): string {
  const slug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  return `${slug(first)}.${slug(last)}@almanar.ma`;
}

export async function seedUsers(
  db: SeedDb,
  {
    organizationId,
    schools,
    roles,
    adminEmail,
    adminPassword,
  }: {
    organizationId: string;
    schools: { id: string; code: string }[];
    roles: Record<string, string>;
    adminEmail: string;
    adminPassword: string;
  },
): Promise<Record<string, { id: string; email: string }[]>> {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const schoolByCode = Object.fromEntries(schools.map((s) => [s.code, s]));
  const casa = schoolByCode["ALM-CASA"];
  const rabat = schoolByCode["ALM-RABAT"];

  const defaultYear = await db.schoolYear.findFirst({
    where: { schoolId: casa.id, isDefault: true },
  });

  // The super administrator. Deliberately keeps `isSuperAdmin` so the org can
  // never be locked out by an unlucky role edit.
  await db.user.upsert({
    where: { email: adminEmail },
    update: {
      profile: { update: { ...DEFAULT_PREFS, birthDate: new Date("1978-04-12") } },
    },
    create: {
      organizationId,
      email: adminEmail,
      passwordHash,
      isSuperAdmin: true,
      orgRoleId: roles["Administrateur"],
      currentSchoolId: casa.id,
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

  const office = [
    {
      email: "pedagogie@almanar.ma",
      firstName: "Hafsa",
      lastName: "Idrissi",
      jobTitle: "Responsable pédagogique",
      birthDate: new Date("1985-09-03"),
      orgRole: "Responsable pédagogique",
      memberships: [] as { schoolId: string; role: string }[],
    },
    {
      email: "directeur.casa@almanar.ma",
      firstName: "Nadia",
      lastName: "Benali",
      jobTitle: "Directrice",
      birthDate: new Date("1981-01-27"),
      orgRole: null,
      memberships: [{ schoolId: casa.id, role: "Directeur d'école" }],
    },
    {
      email: "directeur.rabat@almanar.ma",
      firstName: "Youssef",
      lastName: "El Amrani",
      jobTitle: "Directeur",
      birthDate: new Date("1976-11-15"),
      orgRole: null,
      memberships: [{ schoolId: rabat.id, role: "Directeur d'école" }],
    },
    {
      email: "secretariat.casa@almanar.ma",
      firstName: "Imane",
      lastName: "Ouazzani",
      jobTitle: "Secrétaire",
      birthDate: new Date("1993-06-08"),
      orgRole: null,
      memberships: [{ schoolId: casa.id, role: "Secrétaire" }],
    },
  ];

  const teacherRows: Record<string, { id: string; email: string }[]> = {};

  const upsertPerson = async (person: {
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    birthDate: Date;
    orgRole: string | null;
    memberships: { schoolId: string; role: string }[];
  }) => {
    const firstSchool = person.memberships[0]?.schoolId ?? casa.id;
    const year = await db.schoolYear.findFirst({
      where: { schoolId: firstSchool, isDefault: true },
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
        orgRoleId: person.orgRole ? roles[person.orgRole] : null,
        currentSchoolId: firstSchool,
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
      const roleId = roles[membership.role];
      if (!roleId) continue;
      await db.membership.upsert({
        where: {
          userId_schoolId: { userId: user.id, schoolId: membership.schoolId },
        },
        update: { roleId },
        create: { userId: user.id, schoolId: membership.schoolId, roleId },
      });
    }

    return user;
  };

  for (const person of office) await upsertPerson(person);

  let teacherCount = 0;
  for (const [schoolCode, staff] of Object.entries(TEACHERS)) {
    const school = schoolByCode[schoolCode];
    if (!school) continue;
    teacherRows[school.id] = [];

    for (const [index, teacher] of staff.entries()) {
      const user = await upsertPerson({
        email: emailFor(teacher.first, teacher.last),
        firstName: teacher.first,
        lastName: teacher.last,
        jobTitle: `Enseignant — ${teacher.subject}`,
        // Spread birthdays so the age column has something to show.
        birthDate: new Date(1980 + (index % 15), (index * 3) % 12, 1 + (index % 27)),
        orgRole: null,
        memberships: [{ schoolId: school.id, role: "Enseignant" }],
      });
      teacherRows[school.id].push({ id: user.id, email: user.email });
      teacherCount += 1;
    }
  }

  log("users", `${office.length + 1} staff, ${teacherCount} teachers`);
  return teacherRows;
}
