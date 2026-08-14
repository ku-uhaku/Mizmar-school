import { MOROCCAN_CURSUS } from "@/modules/academics/presets";
import { seedPermissions, seedRoles } from "@/modules/access/seed";
import { seedClasses, type OfferingPlan } from "@/modules/classes/seed";
import { seedEnrolments, seedFeeAdjustments } from "@/modules/enrolment/seed";
import {
  PART_TIME_FACTOR,
  PART_TIME_SHARE,
  seedHr,
  seedPartTimeContracts,
  seedTeacherSubjects,
} from "@/modules/hr/seed";
import { seedPayments } from "@/modules/treasury/seed";
import { seedEvents } from "@/modules/events/seed";
import { seedTransport, seedTransportRidership } from "@/modules/transport/seed";
import { seedAssessments } from "@/modules/assessments/seed";
import { seedClassroom } from "@/modules/classroom/seed";
import {
  seedPortalAccounts,
  type SeededPortalAccounts,
} from "@/modules/portal/seed";
import { seedSupplyLists } from "@/modules/supplies/seed";
import { seedFamilies } from "@/modules/families/seed";
import { SCHOOL_ROOMS } from "@/modules/facilities/presets";
import { MOROCCAN_NEIGHBOURHOODS } from "@/modules/geography/seed";
import { seedMassarDemo } from "@/modules/massar/seed";
import { DEMO_ORGANIZATION, seedOrganization } from "@/modules/organization/seed";
import { seedSchoolYears } from "@/modules/school-years/seed";
import { seedSchools } from "@/modules/schools/seed";
import { seedStudents } from "@/modules/students/seed";
import {
  seedTeacherAvailability,
  seedTimetable,
} from "@/modules/timetable/seed";
import { seedUsers, type TeacherRequirement } from "@/modules/users/seed";
import { db } from "@/prisma/seed/client";
import { configureSchool } from "@/prisma/seed/configure";
import { buildRoster, type Cohort } from "@/prisma/seed/roster";

/**
 * Idempotent seed: safe to re-run.
 *
 * Each module seeds its own tables — this file only decides the order and hands
 * ids along, so a new module means a new `modules/<x>/seed.ts` and one call
 * here rather than another few hundred lines in a single script.
 *
 * ── Two schools, and the difference between them is the point ───────────────
 * Every school in `SCHOOLS` is configured — `configureSchool`, the same step
 * `prisma/seed-config.ts` is made of. A school that also has a `SchoolPlan`
 * below is then populated; one that does not is left configured and empty. So
 * the demo database holds both halves of the product at once:
 *
 *   Al Manar Oujda       a school in its second term — staff, pupils, classes,
 *                        a timetable, a year of receipts, marks and absences
 *   Al Manar Casablanca  the same school the day before it opens — the cursus,
 *                        the rooms, the calendar, the bell schedule, the fee
 *                        catalogue and price list, the caisse, the roles, and
 *                        nobody in it
 *
 * Adding a plan for Casablanca is all it takes to populate it too; deleting
 * Oujda's would empty it. Nothing else in this file knows which is which.
 *
 * The populated school, to an exact shape:
 *
 *   1 school  ×  1 school year  ×  3 cycles  ×  12 levels  ×  2 classes a level
 *
 * — 24 classes of 20 places, 432 pupils across some 205 dossiers rather than one
 * apiece — see `OUJDA_HOUSEHOLD_SIZES` — which is a school at a real working
 * size: eighteen names on a class list, a mark sheet that has to scroll, a fee
 * grid with enough rows to sort.
 * Plus everything those need to mean anything: subjects with their
 * components, the programme that weights them, rooms, semesters, the bell
 * schedule (standard and Ramadan), teaching assignments, a worked timetable,
 * dossiers familiaux with siblings across levels, fee catalogues, price
 * lists, discounts and every pupil's échéancier.
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

/**
 * Two parallel classes at every level, twenty places apiece, eighteen taken.
 *
 * Twenty is the school's declared class size. Filling eighteen of them rather
 * than all twenty is deliberate: a class at capacity makes every screen that
 * exists to show *remaining places* — the inscription form, the class card, the
 * seat check that refuses an over-enrolment — read the same as one that is
 * merely full, and the two are the states worth telling apart.
 *
 * 12 levels × 2 classes × 18 = 432 pupils, which is a school of a real size.
 */
const CLASSES_PER_LEVEL = 2;
const PUPILS_PER_CLASS = 18;
const CLASS_CAPACITY = 20;

/**
 * What a full-time teacher gives in a week, in minutes — 22h, the usual
 * Moroccan secondary service. A staffing-planning constant of the seed's own:
 * the live generator derives its own ceiling from the bell schedule (see
 * `weekCapacityMinutes` in modules/timetable/service.ts), but sizing a demo
 * staff still needs a number to divide the programme's demand by before any
 * school, let alone a bell schedule, exists.
 */
const FULL_SERVICE_MINUTES = 1320;

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

/**
 * Pupils at each of the twelve levels, for a school filling its classes to
 * `pupilsPerClass`. The class structure itself — `PLANS_PER_SCHOOL` — stays the
 * same for every school in the network; only how full each seat is varies.
 */
function cohortsFor(pupilsPerClass: number): Cohort[] {
  return LEVEL_CODES.map((levelCode) => ({
    levelCode,
    age: AGE_AT_LEVEL[levelCode],
    count: CLASSES_PER_LEVEL * pupilsPerClass,
  }));
}

/**
 * Oujda's household sizes, cycled: an only child now and then, mostly two,
 * a third of them three.
 *
 * Averaging 2.1, so its 432 pupils land in about 205 dossiers. The single-child
 * files matter as much as the large ones — the sibling reduction has to be
 * demonstrably *absent* somewhere, or a reader cannot tell it is being applied.
 * See `householdSize` on `buildRoster`.
 */
const OUJDA_HOUSEHOLD_SIZES = [2, 3, 1, 2, 3, 2, 1, 2, 3, 2];
function oujdaHouseholdSize(familyIndex: number): number {
  return OUJDA_HOUSEHOLD_SIZES[familyIndex % OUJDA_HOUSEHOLD_SIZES.length];
}

/**
 * A school to *populate*, and how.
 *
 * Absence is meaningful: a school in `SCHOOLS` with no plan here is configured
 * and left empty, which is the second half of what this seed demonstrates.
 */
type SchoolPlan = {
  code: string;
  /** Town the pupils are born in and the dossiers are addressed in. */
  cityCode: string;
  cityName: string;
  /** Offsets the name pools so the schools do not produce the same roster. */
  variant: number;
  /** Pupils enrolled per class, when it differs from the network default. */
  pupilsPerClass?: number;
  /** Children per dossier, when it differs from two apiece. */
  householdSize?: (familyIndex: number) => number;
};

const PLANS: SchoolPlan[] = [
  {
    code: "ALM-OUJDA",
    cityCode: "OUJDA",
    cityName: "Oujda",
    variant: 0,
    // The network default: 2 classes × 18 pupils × 12 levels = 432.
    householdSize: oujdaHouseholdSize,
  },
  // ALM-CASA has no plan on purpose — see the note at the top of this file. It
  // is the configured-and-empty school, and it is configured by the same
  // `configureSchool` this school gets, so the two cannot differ in their
  // settings.
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
 * How many teachers of each subject a school gets: two, or three for a subject
 * one teacher could not cover on their own.
 *
 * ── This is a small staff on purpose ────────────────────────────────────────
 * A flat two or three per subject, **not** a roster sized to the programme.
 * That is a deliberate choice about what the demo is for: a staff list you can
 * read on one screen and reason about, where "who else could take this?" has an
 * answer you can hold in your head. It is what makes the qualifications screen
 * and the generator's affectations legible.
 *
 * The cost is real and is not hidden. Twenty-four classes of arabe want roughly
 * ten services and three teachers cannot give them, so a full generation run
 * reports shortfalls on the big subjects — see the note under `PLANS_PER_SCHOOL`
 * for the class count that drives them. That is a true statement about an
 * understaffed school, which is a case the generator has to handle and the
 * screen has to show; it is not the generator failing.
 *
 * A school wanting a fully coverable week raises `CLASSES_PER_LEVEL` down or
 * these two numbers up. They are here, together, so that is one edit.
 *
 * ── Why the service is not the nominal one ──────────────────────────────────
 * A fifth of the staff is put on a reduced contract further down (see
 * `PART_TIME_SHARE`), so the average teacher gives less than a full service.
 * The threshold below is measured against that effective figure rather than the
 * nominal one — otherwise a subject needing 1.1 services would be given two
 * teachers, one of whom then turned out to be a vacataire.
 */

/** A subject any one teacher could cover alone. */
const TEACHERS_PER_SUBJECT = 2;
/** A subject that needs more than one service, and so a third pair of hands. */
const TEACHERS_PER_BUSY_SUBJECT = 3;
/**
 * The second subject a teacher of each subject may cover, best first.
 *
 * The doublings a Moroccan private school actually makes, not every pair that
 * is arithmetically possible: a professeur de maths covers physique-chimie and
 * l'informatique, an enseignant d'arabe takes l'éducation islamique and, in the
 * qualifying cycle, la philosophie — which is taught in Arabic. Nobody covers
 * l'EPS, which is why it has no entry.
 *
 * It is read in both directions on purpose. The small subjects — histoire-géo,
 * informatique, philosophie — are sized at one teacher by `teacherPlan`, and
 * appearing in a bigger subject's list is what gives them a second qualified
 * person without inventing a post the programme does not pay for.
 *
 * Only the teachers `seedUsers` picks out actually get one; this says what they
 * would take, not that they all do.
 */
const SECOND_SUBJECTS: Record<string, string[]> = {
  AR: ["ISL", "PHILO"],
  FR: ["EN", "HG"],
  MATH: ["PC", "INFO"],
  PC: ["MATH"],
  SVT: ["PC"],
  ISL: ["AR"],
  EN: ["FR"],
  HG: ["ISL"],
  AMZ: ["AR"],
  INFO: ["MATH"],
  PHILO: ["HG"],
};

function teacherPlan(): TeacherRequirement[] {
  const labels = new Map(
    MOROCCAN_CURSUS.subjects.map((subject) => [
      subject.code,
      subject.shortName ?? subject.name,
    ]),
  );

  // What one teacher gives on average, once the reduced contracts are counted.
  const effectiveService =
    FULL_SERVICE_MINUTES * (1 - PART_TIME_SHARE * (1 - PART_TIME_FACTOR));

  const demand = subjectDemand();

  return [...demand]
    .sort((a, b) => b[1] - a[1])
    .map(([subjectCode, minutes]) => ({
      subjectCode,
      subjectLabel: labels.get(subjectCode) ?? subjectCode,
      count:
        minutes > effectiveService
          ? TEACHERS_PER_BUSY_SUBJECT
          : TEACHERS_PER_SUBJECT,
      // Filtered against the programme rather than trusted: a school running
      // only the primaire has no philosophie to cover, and a qualification for
      // a subject it does not teach is a row nothing will ever read.
      coversAlso: (SECOND_SUBJECTS[subjectCode] ?? []).filter((code) =>
        demand.has(code),
      ),
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
  const organization = await seedOrganization(db, DEMO_ORGANIZATION);
  const roles = await seedRoles(db, organization.id);

  /** Mobile logins opened per school, reported at the end. */
  const portalLogins: SeededPortalAccounts[] = [];
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

  // Whoever signed the adjustments below. The annulations journal names a
  // person, and a trail with nobody on it is the thing it exists to prevent.
  const admin = await db.user.findUniqueOrThrow({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  const adminId = admin.id;

  const subjectMinutes = subjectMinutesByLevel();
  const labSubjectCodes = MOROCCAN_CURSUS.subjects
    .filter((subject) => subject.requiresLab)
    .map((subject) => subject.code);

  for (const school of schools) {
    console.log(`\n${school.name}`);

    /*
      The settings first, and every school gets them — the cursus, the rooms,
      the towns and quartiers, the fee catalogue and each year's price list, the
      caisse, the calendar and the bell schedule. Exactly what
      `npm run db:seed:config` lays, because it is the same function.
    */
    const years = yearsBySchool[school.id];
    const {
      levelIdByCode,
      trackIdByCode,
      subjectIdByCode,
      roomIdByCode,
      cityIdByCode,
      neighbourhoodIdByCode,
      assessmentTypeIdByCode,
      slotsByYear,
    } = await configureSchool(db, { school, years });

    // No plan means the configured-and-empty school: it stops here, with
    // everything it needs to enrol its first pupil and not one row of anybody.
    const plan = PLANS.find((entry) => entry.code === school.code);
    if (!plan) {
      console.log("  configuration only — no staff, no pupils, no receipts");
      continue;
    }

    // The payroll, year-independent. Before the fleet below, because a bus
    // names one of these people as its driver rather than repeating a string.
    const teachers = teachersBySchool[school.id] ?? [];
    const driverIdByName = await seedHr(db, { schoolId: school.id, teachers });

    const roomsOfKind = (kinds: string[]) =>
      SCHOOL_ROOMS.filter((room) => kinds.includes(room.kind))
        .map((room) => roomIdByCode[room.code])
        .filter(Boolean);

    for (const year of years) {
      console.log(`  ── ${year.name} (${year.status.toLowerCase()})`);

      const slots = slotsByYear[year.id];

      /*
        Who may take what, this year — before the classes, which is the order
        the generator needs it in.

        A staffing plan per year rather than one for the school: `TeacherSubject`
        is the year's now, and a grid drawn for 2024-2025 reads the people who
        were there in 2024-2025. Each year gets the same demo staff, which is
        what a school with no turnover looks like; the interesting cases —
        somebody leaving, a vacataire for one year — are made in the screen.
      */
      await seedTeacherSubjects(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        teachers,
        subjectIdByCode,
      });

      // What the school announces to its families. Dated off the year's own
      // start, so the rentrée lands on the rentrée whatever shape the year is.
      await seedEvents(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        yearStart: year.startDate,
        publishedById: adminId,
      });
      await seedTransport(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        cityCode: plan.cityCode,
        driverIdByName,
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

      // What each class is asked to bring. After the classes, obviously, and
      // after the article catalogue the items point at.
      await seedSupplyLists(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        classIds: classes.map((klass) => klass.id),
        authorId: adminId,
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
        cohorts: cohortsFor(plan.pupilsPerClass ?? PUPILS_PER_CLASS),
        cityCode: plan.cityCode,
        cityName: plan.cityName,
        // Only this town's quartiers: a Casablanca household does not live in
        // Agdal, and a bus line drawn against one could never collect it.
        neighbourhoodCodes: MOROCCAN_NEIGHBOURHOODS.filter(
          (quartier) =>
            quartier.cityCode === plan.cityCode &&
            neighbourhoodIdByCode[quartier.code],
        ).map((quartier) => quartier.code),
        yearLabel: year.name.slice(0, 4),
        variant: plan.variant,
        householdSize: plan.householdSize,
      });

      // Families before children: a pupil hangs off a dossier.
      const familyIdByCode = await seedFamilies(db, school.id, roster.families);
      const students = await seedStudents(db, {
        schoolId: school.id,
        yearStart: year.startDate,
        familyIdByCode,
        cityIdByCode,
        neighbourhoodIdByCode,
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

      // Who rides which bus, once there are enrolments to hang an abonnement
      // off — the lines themselves were drawn well before the pupils existed.
      await seedTransportRidership(db, {
        schoolId: school.id,
        schoolYearId: year.id,
      });

      // Reductions and annulations before any money moves: a receipt settles
      // `amountCentimes`, so discounting a line after it has been paid would
      // leave the family in credit.
      await seedFeeAdjustments(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        actorId: adminId,
      });

      // After the enrolments, because a receipt settles a schedule line and
      // there is no schedule until the pupil is enrolled.
      await seedPayments(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        variant: PLANS.indexOf(plan),
      });

      /*
        The year's contrôles and their marks, then the register and the carnet.

        Last, and for the same reason the receipts are: both hang off the
        enrolment. A mark belongs to a child *in a class in a year*, so there is
        nothing to write until the roster is seated.
      */
      await seedAssessments(db, {
        schoolId: school.id,
        classes,
        termIds: Object.values(year.terms),
        typeIdByCode: assessmentTypeIdByCode,
        createdById: adminId,
      });

      await seedClassroom(db, {
        classes,
        termIds: Object.values(year.terms),
      });
    }

    // Who is on a reduced service — a term of employment, and so the school's
    // rather than any one year's. Who may teach what is the year's now, and is
    // written inside the loop above.
    await seedPartTimeContracts(db, {
      schoolId: school.id,
      teachers,
      fullServiceMinutes: FULL_SERVICE_MINUTES,
    });

    // The native app's logins, last: a chauffeur needs the bus they drive to
    // exist, and a parent needs a dossier with an enrolled child on it.
    const defaultYear =
      years.find((year) => year.status === "ACTIVE") ?? years[0];

    if (defaultYear) {
      const portal = await seedPortalAccounts(db, {
        organizationId: organization.id,
        schoolId: school.id,
        schoolYearId: defaultYear.id,
        roles,
        password: ADMIN_PASSWORD,
      });

      console.log(
        `  portail ✓ (${portal.driverEmail ? "1 chauffeur" : "aucun chauffeur"}, ` +
          `${portal.parentEmails.length} familles)`,
      );
      portalLogins.push(portal);
    }
  }

  /*
    The MASSAR demonstration, last and on its own.

    A second establishment rather than a corner of Al Manar: `147610.xlsx` is a
    real export from سما أدمين الخصوصية for 2022/2023, and the reconciliation
    exists precisely to refuse a file that belongs to another school. Seeding its
    twenty-six children into the demo school would defeat the thing being
    demonstrated. The admin reaches it from the school switcher — org-wide reach
    means no membership is needed.
  */
  await seedMassarDemo(db, organization.id);

  /*
    The dashboard asks for a username, not an email — see User.username — so the
    username is what this prints. It is the local part of the address, which is
    also what the migration derived for accounts predating the column.
  */
  const adminUsername = ADMIN_EMAIL.split("@")[0];
  console.log(
    `\nDone. Sign in at /login with:\n  ${adminUsername}\n  ${ADMIN_PASSWORD}\n`,
  );
  console.log(
    "Every other account shares the same password. Teachers sign in as\n" +
      "firstname.lastname — for example karim.bennis.\n",
  );

  // Which school is which, since the switcher shows both and they are meant to
  // be looked at against each other.
  const empty = schools.filter(
    (school) => !PLANS.some((plan) => plan.code === school.code),
  );
  if (empty.length > 0) {
    console.log(
      "Switch schools in the header to see the other half:\n" +
        empty
          .map((school) => `  ${school.name} — configured, and empty\n`)
          .join(""),
    );
  }

  const driverLogin = portalLogins.find((entry) => entry.driverEmail);
  const parentLogin = portalLogins.flatMap((entry) => entry.parentEmails)[0];
  if (driverLogin || parentLogin) {
    // The phone still takes an email: a guardian has no username, and the
    // driver may give either. See the note on the mobile login route.
    console.log(
      "Application mobile (courriel) :\n" +
        (driverLogin ? `  chauffeur — ${driverLogin.driverEmail}\n` : "") +
        (parentLogin ? `  famille   — ${parentLogin}\n` : ""),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
