import { log, type SeedDb } from "@/prisma/seed/client";

import { DEFAULT_SETTINGS, formatEntityCode } from "@/lib/school-settings";
import { activeContractKey } from "@/modules/hr/enums";

/**
 * The payroll: who works here, and on what terms.
 *
 * **No payslips, no register and no leave are seeded, on purpose.** All three
 * are facts about a particular day or month: a seeded bulletin would be a
 * document nobody issued, and paying one writes a décaissement in the caisse (see
 * `payStaffSalary`) — so re-running the seed would move money that never moved.
 * Marking a register would be worse still, since it would record somebody's
 * attendance on a day the seed happened to run. All three are done through the
 * screens, which is also the shortest way to see the payroll work.
 *
 * Idempotent — staff upsert on `(schoolId, code)`, contracts on the employee's
 * live-contract key, which is the same guard the service uses.
 */

export type StaffSeed = {
  code: string;
  first: string;
  last: string;
  firstAr: string;
  lastAr: string;
  jobRole: string;
  jobTitle: string;
  phone: string;
  /** Monthly base in dirhams; converted to centimes on the way in. */
  salary: number;
  kind: "CDI" | "CDD" | "ANAPEC" | "INTERIM" | "VACATAIRE" | "STAGE";
  hiredYear: number;
};

/**
 * The people a school has who are not teachers — the ones with no account and
 * therefore no row anywhere else in this database, which is the whole reason
 * this module exists.
 *
 * The three drivers are the same ones the transport seed names on its vehicles,
 * so seeding both leaves each bus pointing at a real employee rather than at a
 * string. See `seedTransport`.
 */
export const STAFF_SEEDS: StaffSeed[] = [
  {
    code: "P-2025-0001",
    first: "Hassan",
    last: "Alaoui",
    firstAr: "حسن",
    lastAr: "العلوي",
    jobRole: "DRIVER",
    jobTitle: "Chauffeur de bus",
    phone: "0661234501",
    salary: 4200,
    kind: "CDI",
    hiredYear: 2019,
  },
  {
    code: "P-2025-0002",
    first: "Brahim",
    last: "Naji",
    firstAr: "براهيم",
    lastAr: "الناجي",
    jobRole: "DRIVER",
    jobTitle: "Chauffeur de bus",
    phone: "0661234502",
    salary: 4200,
    kind: "CDI",
    hiredYear: 2021,
  },
  {
    code: "P-2025-0003",
    first: "Said",
    last: "Amrani",
    firstAr: "سعيد",
    lastAr: "العمراني",
    jobRole: "DRIVER",
    jobTitle: "Chauffeur de bus",
    phone: "0661234503",
    salary: 4000,
    kind: "CDD",
    hiredYear: 2023,
  },
  {
    code: "P-2025-0004",
    first: "Khadija",
    last: "Bouzid",
    firstAr: "خديجة",
    lastAr: "بوزيد",
    jobRole: "NURSE",
    jobTitle: "Infirmière",
    phone: "0661234504",
    salary: 5500,
    kind: "CDI",
    hiredYear: 2020,
  },
  {
    code: "P-2025-0005",
    first: "Mustapha",
    last: "Idrissi",
    firstAr: "مصطفى",
    lastAr: "الإدريسي",
    jobRole: "SECURITY",
    jobTitle: "Gardien",
    phone: "0661234505",
    salary: 3200,
    kind: "CDI",
    hiredYear: 2018,
  },
  {
    code: "P-2025-0006",
    first: "Rachida",
    last: "Filali",
    firstAr: "رشيدة",
    lastAr: "الفيلالي",
    jobRole: "MAINTENANCE",
    jobTitle: "Agent d'entretien",
    phone: "0661234506",
    salary: 3000,
    kind: "CDI",
    hiredYear: 2022,
  },
  {
    code: "P-2025-0007",
    first: "Younes",
    last: "Chraibi",
    firstAr: "يونس",
    lastAr: "الشرايبي",
    jobRole: "SUPERVISOR",
    jobTitle: "Surveillant général",
    phone: "0661234507",
    salary: 6800,
    kind: "CDI",
    hiredYear: 2017,
  },
];

/** Monthly base by job, for the teaching staff generated from their accounts. */
const TEACHER_SALARY = 7500;

export type SeedStaffInput = {
  schoolId: string;
  /** The teaching accounts, so their employment record links to their login. */
  teachers: { id: string; email: string }[];
};

/**
 * Upserts a staff row and, with it, one live contract.
 *
 * The contract is written the way `saveContract` writes one — through
 * `activeContractKey`, never a literal — so the seed is bound by the same
 * "one live contract per employee" invariant the app is.
 */
async function upsertStaff(
  db: SeedDb,
  input: {
    schoolId: string;
    code: string;
    firstName: string;
    lastName: string;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
    jobRole: string;
    jobTitle: string;
    phone?: string | null;
    email?: string | null;
    userId?: string | null;
    hiredOn: Date;
    salaryCentimes: number;
    kind: string;
  },
): Promise<{ id: string }> {
  const person = await db.staff.upsert({
    where: { schoolId_code: { schoolId: input.schoolId, code: input.code } },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      firstNameAr: input.firstNameAr ?? null,
      lastNameAr: input.lastNameAr ?? null,
      jobRole: input.jobRole,
      jobTitle: input.jobTitle,
      phone: input.phone ?? null,
      email: input.email ?? null,
      userId: input.userId ?? null,
      hiredOn: input.hiredOn,
    },
    create: {
      schoolId: input.schoolId,
      code: input.code,
      firstName: input.firstName,
      lastName: input.lastName,
      firstNameAr: input.firstNameAr ?? null,
      lastNameAr: input.lastNameAr ?? null,
      jobRole: input.jobRole,
      jobTitle: input.jobTitle,
      phone: input.phone ?? null,
      email: input.email ?? null,
      userId: input.userId ?? null,
      status: "ACTIVE",
      hiredOn: input.hiredOn,
    },
    select: { id: true },
  });

  // Upserting on the live-contract key is what makes re-running this correct
  // *and* idempotent: the same employee cannot end up with two live contracts,
  // which is exactly what the unique index says.
  const key = activeContractKey(person.id, "ACTIVE");
  await db.employmentContract.upsert({
    where: { activeKey: key ?? undefined },
    update: {
      kind: input.kind,
      baseSalaryCentimes: input.salaryCentimes,
      startsOn: input.hiredOn,
    },
    create: {
      staffId: person.id,
      kind: input.kind,
      startsOn: input.hiredOn,
      // CDIs run on; the fixed-term ones end with the school year.
      endsOn: input.kind === "CDD" ? new Date("2026-06-30") : null,
      baseSalaryCentimes: input.salaryCentimes,
      weeklyHours: input.jobRole === "TEACHER" ? 24 : 44,
      status: "ACTIVE",
      activeKey: key,
    },
  });

  return person;
}

/**
 * Returns the drivers by full name, so `seedTransport` can put a real employee
 * on each bus instead of a string. Keyed by name rather than by index because
 * the two lists are maintained separately and an index would silently reassign
 * every bus the day somebody inserts a driver.
 */
export async function seedHr(
  db: SeedDb,
  input: SeedStaffInput,
): Promise<Record<string, string>> {
  const driverIdByName: Record<string, string> = {};

  for (const person of STAFF_SEEDS) {
    const row = await upsertStaff(db, {
      schoolId: input.schoolId,
      code: person.code,
      firstName: person.first,
      lastName: person.last,
      firstNameAr: person.firstAr,
      lastNameAr: person.lastAr,
      jobRole: person.jobRole,
      jobTitle: person.jobTitle,
      phone: person.phone,
      hiredOn: new Date(person.hiredYear, 8, 1),
      // Centimes, exactly as an action would write them.
      salaryCentimes: Math.round(person.salary * 100),
      kind: person.kind,
    });

    if (person.jobRole === "DRIVER") {
      driverIdByName[`${person.first} ${person.last}`] = row.id;
    }
  }

  // The teachers already exist as accounts. Giving each an employment record
  // linked to their login is the case the `userId` column is for — and it is
  // what makes the payroll cover the whole school rather than only the people
  // who never sign in.
  for (const [index, teacher] of input.teachers.entries()) {
    const profile = await db.user.findUnique({
      where: { id: teacher.id },
      select: {
        profile: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    if (!profile?.profile) continue;

    await upsertStaff(db, {
      schoolId: input.schoolId,
      code: formatEntityCode(
        DEFAULT_SETTINGS.staffCodeFormat,
        2025,
        STAFF_SEEDS.length + index + 1,
      ),
      firstName: profile.profile.firstName,
      lastName: profile.profile.lastName,
      jobRole: "TEACHER",
      jobTitle: "Enseignant",
      phone: profile.profile.phone,
      email: teacher.email,
      userId: teacher.id,
      hiredOn: new Date(2021 + (index % 4), 8, 1),
      salaryCentimes: TEACHER_SALARY * 100,
      kind: "CDI",
    });
  }

  log(
    "hr",
    `${STAFF_SEEDS.length + input.teachers.length} staff, as many contracts`,
  );

  return driverIdByName;
}

/**
 * Records what each teacher is qualified to take, for one school year.
 *
 * Read from the specialty the account was minted with, not inferred from the
 * assignments it happens to hold. The two used to be the same thing and both
 * were wrong: the class seed handed subjects out round-robin, so inferring
 * qualifications from it said every teacher could teach everything, and a
 * timetable generator trusting that would staff Arabic with the sports teacher.
 *
 * ── Why it is written per year ──────────────────────────────────────────────
 * Because that is what the table now holds — see TeacherSubject. A demo school
 * with three years has three staffing plans, and a grid generated for 2024-2025
 * has to read the people who were there in 2024-2025.
 *
 * ── The level scope this writes, and the one it does not ────────────────────
 * The cycle, derived from where each subject is actually taught: a subject on
 * the programme of exactly one cycle gives its teachers a qualification scoped
 * to that cycle, and one taught across several — français, arabe, maths in a
 * groupe scolaire — leaves them school-wide. That is the shape a school really
 * enters, because a teacher is recruited for the primaire or for the collège
 * and not for a list of niveaux.
 *
 * Narrowing further, to named niveaux, is deliberately left to the screen. The
 * seed has nothing true to say about which two niveaux of the collège a given
 * maths teacher takes, and inventing it would put a fact in the database that
 * nobody at the school decided.
 *
 * Idempotent on (schoolYearId, teacherId, subjectId).
 */
export async function seedTeacherSubjects(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    teachers,
    subjectIdByCode,
  }: {
    schoolId: string;
    schoolYearId: string;
    teachers: { id: string; subjectCodes: string[] }[];
    subjectIdByCode: Record<string, string>;
  },
): Promise<number> {
  // Which cycles each subject is on the programme of. Read back from what
  // `configureSchool` wrote rather than from the constants it wrote it from,
  // so a school that has since edited its cursus is described as it now is.
  const programme = await db.levelSubject.findMany({
    where: { level: { schoolId } },
    select: { subjectId: true, level: { select: { educationLevelId: true } } },
  });

  const cyclesBySubject = new Map<string, Set<string>>();
  for (const row of programme) {
    const held = cyclesBySubject.get(row.subjectId) ?? new Set<string>();
    held.add(row.level.educationLevelId);
    cyclesBySubject.set(row.subjectId, held);
  }

  let written = 0;

  for (const teacher of teachers) {
    for (const [index, code] of teacher.subjectCodes.entries()) {
      const subjectId = subjectIdByCode[code];
      if (!subjectId) continue;

      const cycles = cyclesBySubject.get(subjectId);
      const educationLevelId =
        cycles && cycles.size === 1 ? [...cycles][0] : null;

      /*
        Main subject first, then whatever they cover.

        `subjectCodes` is ordered by what the account was recruited for, so the
        index *is* the preference: 0 for the specialist, 2 for somebody covering.
        Two rather than one, so the gap is visible in the screen and a school
        editing it has a rank between them to put a third case in.

        This is what stops the generator handing physique to the maths teacher
        while a professeur de physique sits idle — it exhausts rank 0 first.
      */
      const preferenceRank = index === 0 ? 0 : 2;

      await db.teacherSubject.upsert({
        where: {
          schoolYearId_teacherId_subjectId: {
            schoolYearId,
            teacherId: teacher.id,
            subjectId,
          },
        },
        // Re-stated rather than left alone: the cycle follows the cursus, and a
        // school that has opened a new cycle since the last run should see the
        // scope narrow or widen with it instead of keeping a stale answer.
        update: { educationLevelId, preferenceRank },
        create: {
          schoolId,
          schoolYearId,
          teacherId: teacher.id,
          subjectId,
          educationLevelId,
          preferenceRank,
        },
      });
      written += 1;
    }
  }

  log("hr", `${written} teaching qualifications`);
  return written;
}

/**
 * How much of the staff is on a reduced service, and how reduced.
 *
 * Exported because sizing the staff has to know: `teacherPlanFor` mints
 * teachers against an *effective* service, not the nominal one. When these two
 * disagreed the seed produced schools that were understaffed by exactly the
 * hours it had just taken away — a subject sized for two full-timers, one of
 * whom then turned out to be a vacataire.
 */
export const PART_TIME_SHARE = 1 / 5;
export const PART_TIME_FACTOR = 0.6;

/**
 * Part-time contracts, so the demo carries the case the generator has to cope
 * with: not everybody works a full service.
 *
 * Every fifth teacher, by a stable rule rather than at random, so a re-seed
 * produces the same staff and the same timetable.
 */
export async function seedPartTimeContracts(
  db: SeedDb,
  {
    schoolId,
    teachers,
    fullServiceMinutes,
  }: {
    schoolId: string;
    teachers: { id: string }[];
    fullServiceMinutes: number;
  },
): Promise<number> {
  const every = Math.round(1 / PART_TIME_SHARE);
  const partTime = teachers.filter((_, index) => index % every === every - 1);
  if (partTime.length === 0) return 0;

  const result = await db.staff.updateMany({
    where: { schoolId, userId: { in: partTime.map((teacher) => teacher.id) } },
    data: { maxWeeklyMinutes: Math.round(fullServiceMinutes * PART_TIME_FACTOR) },
  });

  log("hr", `${result.count} part-time services`);
  return result.count;
}
