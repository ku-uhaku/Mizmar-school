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
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
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
