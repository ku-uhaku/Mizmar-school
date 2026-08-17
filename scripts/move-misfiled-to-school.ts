import { db } from "@/prisma/seed/client";
import { transferStaff } from "@/modules/hr/service";

/**
 * Moves records filed against the wrong school, by code rather than by id.
 *
 * The staff half goes through `transferStaff`, which is the same function the
 * employee file's own button calls — so the invariants, the matricule and the
 * membership are decided in one place and this script cannot quietly do
 * something the UI would refuse. What it adds is the one thing the UI has no
 * action for: a till. A `CashRegister` is not transferable through the app on
 * purpose (a drawer with posted movements belongs to the school whose ledger
 * they are in), so this refuses one that has ever been used and moves only an
 * empty one — which is what a till created against the wrong school is.
 *
 * Report-only unless `--write`, like `db:carry-marks`.
 *
 *   npm run db:move-misfiled -- --to MIZMAR --till CAS-1 --staff P-2026-0001
 *   npm run db:move-misfiled -- --to MIZMAR --till CAS-1 --write
 *
 * The script name carries `--conditions=react-server`, which is not optional:
 * this reaches a module that starts
 * with `import "server-only"`, whose whole job is to throw outside a server
 * component, and that condition is what resolves it to the package's own empty
 * module. Without it the script dies on the import. The seeds never needed it
 * because they only ever import pure data and their own `seed.ts` files.
 */
async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const argOf = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at === -1 ? null : (process.argv[at + 1] ?? null);
  };

  const toCode = argOf("to");
  if (!toCode) throw new Error("--to <school code> is required");

  const target = await db.school.findFirst({ where: { code: toCode } });
  if (!target) throw new Error(`No school with code ${toCode}`);

  const staffCodes = process.argv
    .map((arg, index) => (arg === "--staff" ? process.argv[index + 1] : null))
    .filter((code): code is string => Boolean(code));
  const tillCodes = process.argv
    .map((arg, index) => (arg === "--till" ? process.argv[index + 1] : null))
    .filter((code): code is string => Boolean(code));

  console.log(`→ ${target.name} (${target.code})${write ? "" : "   [dry run]"}\n`);

  // The till first: somebody holding one in the school they are leaving is a
  // blocker on their own transfer, so moving the drawer is what unblocks them.
  for (const code of tillCodes) {
    const till = await db.cashRegister.findFirst({
      where: { code, schoolId: { not: target.id } },
      include: {
        school: { select: { code: true } },
        // Movements hang off the session, not off the drawer — see
        // CashOperation.cashSessionId — so the count comes through it.
        sessions: {
          select: { _count: { select: { operations: true, payments: true } } },
        },
      },
    });
    if (!till) {
      console.log(`  till ${code}: not found outside ${target.code}`);
      continue;
    }

    // Posted movements are the school's ledger, and a ledger cannot change
    // school. Sessions on their own are fine — an unused drawer opened by
    // mistake has one and it holds nothing.
    const posted = till.sessions.reduce(
      (total, session) =>
        total + session._count.operations + session._count.payments,
      0,
    );
    if (posted > 0) {
      console.log(
        `  till ${code}: refused — ${posted} movements posted in ${till.school.code}`,
      );
      continue;
    }

    const clash = await db.cashRegister.findFirst({
      where: { schoolId: target.id, code },
    });
    if (clash) {
      console.log(`  till ${code}: refused — ${target.code} already has one`);
      continue;
    }

    console.log(
      `  till ${code} "${till.name}": ${till.school.code} → ${target.code}` +
        ` (${till.sessions.length} sessions, no movements)`,
    );
    if (write) {
      await db.cashRegister.update({
        where: { id: till.id },
        data: { schoolId: target.id },
      });
    }
  }

  for (const code of staffCodes) {
    const person = await db.staff.findFirst({
      where: { code, schoolId: { not: target.id } },
      include: { school: { select: { id: true, code: true } } },
    });
    if (!person) {
      console.log(`  staff ${code}: not found outside ${target.code}`);
      continue;
    }

    const who = `${person.firstName} ${person.lastName}`.trim();
    if (!write) {
      console.log(
        `  staff ${code} ${who}: ${person.school.code} → ${target.code} (not written)`,
      );
      continue;
    }

    const result = await transferStaff({
      staffId: person.id,
      fromSchoolId: person.school.id,
      toSchoolId: target.id,
    });

    if (!result.ok) {
      console.log(
        `  staff ${code} ${who}: refused — ` +
          (result.reason === "blocked"
            ? result.blockers.join(", ")
            : result.reason),
      );
      continue;
    }

    console.log(
      `  staff ${code} ${who}: moved as ${result.code}` +
        (result.recoded ? " (matricule reissued)" : "") +
        (result.membershipMoved ? ", membership followed" : ""),
    );
  }

  if (!write) console.log("\nNothing written. Re-run with --write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    /*
      Two clients are open, not one: this script's own (prisma/seed/client) and
      the app's cached singleton, which `modules/hr/service` pulls in through
      lib/db.ts. Only the first has a handle here, so the second holds the event
      loop open and the process never ends on its own.
    */
    process.exit(0);
  });
