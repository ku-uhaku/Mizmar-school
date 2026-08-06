import { db } from "@/prisma/seed/client";

/**
 * What the seeded database actually looks like — `tsx prisma/seed/check-seeded.ts`.
 *
 * The dry run in `check-roster.ts` proves the generator; this proves what
 * reached the tables, which is not the same claim: an upsert keyed on the wrong
 * column would collapse two pupils into one and the generator would still be
 * innocent.
 */
async function main() {
  const classes = await db.schoolClass.findMany({
    select: {
      code: true,
      capacity: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { code: "asc" },
  });

  const capacities = new Set(classes.map((row) => row.capacity));
  const sizes = classes.map((row) => row._count.enrollments);

  console.log(`classes            ${classes.length}`);
  console.log(`capacities in use  ${[...capacities].join(", ")}`);
  console.log(
    `pupils per class   min ${Math.min(...sizes)} · max ${Math.max(...sizes)}`,
  );
  const over = classes.filter(
    (row) => row.capacity !== null && row._count.enrollments > row.capacity,
  );
  console.log(`over capacity      ${over.length}`);

  // Everybody the school records by name, in one list: a pupil and their own
  // father sharing a full name is as wrong as two pupils doing so.
  const [students, guardians, staff, profiles] = await Promise.all([
    db.student.findMany({ select: { firstName: true, lastName: true } }),
    db.guardian.findMany({ select: { firstName: true, lastName: true } }),
    db.staff.findMany({ select: { firstName: true, lastName: true } }),
    db.profile.findMany({ select: { firstName: true, lastName: true } }),
  ]);

  const groups = [
    ["pupil", students],
    ["guardian", guardians],
    ["staff", staff],
    ["account", profiles],
  ] as const;

  const seen = new Map<string, string>();
  const clashes: string[] = [];

  for (const [kind, rows] of groups) {
    for (const row of rows) {
      const name = `${row.firstName} ${row.lastName}`.trim();
      const key = name.toLowerCase();
      const first = seen.get(key);
      /*
        An `account` matching a `staff` or a `guardian` is one person under two
        rows, not a duplicate: the profile is built from the employment record
        (modules/hr/seed.ts) or from the guardian (modules/portal/seed.ts:195)
        when a mobile login is opened. Everything else — two pupils, a pupil and
        a teacher, a father and his son — is a real clash.
      */
      const sameHuman =
        kind === "account" && (first === "staff" || first === "guardian");

      if (first && !sameHuman) {
        clashes.push(`${name} — ${first} and ${kind}`);
      } else if (!first) {
        seen.set(key, kind);
      }
    }
  }

  const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
  console.log(`\npeople named       ${total}`);
  console.log(`distinct names     ${seen.size}`);
  console.log(`clashes            ${clashes.length}`);
  for (const clash of clashes.slice(0, 20)) console.log(`  ${clash}`);
}

void main().finally(() => db.$disconnect());
