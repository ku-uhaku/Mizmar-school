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

/**
 * Names to draw a teaching staff from.
 *
 * A pool rather than a roster, because how many teachers a school needs is not
 * a fact anybody should be typing here — it follows from the programme it
 * declares and the service its teachers work, and it changes the moment a level
 * is added. `seedUsers` is told how many of each subject to mint and takes the
 * names from here in order, so the same plan always produces the same staff.
 *
 * 18 × 18 is 324 distinct combinations, comfortably more than any seeded school
 * needs; `nameFor` refuses rather than silently repeating if that is ever wrong.
 */
const FIRST_NAMES = [
  "Karim", "Sanaa", "Mehdi", "Leila", "Omar", "Hind",
  "Rachid", "Fatima", "Younes", "Meryem", "Adil", "Khadija",
  "Samira", "Hamza", "Najat", "Tarik", "Amina", "Zineb",
];

const LAST_NAMES = [
  "Bennis", "Lahlou", "Fassi", "Berrada", "Chraibi", "Alaoui",
  "Naciri", "Zahiri", "Sabri", "Kettani", "Regragui", "Amrani",
  "Bouzidi", "Ouali", "Skalli", "Belkacem", "Rifai", "Haddad",
];

/**
 * How many teachers of one subject a school needs.
 *
 * Worked out by the caller from the programme — see `teacherPlanFor` in
 * prisma/seed.ts. The subject code travels with it so the qualification can be
 * recorded, which is what lets the timetable generator staff a class it was
 * never explicitly assigned to.
 */
export type TeacherRequirement = {
  subjectCode: string;
  /** For the job title, which is prose and not a key. */
  subjectLabel: string;
  count: number;
};

/** A teacher account, and what they are qualified to take. */
export type SeededTeacher = {
  id: string;
  email: string;
  subjectCodes: string[];
};

/** The nth distinct name in the pool. */
function nameFor(index: number): { first: string; last: string } {
  const total = FIRST_NAMES.length * LAST_NAMES.length;
  if (index >= total) {
    throw new Error(
      `The seed needs ${index + 1} teachers and the name pool holds ${total}. ` +
        "Add names to FIRST_NAMES or LAST_NAMES in modules/users/seed.ts.",
    );
  }
  return {
    first: FIRST_NAMES[index % FIRST_NAMES.length],
    last: LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length],
  };
}

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
    teacherPlan,
    withOffice = true,
  }: {
    organizationId: string;
    schools: { id: string; code: string }[];
    /** How many teachers of each subject each school needs, keyed by school code. */
    teacherPlan: Record<string, TeacherRequirement[]>;
    roles: Record<string, string>;
    adminEmail: string;
    adminPassword: string;
    /**
     * The demo office — a directeur, a responsable pédagogique, two
     * gestionnaires. False for the configuration-only seed, which opens a school
     * for a real team to be entered into rather than a populated one to look at.
     * The super administrator is written either way: a school nobody can sign
     * into is not a school.
     */
    withOffice?: boolean;
  },
): Promise<Record<string, SeededTeacher[]>> {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const schoolByCode = Object.fromEntries(schools.map((s) => [s.code, s]));
  const oujda = schoolByCode["ALM-OUJDA"];

  const defaultYear = await db.schoolYear.findFirst({
    where: { schoolId: oujda.id, isDefault: true },
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
      currentSchoolId: oujda.id,
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
      email: "directeur.oujda@almanar.ma",
      firstName: "Abdellah",
      lastName: "Berrada",
      jobTitle: "Directeur",
      birthDate: new Date("1979-05-22"),
      orgRole: null,
      memberships: [{ schoolId: oujda.id, role: "Directeur d'école" }],
    },
    // Two gestionnaires rather than one, since even a small school runs its
    // front desk in shifts.
    {
      email: "gestion1.oujda@almanar.ma",
      firstName: "Salma",
      lastName: "Ziani",
      jobTitle: "Gestionnaire",
      birthDate: new Date("1990-02-14"),
      orgRole: null,
      memberships: [{ schoolId: oujda.id, role: "Secrétaire" }],
    },
    {
      email: "gestion2.oujda@almanar.ma",
      firstName: "Yassine",
      lastName: "Rifai",
      jobTitle: "Gestionnaire",
      birthDate: new Date("1988-11-30"),
      orgRole: null,
      memberships: [{ schoolId: oujda.id, role: "Secrétaire" }],
    },
  ];

  const teacherRows: Record<string, SeededTeacher[]> = {};

  const upsertPerson = async (person: {
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    birthDate: Date;
    orgRole: string | null;
    memberships: { schoolId: string; role: string }[];
  }) => {
    const firstSchool = person.memberships[0]?.schoolId ?? oujda.id;
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

  if (withOffice) for (const person of office) await upsertPerson(person);

  /*
    The teaching staff, minted from what the school's programme actually asks
    for rather than from a list somebody maintains by hand.

    Each requirement says "this school needs four teachers of Arabic", and the
    subject travels onto the account so `seedTeacherSubjects` can record the
    qualification. Before this the seed handed out subjects round-robin — the
    maths teacher was assigned Arabic — which made every qualification in the
    database meaningless and left the timetable generator nothing real to work
    from.

    Names come from the pool in order across the whole organisation, so two
    schools never mint the same person and a re-seed reproduces the same staff.
  */
  let teacherCount = 0;
  let nameCursor = 0;

  for (const [schoolCode, requirements] of Object.entries(teacherPlan)) {
    const school = schoolByCode[schoolCode];
    if (!school) continue;
    teacherRows[school.id] = [];

    for (const requirement of requirements) {
      for (let n = 0; n < requirement.count; n += 1) {
        const { first, last } = nameFor(nameCursor);
        nameCursor += 1;

        const user = await upsertPerson({
          email: emailFor(first, last),
          firstName: first,
          lastName: last,
          jobTitle: `Enseignant — ${requirement.subjectLabel}`,
          // Spread birthdays so the age column has something to show.
          birthDate: new Date(
            1980 + (nameCursor % 15),
            (nameCursor * 3) % 12,
            1 + (nameCursor % 27),
          ),
          orgRole: null,
          memberships: [{ schoolId: school.id, role: "Enseignant" }],
        });

        teacherRows[school.id].push({
          id: user.id,
          email: user.email,
          subjectCodes: [requirement.subjectCode],
        });
        teacherCount += 1;
      }
    }
  }

  log(
    "users",
    `${(withOffice ? office.length : 0) + 1} staff, ${teacherCount} teachers`,
  );
  return teacherRows;
}
