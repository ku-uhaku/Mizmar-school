import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { auditExtension } from "@/lib/audit";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter. One client per process — Next's dev
// server re-evaluates modules on every hot reload, so cache it on globalThis to
// avoid opening a new SQLite handle each time.
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
  prismaBase: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    // Relative paths resolve against the process cwd (the project root), which
    // is where `prisma migrate` also puts the file.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    /*
      Five seconds before a blocked writer gives up, rather than better-sqlite3's
      own default of the same — stated because it is load-bearing here and a
      silent default is not. Two writers do still contend under WAL (see
      `ensureWalMode`), and without a busy timeout the loser gets SQLITE_BUSY
      instantly, which reaches the secretary as `t.errors.unexpected`. No
      transaction in this app runs for anything like five seconds, so exhausting
      it means something is genuinely wrong rather than merely busy.
    */
    timeout: 5000,
  });

  return new PrismaClient({
    adapter,
    /*
      `PRISMA_LOG_QUERIES=1 npm run dev` prints every statement.

      Off by default and never on in production, because it prints one line per
      query and the dashboard alone issues fifty. It exists because the only
      honest way to find an N+1 in this app is to count the statements one page
      render actually makes — reading the code finds the loops you thought of,
      and a nested `select` that Prisma quietly fans out into a chunked `IN` is
      exactly the one you did not.
    */
    log:
      process.env.NODE_ENV === "development"
        ? process.env.PRISMA_LOG_QUERIES === "1"
          ? ["query", "warn", "error"]
          : ["warn", "error"]
        : ["error"],
  });
}

/**
 * The client without the audit extension.
 *
 * Two things need it, and nothing else should: the trail writes its own entries
 * through it (an entry about an entry is not wanted), and it reads the "before"
 * state of a row through it (a read that must not itself be observed). Exported
 * only so `lib/audit.ts` can reach it from `recordEvent` — see that file.
 */
export const auditClient: PrismaClient =
  globalForPrisma.prismaBase ?? createClient();

type ExtendedClient = ReturnType<typeof extend>;

function extend(client: PrismaClient) {
  return client.$extends(auditExtension(client));
}

/**
 * The application's client.
 *
 * Every write made through it is recorded in `activity_logs` — see lib/audit.ts
 * for how, and for the four cases it cannot see. Reads are untouched.
 */
export const db: ExtendedClient = globalForPrisma.prisma ?? extend(auditClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = auditClient;
  globalForPrisma.prisma = db;
}

/**
 * Puts the database file into WAL mode. Called once from `instrumentation.ts`.
 *
 * ── Why a school needs it ────────────────────────────────────────────────────
 * SQLite's default journal is a rollback journal, under which a writer takes a
 * lock every reader has to wait behind. With one person on the app that is
 * invisible; with a school on it, it is the wrong shape entirely. The caisse
 * posts a receipt and, for the length of that transaction, the secretary's pupil
 * list, the director's dashboard and every phone on the parents' app stop. An
 * import or a bulletin run holds the same lock for very much longer.
 *
 * Under WAL a reader carries on against the last committed snapshot while a
 * write is in flight, which is exactly this app's access pattern: many readers,
 * few writers, one process.
 *
 * ── Why it is a statement and not an option ──────────────────────────────────
 * The adapter takes better-sqlite3's `Options`, which has no pragma passthrough,
 * so the mode has to be set on a live connection. That is not a hardship:
 * `journal_mode` is a *persistent* property of the database file, so this runs
 * once at boot and the setting survives every later connection — including
 * `prisma studio` and the seeds. Running it again on a file already in WAL is a
 * no-op, which is what makes it safe on every start.
 *
 * Deliberately not fatal. A read-only volume or a filesystem that cannot do WAL
 * (some network mounts) should leave the school with a working app on the slower
 * journal, not a server that refuses to boot.
 */
export async function ensureWalMode(): Promise<void> {
  try {
    await auditClient.$executeRawUnsafe("PRAGMA journal_mode = WAL;");
  } catch (error) {
    console.warn(
      "Could not enable SQLite WAL mode; continuing on the rollback journal.",
      error,
    );
  }
}
