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
  /**
   * Subjects a teacher of this one may also be given, best first.
   *
   * Not everybody teaches one subject and nothing else — a professeur de
   * physique covers maths, an enseignant d'arabe takes l'éducation islamique.
   * The doublings a Moroccan school actually makes are decided by the caller,
   * which is where the cursus is known; see `SECOND_SUBJECTS` in
   * prisma/seed.ts.
   *
   * Only some of the teachers of a requirement get one — see the minting loop.
   */
  coversAlso: string[];
};

/** A teacher account, and what they are qualified to take. */
export type SeededTeacher = {
  id: string;
  email: string;
  /**
   * Their subjects, main one first.
   *
   * The order is the preference: index 0 is what they were recruited for, and
   * anything after it is a subject they can cover. `seedTeacherSubjects` turns
   * that into `preferenceRank`, so the generator exhausts the specialists
   * before reaching for somebody merely covering.
   */
  subjectCodes: string[];
};

/**
 * The super administrator, and nothing else.
 *
 * Split out of `seedUsers` because it is the one account every seed needs — the
 * demonstration, the configured-but-empty school, and the empty database a real
 * deployment starts from. Only the last of those has no school to point the
 * account at, which is why `schoolId` is optional: a working context that
 * resolves to nothing is exactly right when there is nothing to resolve to yet,
 * and `getAuthContext` already falls back to null rather than guessing.
 *
 * Deliberately keeps `isSuperAdmin` so the organisation can never be locked out
 * by an unlucky role edit.
 */
/**
 * The fonctions a Moroccan school actually staffs, as its starting list.
 *
 * Seeded rather than left empty because the user form's picker is useless until
 * something is in it, and these are the same handful every établissement writes
 * on a contract. A school renames, reorders or deactivates them afterwards —
 * that is what the Configuration screen is for.
 *
 * `position` is the organigramme's order, which is not alphabetical: a
 * direction comes before an agent d'entretien.
 */
const STAFF_FUNCTIONS = [
  { code: "DG", name: "Directeur général", nameAr: "المدير العام", position: 10 },
  { code: "DIR", name: "Directeur", nameAr: "المدير", position: 20 },
  {
    code: "RESP-PEDA",
    name: "Responsable pédagogique",
    nameAr: "المسؤول البيداغوجي",
    position: 30,
  },
  { code: "ENS", name: "Enseignant", nameAr: "أستاذ", position: 40 },
  {
    code: "SURV",
    name: "Surveillant général",
    nameAr: "الحارس العام",
    position: 50,
  },
  { code: "GEST", name: "Gestionnaire", nameAr: "مدبر", position: 60 },
  { code: "SECR", name: "Secrétaire", nameAr: "كاتب", position: 70 },
  { code: "COMPTA", name: "Comptable", nameAr: "محاسب", position: 80 },
  { code: "CHAUF", name: "Chauffeur", nameAr: "سائق", position: 90 },
  {
    code: "ENTRETIEN",
    name: "Agent d'entretien",
    nameAr: "عون النظافة",
    position: 100,
  },
] as const;

/**
 * Upserts the fonctions of one school and answers name → id.
 *
 * Keyed on `(schoolId, code)`, so re-running corrects a wording rather than
 * raising a second row — and a fonction a school has renamed keeps its id and
 * everybody who holds it.
 */
export async function seedStaffFunctions(
  db: SeedDb,
  schoolId: string,
): Promise<Record<string, string>> {
  const byName: Record<string, string> = {};

  for (const fonction of STAFF_FUNCTIONS) {
    const row = await db.staffFunction.upsert({
      where: { schoolId_code: { schoolId, code: fonction.code } },
      update: { name: fonction.name, nameAr: fonction.nameAr, position: fonction.position },
      create: { schoolId, ...fonction },
      select: { id: true, name: true },
    });
    byName[row.name] = row.id;
  }

  return byName;
}

export async function seedAdmin(
  db: SeedDb,
  {
    organizationId,
    roles,
    adminEmail,
    adminPassword,
    schoolId,
  }: {
    organizationId: string;
    roles: Record<string, string>;
    adminEmail: string;
    adminPassword: string;
    /** Omitted when the database has no school yet. */
    schoolId?: string;
  },
): Promise<void> {
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // The picker's list has to exist before anybody can hold one of its rows.
  const functions = schoolId ? await seedStaffFunctions(db, schoolId) : {};

  const defaultYear = schoolId
    ? await db.schoolYear.findFirst({ where: { schoolId, isDefault: true } })
    : null;

  await db.user.upsert({
    where: { email: adminEmail },
    update: {
      profile: { update: { ...DEFAULT_PREFS, birthDate: new Date("1978-04-12") } },
    },
    create: {
      organizationId,
      email: adminEmail,
      username: usernameFromEmail(adminEmail),
      passwordHash,
      isSuperAdmin: true,
      orgRoleId: roles["Administrateur"],
      currentSchoolId: schoolId ?? null,
      currentSchoolYearId: defaultYear?.id ?? null,
      profile: {
        create: {
          firstName: "Amine",
          lastName: "Tazi",
          jobFunctionId: functions["Directeur général"] ?? null,
          phone: "+212 661 23 45 67",
          birthDate: new Date("1978-04-12"),
          locale: "fr",
        },
      },
    },
  });

  log("administrator", adminEmail);
}

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

/**
 * The username a seeded account signs in with: the local part of its email.
 *
 * `karim.bennis@almanar.ma` becomes `karim.bennis`, which is exactly what the
 * migration that added the column derived for accounts that predate it — so a
 * seeded school and a migrated one agree about what everybody types, and the
 * demo credentials printed at the end of the seed stay true.
 *
 * Set on create only. A re-seed must not reset a username an administrator has
 * since changed, which is why it is absent from every `update` below.
 */
function usernameFromEmail(email: string): string {
  return email.split("@")[0]!.toLowerCase();
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

  await seedAdmin(db, {
    organizationId,
    roles,
    adminEmail,
    adminPassword,
    schoolId: oujda.id,
  });

  const office = [
    {
      email: "pedagogie@almanar.ma",
      firstName: "Hafsa",
      lastName: "Idrissi",
      jobFunction: "Responsable pédagogique",
      birthDate: new Date("1985-09-03"),
      orgRole: "Responsable pédagogique",
      memberships: [] as { schoolId: string; role: string }[],
    },
    {
      email: "directeur.oujda@almanar.ma",
      firstName: "Abdellah",
      lastName: "Berrada",
      jobFunction: "Directeur",
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
      jobFunction: "Gestionnaire",
      birthDate: new Date("1990-02-14"),
      orgRole: null,
      memberships: [{ schoolId: oujda.id, role: "Secrétaire" }],
    },
    {
      email: "gestion2.oujda@almanar.ma",
      firstName: "Yassine",
      lastName: "Rifai",
      jobFunction: "Gestionnaire",
      birthDate: new Date("1988-11-30"),
      orgRole: null,
      memberships: [{ schoolId: oujda.id, role: "Secrétaire" }],
    },
  ];

  const teacherRows: Record<string, SeededTeacher[]> = {};

  /*
    The fonctions, per school, resolved once.

    Cached rather than upserted per person: a school of forty teachers would
    otherwise re-upsert the same ten rows forty times, and the seed is meant to
    be re-runnable without being slow about it.
  */
  const functionsBySchool = new Map<string, Record<string, string>>();
  const functionsFor = async (schoolId: string) => {
    const held = functionsBySchool.get(schoolId);
    if (held) return held;

    const fresh = await seedStaffFunctions(db, schoolId);
    functionsBySchool.set(schoolId, fresh);
    return fresh;
  };

  const upsertPerson = async (person: {
    email: string;
    firstName: string;
    lastName: string;
    /** Matched to a seeded StaffFunction by name — see `seedStaffFunctions`. */
    jobFunction: string;
    birthDate: Date;
    orgRole: string | null;
    memberships: { schoolId: string; role: string }[];
  }) => {
    const firstSchool = person.memberships[0]?.schoolId ?? oujda.id;
    const year = await db.schoolYear.findFirst({
      where: { schoolId: firstSchool, isDefault: true },
    });
    const functions = await functionsFor(firstSchool);

    const user = await db.user.upsert({
      where: { email: person.email },
      update: {
        profile: { update: { ...DEFAULT_PREFS, birthDate: person.birthDate } },
      },
      create: {
        organizationId,
        email: person.email,
        username: usernameFromEmail(person.email),
        passwordHash,
        orgRoleId: person.orgRole ? roles[person.orgRole] : null,
        currentSchoolId: firstSchool,
        currentSchoolYearId: year?.id,
        profile: {
          create: {
            firstName: person.firstName,
            lastName: person.lastName,
            jobFunctionId: functions[person.jobFunction] ?? null,
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
          // One "Enseignant" fonction, not one per subject: what they teach
          // is already recorded by TeacherSubject, and a list with a row per
          // matière is a list nobody can use.
          jobFunction: "Enseignant",
          // Spread birthdays so the age column has something to show.
          birthDate: new Date(
            1980 + (nameCursor % 15),
            (nameCursor * 3) % 12,
            1 + (nameCursor % 27),
          ),
          orgRole: null,
          memberships: [{ schoolId: school.id, role: "Enseignant" }],
        });

        /*
          Every third teacher of a subject also covers a second one.

          By position rather than at random, so a re-seed mints the same staff
          and the same timetable. `n % 3 === 1` and not `=== 0` on purpose: it
          leaves the first teacher of each subject a pure specialist, and skips
          the subjects with a single teacher — philosophie, informatique — where
          the one person the school has is exactly that. Those subjects gain
          their second qualified teacher from the other direction instead, by
          being somebody else's `coversAlso`.
        */
        const secondary =
          n % 3 === 1 && requirement.coversAlso.length > 0
            ? [requirement.coversAlso[
                Math.floor(n / 3) % requirement.coversAlso.length
              ]]
            : [];

        teacherRows[school.id].push({
          id: user.id,
          email: user.email,
          subjectCodes: [requirement.subjectCode, ...secondary],
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
