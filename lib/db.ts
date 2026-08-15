import "server-only";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { auditExtension } from "@/lib/audit";
import { withPoolDefaults } from "@/lib/db-url";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter. One client per process — Next's dev
// server re-evaluates modules on every hot reload, so cache it on globalThis to
// avoid opening a second connection pool each time.
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
  prismaBase: PrismaClient | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Better here than as an obscure connection error on the first request:
    // there is no sensible default for a MySQL server, so a missing URL is a
    // misconfiguration and not something to guess at.
    throw new Error("DATABASE_URL is not set — see .env.example.");
  }

  /*
    Pool settings ride on the URL rather than an options object — see
    lib/db-url.ts for why.

    `connectionLimit` — ten. A school runs one Next process against one MySQL
    server, and Next serves requests concurrently, so the pool is what bounds
    how many statements are in flight. Ten is comfortably above what a page
    render needs (the dashboard is the worst offender, at a few dozen
    sequential queries) and far below the server's own `max_connections`, which
    the seeds, `prisma studio` and any second process also draw on.

    `acquireTimeout` — five seconds before a caller waiting for a free
    connection gives up. Stated because it is load-bearing and a silent default
    is not: exhausting it reaches the secretary as `t.errors.unexpected`, and no
    request in this app holds a connection for anything like five seconds, so it
    means something is genuinely wrong rather than merely busy.

    Both are defaults, not policy — a URL that sets either wins, which is what
    lets a deployment tune the pool without a rebuild.
  */
  const adapter = new PrismaMariaDb(
    withPoolDefaults(url, { connectionLimit: 10, acquireTimeout: 5000 }),
  );

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
 * Opens the first connection, before the server takes a request. Called once
 * from `instrumentation.ts`.
 *
 * The pool connects lazily, so without this the first request of the morning
 * pays for the TCP connect, the handshake and authentication — and, if the
 * server is not up yet, is the one that discovers it. Doing it at boot moves
 * both the latency and the diagnosis to a place where they are legible.
 *
 * Deliberately not fatal. A database that is still starting (a compose stack
 * bringing MySQL up beside the app) should leave the pool to reconnect on the
 * first real request rather than refuse to boot.
 */
export async function warmConnection(): Promise<void> {
  try {
    await auditClient.$queryRawUnsafe("SELECT 1");
  } catch (error) {
    console.warn(
      "Could not reach the database at startup; retrying on first request.",
      error,
    );
  }
}
