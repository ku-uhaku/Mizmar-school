import {
  FULL_RANGE_PRESET,
  PRIMARY_ONLY_PRESET,
  seedAcademics,
  type AcademicsPreset,
} from "@/modules/academics/seed";
import { seedPermissions, seedRoles } from "@/modules/access/seed";
import {
  FULL_RANGE_FEES,
  FULL_RANGE_RATES,
  PRIMARY_ONLY_FEES,
  PRIMARY_ONLY_RATES,
  seedFeeRatesAndDiscounts,
  seedFeeTypes,
  type FeeRateSeed,
  type FeeTypeSeed,
} from "@/modules/billing/seed";
import { seedClasses, type OfferingPlan } from "@/modules/classes/seed";
import { seedEnrolments } from "@/modules/enrolment/seed";
import {
  FAMILY_SEEDS,
  seedFamilies,
  type FamilySeed,
} from "@/modules/families/seed";
import {
  FULL_RANGE_ROOMS,
  PRIMARY_ONLY_ROOMS,
  seedRooms,
  type RoomSeed,
} from "@/modules/facilities/seed";
import { seedOrganization } from "@/modules/organization/seed";
import { seedSchoolYears } from "@/modules/school-years/seed";
import { seedSchools } from "@/modules/schools/seed";
import {
  STUDENT_SEEDS,
  seedStudents,
  type StudentSeed,
} from "@/modules/students/seed";
import { seedTimeSlots, seedTimetable } from "@/modules/timetable/seed";
import { seedUsers } from "@/modules/users/seed";
import { db } from "@/prisma/seed/client";

/**
 * Idempotent seed: safe to re-run.
 *
 * Each module seeds its own tables — this file only decides the order and hands
 * ids along, so a new module means a new `modules/<x>/seed.ts` and one call
 * here rather than another few hundred lines in a single script.
 *
 * What it builds: one organisation, **two schools** with deliberately different
 * setups, **three school years each**, and a full configuration for every one of
 * them — cycles, levels, filières, subjects with their components, programmes,
 * rooms, semesters, timetable grids (standard and Ramadan), levels opened,
 * classes, groups, teaching assignments, a worked timetable, fee catalogues,
 * price lists and discounts.
 *
 * Note: it upserts and never deletes, so schools you created yourself — or ones
 * seeded by an earlier version of this file — are left in place. Use
 * `npm run db:reset` for a clean slate.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@groupescolaire.ma";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

/** How many parallel classes each school opens, per level and track. */
const FULL_RANGE_PLANS: OfferingPlan[] = [
  ...["1AP", "2AP", "3AP", "4AP", "5AP", "6AP"].map((levelCode) => ({
    levelCode,
    trackCode: null,
    classCount: 2,
    capacity: 30,
  })),
  ...["1AC", "2AC", "3AC"].map((levelCode) => ({
    levelCode,
    trackCode: null,
    classCount: 2,
    capacity: 34,
  })),
  { levelCode: "TC", trackCode: "TC-S", classCount: 2, capacity: 36 },
  { levelCode: "TC", trackCode: "TC-LSH", classCount: 1, capacity: 36 },
  { levelCode: "1BAC", trackCode: "1B-SE", classCount: 1, capacity: 34 },
  { levelCode: "1BAC", trackCode: "1B-SM", classCount: 1, capacity: 30 },
  { levelCode: "1BAC", trackCode: "1B-L", classCount: 1, capacity: 36 },
  { levelCode: "2BAC", trackCode: "2B-SVT", classCount: 1, capacity: 34 },
  { levelCode: "2BAC", trackCode: "2B-PC", classCount: 1, capacity: 32 },
  { levelCode: "2BAC", trackCode: "2B-SM-A", classCount: 1, capacity: 28 },
  { levelCode: "2BAC", trackCode: "2B-L", classCount: 1, capacity: 36 },
];

const PRIMARY_ONLY_PLANS: OfferingPlan[] = [
  { levelCode: "MS", trackCode: null, classCount: 1, capacity: 20 },
  { levelCode: "GS", trackCode: null, classCount: 1, capacity: 20 },
  ...["1AP", "2AP", "3AP", "4AP", "5AP", "6AP"].map((levelCode) => ({
    levelCode,
    trackCode: null,
    classCount: 1,
    capacity: 26,
  })),
];

/**
 * The dossiers each school keeps, split so the two have different families —
 * a household belongs to one school (see the note on the Family model), and
 * giving both the same file numbers would be one dossier duplicated rather than
 * two schools with their own.
 */
const CASA_FAMILY_CODES = new Set([
  "F-2025-0001",
  "F-2025-0002",
  "F-2025-0003",
  "F-2025-0004",
  "F-2025-0005",
  "F-2025-0006",
]);

const familiesFor = (codes: Set<string>): FamilySeed[] =>
  FAMILY_SEEDS.filter((family) => codes.has(family.code));

const studentsFor = (families: FamilySeed[]): StudentSeed[] => {
  const codes = new Set(families.map((family) => family.code));
  return STUDENT_SEEDS.filter((student) => codes.has(student.familyCode));
};

type SchoolPlan = {
  code: string;
  academics: AcademicsPreset;
  rooms: RoomSeed[];
  plans: OfferingPlan[];
  feeTypes: FeeTypeSeed[];
  rates: FeeRateSeed[];
  families: FamilySeed[];
};

const CASA_FAMILIES = familiesFor(CASA_FAMILY_CODES);
const RABAT_FAMILIES = FAMILY_SEEDS.filter(
  (family) => !CASA_FAMILY_CODES.has(family.code),
);

const PLANS: SchoolPlan[] = [
  {
    code: "ALM-CASA",
    academics: FULL_RANGE_PRESET,
    rooms: FULL_RANGE_ROOMS,
    plans: FULL_RANGE_PLANS,
    feeTypes: FULL_RANGE_FEES,
    rates: FULL_RANGE_RATES,
    families: CASA_FAMILIES,
  },
  {
    code: "ALM-RABAT",
    academics: PRIMARY_ONLY_PRESET,
    rooms: PRIMARY_ONLY_ROOMS,
    plans: PRIMARY_ONLY_PLANS,
    feeTypes: PRIMARY_ONLY_FEES,
    rates: PRIMARY_ONLY_RATES,
    families: RABAT_FAMILIES,
  },
];

/**
 * The subjects actually timetabled at each level: the programme's rows, minus
 * the components (which are marked inside their parent, not taught separately).
 */
function programmeByLevel(preset: AcademicsPreset): Record<string, string[]> {
  const componentCodes = new Set(
    preset.subjects
      .filter((subject) => subject.parent)
      .map((subject) => subject.code),
  );

  const byLevel: Record<string, string[]> = {};
  for (const row of preset.programme) {
    if (componentCodes.has(row.subjectCode)) continue;
    const list = (byLevel[row.levelCode] ??= []);
    if (!list.includes(row.subjectCode)) list.push(row.subjectCode);
  }
  return byLevel;
}

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

  const teachersBySchool = await seedUsers(db, {
    organizationId: organization.id,
    schools,
    roles,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  });

  for (const plan of PLANS) {
    const school = schools.find((entry) => entry.code === plan.code);
    if (!school) continue;

    console.log(`\n${school.name}`);

    const { levelIdByCode, trackIdByCode, subjectIdByCode } =
      await seedAcademics(db, school.id, plan.academics);
    const roomIdByCode = await seedRooms(db, school.id, plan.rooms);
    const feeTypeIdByCode = await seedFeeTypes(db, school.id, plan.feeTypes);

    const labSubjectCodes = plan.academics.subjects
      .filter((subject) => subject.requiresLab)
      .map((subject) => subject.code);
    const labRoomIds = plan.rooms
      .filter(
        (room) => room.kind === "LAB_SCIENCE" || room.kind === "LAB_COMPUTER",
      )
      .map((room) => roomIdByCode[room.code])
      .filter(Boolean);
    const classroomIds = plan.rooms
      .filter((room) => room.kind === "CLASSROOM")
      .map((room) => roomIdByCode[room.code])
      .filter(Boolean);

    const byLevel = programmeByLevel(plan.academics);
    const teachers = teachersBySchool[school.id] ?? [];

    // Families and children are year-independent — they are identity, and only
    // the inscription below belongs to a year.
    const familyIdByCode = await seedFamilies(db, school.id, plan.families);

    for (const year of yearsBySchool[school.id]) {
      console.log(`  ── ${year.name} (${year.status.toLowerCase()})`);

      const slots = await seedTimeSlots(db, year.id);
      await seedFeeRatesAndDiscounts(db, {
        schoolYearId: year.id,
        rates: plan.rates,
        feeTypeIdByCode,
        levelIdByCode,
      });

      // Only the running year gets staffing and a timetable — a closed year's
      // grid is not interesting, and a planned one has no staff yet.
      const isActive = year.status === "ACTIVE";

      const classes = await seedClasses(db, {
        schoolId: school.id,
        schoolYearId: year.id,
        plans: plan.plans,
        levelIdByCode,
        trackIdByCode,
        subjectIdByCode,
        labSubjectCodes,
        roomIds: classroomIds,
        teachers,
        withStaffing: isActive,
        programmeByLevel: byLevel,
      });

      if (isActive) {
        await seedTimetable(db, {
          classes,
          slots,
          termId: year.terms[1],
          labRoomIds,
        });

        // Only the running year gets pupils. Ages are worked out from this
        // year's start, so the children land in the levels their age implies —
        // seeding a closed year as well would inscribe the same child twice at
        // two different levels.
        const students = await seedStudents(db, {
          schoolId: school.id,
          yearStart: year.startDate,
          familyIdByCode,
          students: studentsFor(plan.families),
        });

        await seedEnrolments(db, {
          schoolId: school.id,
          schoolYearId: year.id,
          students,
        });
      }
    }
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
