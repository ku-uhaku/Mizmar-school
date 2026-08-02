import { MOROCCAN_CURSUS, seedAcademics } from "@/modules/academics/seed";
import { seedPermissions, seedRoles } from "@/modules/access/seed";
import {
  FEE_RATES,
  FEE_TYPES,
  seedFeeRatesAndDiscounts,
  seedFeeTypes,
} from "@/modules/billing/seed";
import { seedClasses, type OfferingPlan } from "@/modules/classes/seed";
import { seedEnrolments } from "@/modules/enrolment/seed";
import {
  PART_TIME_FACTOR,
  PART_TIME_SHARE,
  seedHr,
  seedPartTimeContracts,
  seedTeacherSubjects,
} from "@/modules/hr/seed";
import { DEFAULT_SETTINGS } from "@/lib/school-settings";
import { seedTreasury } from "@/modules/treasury/seed";
import { seedTransport } from "@/modules/transport/seed";
import { seedAssessmentTypes } from "@/modules/assessments/seed";
import { seedSupplyArticles } from "@/modules/supplies/seed";
import { seedDocumentTypes } from "@/modules/documents/seed";
import { seedFamilies } from "@/modules/families/seed";
import { SCHOOL_ROOMS, seedRooms } from "@/modules/facilities/seed";
import { seedCities, seedNeighbourhoods } from "@/modules/geography/seed";
import { seedOrganization } from "@/modules/organization/seed";
import { seedSchoolYears } from "@/modules/school-years/seed";
import { seedSchools } from "@/modules/schools/seed";
import { seedStudents } from "@/modules/students/seed";
import {
  seedHolidays,
  seedSchoolWeeks,
  seedTeacherAvailability,
  seedTimeSlots,
  seedTimetable,
} from "@/modules/timetable/seed";
import { seedUsers, type TeacherRequirement } from "@/modules/users/seed";
import { db } from "@/prisma/seed/client";
import { buildRoster, type Cohort } from "@/prisma/seed/roster";

/**
 * Idempotent seed: safe to re-run.
 *
 * Each module seeds its own tables — this file only decides the order and hands
 * ids along, so a new module means a new `modules/<x>/seed.ts` and one call
 * here rather than another few hundred lines in a single script.
 *
 * What it builds, per school and to an exact shape:
 *
 *   2 schools  ×  1 school year  ×  3 cycles  ×  12 levels
 *              ×  2 classes a level  ×  21 pupils a class
 *
 * — so 24 classes and 504 pupils each, 1 008 in all. Plus everything those need
 * to mean anything: subjects with their components, the programme that weights
 * them, rooms, semesters, the bell schedule (standard and Ramadan), teaching
 * assignments, a worked timetable, dossiers familiaux with siblings across
 * levels, fee catalogues, price lists, discounts and every pupil's échéancier.
 *
 * The staff is not a fixed roster: `teacherPlan` reads the declared programme
 * and sizes it, so changing the plan below changes the hiring rather than
 * leaving the school short of its own curriculum.
 *
 * Note: it upserts and never deletes, so schools you created yourself — or ones
 * seeded by an earlier version of this file — are left in place. Use
 * `npm run db:reset` for a clean slate.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@groupescolaire.ma";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

/** The twelve levels of the Moroccan cursus, in the order a school runs them. */
const LEVEL_CODES = [
  "1AP", "2AP", "3AP", "4AP", "5AP", "6AP",
  "1AC", "2AC", "3AC",
  "TC", "1BAC", "2BAC",
] as const;

/**
 * The stream each lycée level opens.
 *
 * A tracked level needs one, because a class hangs off a `LevelOffering` and an
 * offering is per track. One apiece rather than all of them: the ask is two
 * classes per *level*, and opening every filière would give 2BAC eight. The
 * others stay configured and unopened, which is the ordinary state of a filière
 * a school offers on paper.
 */
const TRACK_FOR: Record<string, string | null> = {
  TC: "TC-S",
  "1BAC": "1B-SE",
  "2BAC": "2B-SVT",
};

/** Two parallel classes at every level, sized for the intake plus a few places. */
const CLASSES_PER_LEVEL = 2;
const PUPILS_PER_CLASS = 21;
const CLASS_CAPACITY = 26;

const PLANS_PER_SCHOOL: OfferingPlan[] = LEVEL_CODES.map((levelCode) => ({
  levelCode,
  trackCode: TRACK_FOR[levelCode] ?? null,
  classCount: CLASSES_PER_LEVEL,
  capacity: CLASS_CAPACITY,
}));

/**
 * Which age fills which level, by the Moroccan calendar: six years old starts
 * 1AP and each year after moves up one.
 *
 * The mirror of `placementFor` in the enrolment seed, which is what actually
 * seats a child — it works from the age on the file, so the roster has to
 * declare the age that lands a pupil where this plan intends. Getting the two
 * out of step does not error; it silently leaves a level empty.
 */
const AGE_AT_LEVEL: Record<string, number> = {
  "1AP": 6, "2AP": 7, "3AP": 8, "4AP": 9, "5AP": 10, "6AP": 11,
  "1AC": 12, "2AC": 13, "3AC": 14,
  TC: 15, "1BAC": 16, "2BAC": 17,
};

/** 42 pupils at each of the twelve levels — two classes of twenty-one. */
const COHORTS: Cohort[] = LEVEL_CODES.map((levelCode) => ({
  levelCode,
  age: AGE_AT_LEVEL[levelCode],
  count: CLASSES_PER_LEVEL * PUPILS_PER_CLASS,
}));

type SchoolPlan = {
  code: string;
  /** Town the pupils are born in and the dossiers are addressed in. */
  cityCode: string;
  cityName: string;
  /** Offsets the name pools so the two schools get different rosters. */
  variant: number;
};

const PLANS: SchoolPlan[] = [
  { code: "ALM-CASA", cityCode: "CASA", cityName: "Casablanca", variant: 0 },
  { code: "ALM-RABAT", cityCode: "RABAT", cityName: "Rabat", variant: 1 },
];

/**
 * Level code → subject code → weekly minutes, from the cursus.
 *
 * `PROGRAMME_BY_LEVEL` already says *which* subjects a level teaches; this says
 * how much of each, which is what levels a teacher's load when the classes are
 * staffed. Both read the same rows, so they cannot disagree about what is taught.
 */
function subjectMinutesByLevel(): Record<string, Record<string, number>> {
  const byLevel: Record<string, Record<string, number>> = {};

  for (const row of MOROCCAN_CURSUS.programme) {
    if (!row.weeklyMinutes) continue;
    byLevel[row.levelCode] ??= {};
    // A level-wide row and a track row for the same subject: the larger wins, so
    // a stream with extra hours is not understated.
    byLevel[row.levelCode][row.subjectCode] = Math.max(
      byLevel[row.levelCode][row.subjectCode] ?? 0,
      row.weeklyMinutes,
    );
  }

  return byLevel;
}

/** The subject codes that are components, marked inside their parent. */
const COMPONENT_CODES = new Set(
  MOROCCAN_CURSUS.subjects
    .filter((subject) => subject.parent)
    .map((subject) => subject.code),
);

/**
 * What one school's declared programme costs in teaching minutes a week, per
 * subject.
 *
 * Every class of every level the school opens, times what the programme gives
 * that subject at that level. This is the figure the teaching staff has to be
 * able to cover, and working it out here — rather than writing down a roster
 * and hoping — is what stops the seed producing a school that is twenty
 * teachers short of its own curriculum.
 *
 * Components are left out: they are marked inside their parent and never taught
 * in their own hour, exactly as `PROGRAMME_BY_LEVEL` filters them.
 */
function subjectDemand(): Map<string, number> {
  const demand = new Map<string, number>();

  for (const offering of PLANS_PER_SCHOOL) {
    for (const row of MOROCCAN_CURSUS.programme) {
      if (row.levelCode !== offering.levelCode) continue;
      // A row for every track applies here; a row naming one applies only to it.
      if (row.trackCode !== null && row.trackCode !== offering.trackCode) continue;
      if (COMPONENT_CODES.has(row.subjectCode)) continue;
      if (!row.weeklyMinutes) continue;

      demand.set(
        row.subjectCode,
        (demand.get(row.subjectCode) ?? 0) +
          row.weeklyMinutes * offering.classCount,
      );
    }
  }

  return demand;
}

/**
 * How many teachers of each subject a school needs.
 *
 * Demand divided by what a teacher can actually be expected to give, rounded
 * up, plus a quarter.
 *
 * ── The headroom is not padding ─────────────────────────────────────────────
 * A staff sized exactly to its programme has no slack at all: every teacher
 * would have to be free in precisely the periods their classes are, which no
 * timetable can arrange, and one standing Wednesday-afternoon commitment makes
 * the week unsolvable. A quarter is roughly what a real school carries.
 *
 * ── Why the service is not the nominal one ──────────────────────────────────
 * A fifth of the staff is put on a reduced contract further down (see
 * `PART_TIME_SHARE`), so the average teacher gives less than a full service.
 * Sizing against the nominal figure and *then* cutting contracts produced
 * schools understaffed by exactly the hours the seed had just taken away — and
 * it bit hardest on the small subjects, where physique-chimie was sized at two
 * teachers and one of them turned out to be a vacataire.
 *
 * Both figures come from shared constants, so the two steps cannot drift apart
 * again.
 */
function teacherPlan(): TeacherRequirement[] {
  const labels = new Map(
    MOROCCAN_CURSUS.subjects.map((subject) => [
      subject.code,
      subject.shortName ?? subject.name,
    ]),
  );

  // What one teacher gives on average, once the reduced contracts are counted.
  const effectiveService =
    DEFAULT_SETTINGS.teacherWeeklyMinutes *
    (1 - PART_TIME_SHARE * (1 - PART_TIME_FACTOR));

  return [...subjectDemand()]
    .sort((a, b) => b[1] - a[1])
    .map(([subjectCode, minutes]) => ({
      subjectCode,
      subjectLabel: labels.get(subjectCode) ?? subjectCode,
      count: Math.max(1, Math.ceil((minutes * 1.25) / effectiveService)),
    }));
}

/**
 * The subjects actually timetabled at each level: the programme's rows, minus
 * the components (which are marked inside their parent, not taught separately).
 */
const PROGRAMME_BY_LEVEL: Record<string, string[]> = (() => {
  const byLevel: Record<string, string[]> = {};
  for (const row of MOROCCAN_CURSUS.programme) {
    if (COMPONENT_CODES.has(row.subjectCode)) continue;
    const list = (byLevel[row.levelCode] ??= []);
    if (!list.includes(row.subjectCode)) list.push(row.subjectCode);
  }
  return byLevel;
})();

async function main() {
  console.log("Seeding…\n");

  await seedPermissions(db);
  const organization = await seedOrganization(db);
  const roles = await seedRoles(db, organization.id);
  const schools = await seedSchools(db, organization.id);

  // Years first: users land in a working context, and everything year-scoped
  // needs them.
  const yearsBySchool: Record<
    string,
    Awaited<ReturnType<typeof seedSchoolYears>>
  > = {};
  for (const school of schools) {
    yearsBySchool[school.id] = await seedSchoolYears(db, school.id);
  }

  // The staff each school needs, read off the programme it has declared — see
  // `teacherPlan`. The same figure for both, since they run the same cursus.
  const staffing = teacherPlan();
  const teachersBySchool = await seedUsers(db, {
    teacherPlan: Object.fromEntries(
      PLANS.map((plan) => [plan.code, staffing] as const),
    ),
    organizationId: organization.id,
    schools,
    roles,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  });

  const subjectMinutes = subjectMinutesByLevel();
  const labSubjectCodes = MOROCCAN_CURSUS.subjects
    .filter((subject) => subject.requiresLab)
    .map((subject) => subject.code);

  for (const plan of PLANS) {
    const school = schools.find((entry) => entry.code === plan.code);
    if (!school) continue;

    console.log(`\n${school.name}`);

    const { levelIdByCode, trackIdByCode, subjectIdByCode } =
      await seedAcademics(db, school.id, MOROCCAN_CURSUS);
    const roomIdByCode = await seedRooms(db, school.id, SCHOOL_ROOMS);
    // Towns before pupils: a birthplace is now a reference, not a string.
    const cityIdByCode = await seedCities(db, school.id);
    await seedNeighbourhoods(db, school.id, cityIdByCode);
    const feeTypeIdByCode = await seedFeeTypes(db, school.id, FEE_TYPES);

    // The tills and expense rubriques. Year-independent, like the fee
    // catalogue above it — how much is collected is a fact of each year, but
    // where it is collected is a fact of the school.
    await seedTreasury(db, school.id);

    // The kinds of contrôle the school runs. Year-independent, like the fee
    // catalogue and the tills: what a devoir surveillé weighs is a policy of
    // the school, not of any one year. Only the types — the papers themselves
    // are generated through the screen. See modules/assessments/seed.ts.
    await seedAssessmentTypes(db, school.id);

    // The articles a liste de fournitures may name. Year-independent for the
    // same reason as the fee catalogue: what the school is willing to ask a
    // family to buy is a policy of the school, not of one rentrée.
    await seedSupplyArticles(db, school.id);

    // The pièces a dossier d'inscription calls for. Year-independent like the
    // rest: what the school asks a family to bring is its own policy, and a
    // pupil's dossier is identity rather than a year's business.
    await seedDocumentTypes(db, school.id);

    // The payroll, also year-independent. Before the fleet below, because a bus
    // names one of these people as its driver rather than repeating a string.
    const teachers = teachersBySchool[school.id] ?? [];
    const driverIdByName = await seedHr(db, { schoolId: school.id, teachers });

    const roomsOfKind = (kinds: string[]) =>
      SCHOOL_ROOMS.filter((room) => kinds.includes(room.kind))
        .map((room) => roomIdByCode[room.code])
        .filter(Boolean);

    for (const year of yearsBySchool[school.id]) {
      console.log(`  ── ${year.name} (${year.status.toLowerCase()})`);

      const slots = await seedTimeSlots(db, year.id);

      // The calendar the timetable reads to know which weeks are taught.
      await seedHolidays(db, year.id, year.startDate, year.endDate);
      // After the holidays: which weeks are taught depends on them.
      await seedSchoolWeeks(db, year.id, year.startDate, year.endDate);
      await seedTransport(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        driverIdByName,
      });
      await seedFeeRatesAndDiscounts(db, {
        schoolYearId: year.id,
        rates: FEE_RATES,
        feeTypeIdByCode,
        levelIdByCode,
      });

      // The staff's horaires, once the periods they refer to exist.
      await seedTeacherAvailability(db, { slots, teachers });

      const classes = await seedClasses(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        plans: PLANS_PER_SCHOOL,
        levelIdByCode,
        trackIdByCode,
        subjectIdByCode,
        labSubjectCodes,
        roomIds: roomsOfKind(["CLASSROOM"]),
        teachers,
        withStaffing: true,
        programmeByLevel: PROGRAMME_BY_LEVEL,
        subjectMinutes,
      });

      await seedTimetable(db, {
        classes,
        slots,
        termId: year.terms[1],
        labRoomIds: roomsOfKind(["LAB_SCIENCE", "LAB_COMPUTER"]),
      });

      /*
        The roster, sized to the classes just opened.

        Built here rather than held as a constant because the ages it declares
        are read against *this* year's start date — a roster fixed in code would
        age out of its own levels the first September after it was written. See
        `buildRoster`.
      */
      const roster = buildRoster({
        cohorts: COHORTS,
        cityCode: plan.cityCode,
        cityName: plan.cityName,
        yearLabel: year.name.slice(0, 4),
        variant: plan.variant,
      });

      // Families before children: a pupil hangs off a dossier.
      const familyIdByCode = await seedFamilies(db, school.id, roster.families);
      const students = await seedStudents(db, {
        schoolId: school.id,
        yearStart: year.startDate,
        familyIdByCode,
        cityIdByCode,
        students: roster.students,
      });

      // Everybody gets a seat: the intake was sized to fill the classes exactly,
      // so leaving a share unseated would just make every class short.
      await seedEnrolments(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        students,
        unseatedEvery: null,
      });
    }

    // Who may teach what, and who is on a reduced service. Both are facts about
    // the school rather than any one year, so they sit after the year loop.
    await seedTeacherSubjects(db, {
      schoolId: school.id,
      teachers,
      subjectIdByCode,
    });
    await seedPartTimeContracts(db, {
      schoolId: school.id,
      teachers,
      fullServiceMinutes: DEFAULT_SETTINGS.teacherWeeklyMinutes,
    });
  }

  console.log(`\nDone. Sign in with:\n  ${ADMIN_EMAIL}\n  ${ADMIN_PASSWORD}\n`);
  console.log(
    "Every other account shares the same password. Teachers use\n" +
      "firstname.lastname@almanar.ma — for example karim.bennis@almanar.ma.\n",
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
