/**
 * Pool defaults for the MySQL connection string.
 *
 * The MariaDB adapter takes *either* a connection string or a full `PoolConfig`
 * object, and the object form has no field for a URL. Rather than parse
 * DATABASE_URL into host, port, user, password and database — and so have two
 * places deciding what a connection string means — the pool settings are
 * appended to the URL as query parameters, which the driver reads.
 *
 * Pure data: no `server-only`, no Prisma. The app (lib/db.ts) and the seeds
 * (prisma/seed/client.ts) both go through it, so a deployment that tunes its
 * pool tunes both.
 */

/**
 * Adds pool settings to a MySQL URL, leaving any the URL already states alone.
 *
 * A URL that sets `connectionLimit` wins, which is what lets a deployment tune
 * the pool without a rebuild — and what lets the seeds ask for a smaller one.
 */
export function withPoolDefaults(
  url: string,
  defaults: Record<string, string | number>,
): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(defaults)) {
    if (!parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}
