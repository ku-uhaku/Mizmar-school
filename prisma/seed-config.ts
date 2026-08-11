import { seedPermissions, seedRoles } from "@/modules/access/seed";
import { seedOrganization } from "@/modules/organization/seed";
import { seedSchoolYears } from "@/modules/school-years/seed";
import { seedSchools } from "@/modules/schools/seed";
import { seedUsers } from "@/modules/users/seed";
import { db } from "@/prisma/seed/client";
import { configureSchool } from "@/prisma/seed/configure";

/**
 * The configuration seed: schools ready to be used, and nothing in them yet.
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 * `prisma/seed.ts` builds a *demonstration* — four hundred pupils, a staff, a
 * timetable, a year of receipts — which is what you want to look at the app with
 * and the last thing you want to start a real school from. This builds the other
 * half: everything a school has to declare before it can enrol anybody, and not
 * one row of anybody. Both schools of the group, since a real deployment opens
 * them together.
 *
 * ── The line it draws ────────────────────────────────────────────────────────
 * Configuration is what the school decides *about itself*. People, and anything
 * that hangs off a person, are the school's work rather than its settings — so
 * they are entered through the screens, by whoever actually knows them.
 *
 *   seeded — the organisation and its schools, their years and their calendar
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
 * Every one of those seeded lines is `configureSchool`, which is also what the
 * demo seed runs before it populates anything — see the note there. This file is
 * the orchestration and nothing else.
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
    const years = yearsBySchool[school.id];

    for (const year of years) {
      console.log(`  ── ${year.name} (${year.status.toLowerCase()})`);
    }

    await configureSchool(db, { school, years });
  }

  console.log(`\nDone. Sign in with:\n  ${ADMIN_EMAIL}\n  ${ADMIN_PASSWORD}\n`);
  console.log(
    `${schools.length} schools, configured and empty: no staff, no families,\n` +
      "no pupils, no classes, no timetable and no receipts. Add your own\n" +
      "through the screens, or run `npm run db:seed` instead for the full\n" +
      "demonstration.\n",
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
