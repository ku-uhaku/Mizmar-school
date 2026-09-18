import { db } from "@/prisma/seed/client";

/**
 * Tags every pre-existing `TimetableEntry` with a `TimetableVersion`, so the
 * column can be tightened to required in the migration that follows this
 * script — see the "Migration approach" note in the timetable version-control
 * plan.
 *
 * One-off, run by hand once per environment (dev, staging, prod) between the
 * additive migration (`versionId` nullable) and the tightening one
 * (`versionId` required, unique index widened). Not wired into `db:seed` or
 * any automated deploy step — a production data backfill is a decision a
 * person makes on purpose, not a side effect of `prisma migrate deploy`.
 *
 * Written in raw SQL rather than through the typed client on purpose: by the
 * time this script exists in the repo, `prisma/schema` already declares
 * `versionId` as required — that is the finished state migration B leaves
 * behind — so the generated client's types describe a column that, at the
 * one moment this script is meant to run, is still nullable in the database.
 * Raw SQL is what lets the script mean what it says regardless of which
 * schema the checked-out code happens to declare.
 *
 * Idempotent: a scope whose version already holds entries is left alone, so
 * running this twice changes nothing.
 *
 *   npx tsx scripts/backfill-timetable-versions.ts           # dry run
 *   npx tsx scripts/backfill-timetable-versions.ts --write
 */

type Scope = { schoolYearId: string; scheduleKind: string };

function activeKeyOf(scope: Scope): string {
  return `${scope.schoolYearId}:${scope.scheduleKind}`;
}

function cuid(): string {
  // A short, sufficiently-unique id for a script that runs once per
  // environment — the format only has to satisfy VARCHAR(30), not match
  // Prisma's own cuid2 algorithm.
  return `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(
    0,
    30,
  );
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");

  const [{ count: beforeRaw }] = await db.$queryRawUnsafe<{ count: bigint }[]>(
    "SELECT COUNT(*) AS count FROM timetable_entries WHERE versionId IS NULL",
  );
  const before = Number(beforeRaw);
  console.log(
    `${before} entr${before === 1 ? "y" : "ies"} without a version.${write ? "" : "  [dry run]"}\n`,
  );
  if (before === 0) {
    console.log("Nothing to do.");
    return;
  }

  const scopes = await db.$queryRawUnsafe<Scope[]>(
    `SELECT DISTINCT ts.schoolYearId AS schoolYearId, ts.scheduleKind AS scheduleKind
     FROM timetable_entries te
     JOIN time_slots ts ON ts.id = te.timeSlotId
     WHERE te.versionId IS NULL`,
  );

  for (const scope of scopes) {
    const activeKey = activeKeyOf(scope);
    console.log(`→ ${activeKey}`);

    const existing = await db.$queryRawUnsafe<{ id: string }[]>(
      "SELECT id FROM timetable_versions WHERE activeKey = ? LIMIT 1",
      activeKey,
    );

    if (existing.length > 0) {
      console.log(`  already has an active version (${existing[0].id})`);
      if (write) {
        const moved = await db.$executeRawUnsafe(
          `UPDATE timetable_entries te
           JOIN time_slots ts ON ts.id = te.timeSlotId
           SET te.versionId = ?
           WHERE te.versionId IS NULL AND ts.schoolYearId = ? AND ts.scheduleKind = ?`,
          existing[0].id,
          scope.schoolYearId,
          scope.scheduleKind,
        );
        console.log(`  attached ${moved} orphaned entr${moved === 1 ? "y" : "ies"} to it`);
      }
      continue;
    }

    if (!write) {
      console.log("  would create version + attach entries  [not written]");
      continue;
    }

    const versionId = cuid();
    await db.$executeRawUnsafe(
      `INSERT INTO timetable_versions
         (id, schoolYearId, scheduleKind, status, activeKey, label, seed, createdById, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ACTIVE', ?, 'Pre-existing grid', NULL, NULL, NOW(3), NOW(3))`,
      versionId,
      scope.schoolYearId,
      scope.scheduleKind,
      activeKey,
    );
    const moved = await db.$executeRawUnsafe(
      `UPDATE timetable_entries te
       JOIN time_slots ts ON ts.id = te.timeSlotId
       SET te.versionId = ?
       WHERE te.versionId IS NULL AND ts.schoolYearId = ? AND ts.scheduleKind = ?`,
      versionId,
      scope.schoolYearId,
      scope.scheduleKind,
    );
    console.log(`  created ${versionId}, attached ${moved} entries`);
  }

  const [{ count: afterRaw }] = await db.$queryRawUnsafe<{ count: bigint }[]>(
    "SELECT COUNT(*) AS count FROM timetable_entries WHERE versionId IS NULL",
  );
  const after = Number(afterRaw);
  console.log(`\n${after} entr${after === 1 ? "y" : "ies"} still without a version.`);
  if (!write) console.log("Nothing written. Re-run with --write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
