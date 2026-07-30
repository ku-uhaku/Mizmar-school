import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The seed's own Prisma client.
 *
 * `lib/db.ts` cannot be used here: it is marked `server-only` and caches its
 * client on globalThis for Next's dev server, neither of which makes sense in a
 * one-shot script.
 */
export const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

export type SeedDb = typeof db;

/** Every seed step takes this, so the orchestrator owns all the ids. */
export type SeedContext = {
  organizationId: string;
  /** Keyed by school code. */
  schools: Record<string, { id: string; code: string; name: string }>;
  /** School id → its years, newest first. */
  years: Record<string, { id: string; name: string; status: string }[]>;
  /** Role name → id. */
  roles: Record<string, string>;
  /** School id → the users who can be given classes there. */
  teachers: Record<string, { id: string; email: string }[]>;
};

export function log(label: string, count: number | string) {
  console.log(`  ${label} ✓ (${count})`);
}
