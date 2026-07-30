import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter. One client per process — Next's dev
// server re-evaluates modules on every hot reload, so cache it on globalThis to
// avoid opening a new SQLite handle each time.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
