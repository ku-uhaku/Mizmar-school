import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { connectionConfig } from "@/lib/db-url";
import { PrismaClient } from "@/lib/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — see .env.example.");

/**
 * The seed's own Prisma client.
 *
 * `lib/db.ts` cannot be used here: it is marked `server-only` and caches its
 * client on globalThis for Next's dev server, neither of which makes sense in a
 * one-shot script.
 */
export const db = new PrismaClient({
  // A smaller pool than the app's: the seed is one sequential script, so
  // anything above a couple of connections is idle sockets on the server. The
  // timeouts match lib/db.ts, for the same reason — a managed database across
  // the internet does not answer inside the driver's one-second default.
  adapter: new PrismaMariaDb(
    connectionConfig(url, {
      connectionLimit: 5,
      acquireTimeout: 15000,
      connectTimeout: 10000,
    }),
  ),
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
