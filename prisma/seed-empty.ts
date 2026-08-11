import { seedPermissions, seedRoles } from "@/modules/access/seed";
import { seedOrganization } from "@/modules/organization/seed";
import { seedAdmin } from "@/modules/users/seed";
import { db } from "@/prisma/seed/client";

/**
 * The empty seed: an organisation, its roles, and one administrator.
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 * The third and smallest of the three starting points. `prisma/seed.ts` builds
 * a demonstration to look at the app with; `prisma/seed-config.ts` builds a
 * school that is configured but has nobody in it; this builds neither — no
 * school at all, so the first thing the administrator does is create one
 * through the setup wizard at `/schools/new`.
 *
 * That is the point. Before the wizard existed, a real deployment had to start
 * from `seed-config` and then unpick a demonstration school it did not want —
 * its name, its cursus, its rooms, its price list. Now the wizard asks those
 * questions properly, and the honest starting state is a database with nothing
 * to unpick.
 *
 *   seeded — the permission catalogue, the system roles, the organisation, and
 *            one super administrator.
 *
 *   not seeded — every school, and therefore every year, cursus, room, fee,
 *            class and person. All of it is the wizard's to ask for.
 *
 * The organisation is named but not invented: no ICE, no tax id, no address and
 * no telephone, because those head every receipt and bulletin the school prints
 * and a plausible wrong one is worse than a blank. Set `SEED_ORG_NAME` to put
 * the real name in at seed time; everything else is filled in on /organization.
 *
 * The administrator opens on no school and no year: `getAuthContext` resolves
 * both to null rather than guessing, and `/schools/new` is reachable on an
 * organisation-wide `school.create` that needs neither.
 *
 * Same rules as the other two: it upserts on each table's own unique key and
 * never deletes, so running it twice changes nothing — and running it over a
 * database that already has schools leaves them alone.
 *
 *   npm run db:seed:empty
 */

// SEED_ORG_NAME is read in modules/organization/seed.ts, beside the row it names.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@groupescolaire.ma";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

async function main() {
  console.log("Seeding an empty database…\n");

  await seedPermissions(db);
  const organization = await seedOrganization(db);
  const roles = await seedRoles(db, organization.id);

  await seedAdmin(db, {
    organizationId: organization.id,
    roles,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    // No school to point the working context at — creating the first one is
    // the administrator's first job.
  });

  console.log(`
Done. Sign in with:
  ${ADMIN_EMAIL}
  ${ADMIN_PASSWORD}

There is no school yet. Create the first one at /schools/new — the wizard
asks for the year, the cursus, the rooms, the bell schedule, the classes and
the fees, and writes them all in one go.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
