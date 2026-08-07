import { MOROCCAN_CURSUS, seedAcademics } from "@/modules/academics/seed";
import { seedPermissions, seedRoles } from "@/modules/access/seed";
import { seedAssessmentTypes } from "@/modules/assessments/seed";
import {
  FEE_RATES,
  FEE_TYPES,
  seedFeeRatesAndDiscounts,
  seedFeeTypes,
} from "@/modules/billing/seed";
import { seedDocumentTypes } from "@/modules/documents/seed";
import { SCHOOL_ROOMS, seedRooms } from "@/modules/facilities/seed";
import {
  cityCodeByName,
  seedCities,
  seedNeighbourhoods,
} from "@/modules/geography/seed";
import { seedOrganization } from "@/modules/organization/seed";
import { seedSchoolYears } from "@/modules/school-years/seed";
import { seedSchools } from "@/modules/schools/seed";
import { seedSupplyArticles } from "@/modules/supplies/seed";
import {
  seedHolidays,
  seedSchoolWeeks,
  seedTimeSlots,
} from "@/modules/timetable/seed";
import { seedTreasury } from "@/modules/treasury/seed";
import { seedUsers } from "@/modules/users/seed";
import { db } from "@/prisma/seed/client";

/**
 * The configuration seed: a school ready to be used, and nothing in it yet.
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 * `prisma/seed.ts` builds a *demonstration* — 120 pupils, a staff, a timetable,
 * a year of receipts — which is what you want to look at the app with and the
 * last thing you want to start a real school from. This builds the other half:
 * everything a school has to declare before it can enrol anybody, and not one
 * row of anybody.
 *
 * ── The line it draws ────────────────────────────────────────────────────────
 * Configuration is what the school decides *about itself*. People, and anything
 * that hangs off a person, are the school's work rather than its settings — so
 * they are entered through the screens, by whoever actually knows them.
 *
 *   seeded — the organisation and the school, its years and their calendar
 *            (semesters, holidays, taught weeks, the bell schedule), the
 *            cursus (cycles, levels, filières, matières and the programme that
 *            weights them), rooms, towns and quartiers, the fee catalogue and
 *            this year's price list and reductions, the tills, banks and
 *            rubriques of the caisse, the kinds of contrôle, the articles a
 *            liste de fournitures may name, the pièces a dossier calls for,
 *            the permission catalogue and the roles, and one administrator.
 *
 *   not seeded — teachers and staff, families, pupils, enrolments, classes and
 *            their teaching assignments, the timetable, buses and routes, the
 *            payroll, and every receipt.
 *
 * Same rules as the demo seed: it upserts on each table's own unique key and
 * never deletes, so running it twice changes nothing and running it over a
 * school somebody has started editing leaves their edits alone.
 *
 *   npm run db:seed:config
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@groupescolaire.ma";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

async function main() {
  console.log("Seeding configuration…\n");

  await seedPermissions(db);
  const organization = await seedOrganization(db);
  const roles = await seedRoles(db, organization.id);
  const schools = await seedSchools(db, organization.id);

  // Years before the administrator: their working context points at one, and a
  // session that opens on no year has nothing to show.
  const yearsBySchool: Record<
    string,
    Awaited<ReturnType<typeof seedSchoolYears>>
  > = {};
  for (const school of schools) {
    yearsBySchool[school.id] = await seedSchoolYears(db, school.id);
  }

  /*
    One account, and it is the super administrator.

    No demo office and no teaching staff: who works at the school is exactly the
    kind of thing this seed leaves to the school. The empty `teacherPlan` is
    what says so — `seedUsers` mints teachers from a plan, and a plan with
    nothing in it hires nobody.
  */
  await seedUsers(db, {
    organizationId: organization.id,
    schools,
    roles,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    teacherPlan: {},
    withOffice: false,
  });

  for (const school of schools) {
    console.log(`\n${school.name}`);

    // The cursus, and the rooms it is taught in.
    const { levelIdByCode } = await seedAcademics(
      db,
      school.id,
      MOROCCAN_CURSUS,
    );
    await seedRooms(db, school.id, SCHOOL_ROOMS);

    // Towns and quartiers: a birthplace and an address are references here, so
    // they have to exist before the first dossier is opened by hand.
    const cityIdByCode = await seedCities(db, school.id);
    // Quartiers of the school's own town only — a real school starting from
    // this seed adds the douars its pupils come from, and a list two-thirds
    // full of another city's quartiers buries them.
    await seedNeighbourhoods(
      db,
      school.id,
      cityIdByCode,
      cityCodeByName(school.city),
    );

    // What the school may charge. How much is a fact of each year — see below.
    const feeTypeIdByCode = await seedFeeTypes(db, school.id, FEE_TYPES);

    // The tills, the banks and the expense rubriques.
    await seedTreasury(db, school.id);

    // The school's own policies: what a contrôle weighs, what a family may be
    // asked to buy, what a dossier d'inscription must contain.
    await seedAssessmentTypes(db, school.id);
    await seedSupplyArticles(db, school.id);
    await seedDocumentTypes(db, school.id);

    for (const year of yearsBySchool[school.id]) {
      console.log(`  ── ${year.name} (${year.status.toLowerCase()})`);

      // The bell schedule, and the calendar the timetable reads to know which
      // weeks are taught. Holidays before weeks: which weeks are taught depends
      // on them.
      await seedTimeSlots(db, year.id);
      await seedHolidays(db, year.id, year.startDate, year.endDate);
      await seedSchoolWeeks(db, year.id, year.startDate, year.endDate);

      // The price list and the reductions offered — the year's half of billing,
      // against the catalogue declared above it.
      await seedFeeRatesAndDiscounts(db, {
        schoolYearId: year.id,
        rates: FEE_RATES,
        feeTypeIdByCode,
        levelIdByCode,
      });
    }
  }

  console.log(`\nDone. Sign in with:\n  ${ADMIN_EMAIL}\n  ${ADMIN_PASSWORD}\n`);
  console.log(
    "The school is configured and empty: no staff, no families, no pupils,\n" +
      "no classes, no timetable and no receipts. Add your own through the\n" +
      "screens, or run `npm run db:seed` instead for the full demonstration.\n",
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
