/**
 * Pool defaults for the MySQL connection string.
 *
 * The MariaDB adapter takes *either* a connection string or a full `PoolConfig`
 * object, and the object form has no field for a URL. Rather than parse
 * DATABASE_URL into host, port, user, password and database — and so have two
 * places deciding what a connection string means — the pool settings are
 * appended to the URL as query parameters, which the driver reads. The object
 * form is built only for the one setting a URL cannot carry — a CA certificate,
 * see `connectionConfig` — and is built from the same URL, so there is still one
 * place that decides what a connection string means.
 *
 * Pure data: no `server-only`, no Prisma. The app (lib/db.ts) and the seeds
 * (prisma/seed/client.ts) both go through it, so a deployment that tunes its
 * pool tunes both.
 */

/**
 * The driver's options, as far as this file states them.
 *
 * Deliberately not `mariadb.PoolConfig`: the adapter bundles its own copy of the
 * driver, and the two declarations of that type do not structurally agree, so
 * importing it here is a type error at the call site rather than a guarantee.
 * The remaining pool settings ride along untyped — they came off the URL as
 * strings and the driver coerces them itself.
 */
export type ConnectionOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: { ca: string };
};

/**
 * Adds pool settings to a MySQL URL, leaving any the URL already states alone.
 *
 * A URL that sets `connectionLimit` wins, which is what lets a deployment tune
 * the pool without a rebuild — and what lets the seeds ask for a smaller one.
 */
function withPoolDefaults(
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

/** Pool settings the driver wants as numbers; a URL only ever gives strings. */
const NUMERIC_OPTIONS = new Set([
  "acquireTimeout",
  "connectTimeout",
  "connectionLimit",
  "idleTimeout",
  "initializationTimeout",
  "leakDetectionTimeout",
  "maxAllowedPacket",
  "maxIdle",
  "minimumIdle",
  "port",
  "queryTimeout",
  "socketTimeout",
]);

/**
 * What the MariaDB adapter is handed: the URL, or — when the server presents a
 * certificate signed by a private authority — an options object carrying it.
 *
 * A managed MySQL (Aiven, PlanetScale's self-hosted tier, anything behind a
 * corporate CA) signs its certificate with a root that is not in Node's trust
 * store, so a verified TLS handshake needs that root supplied. The driver takes
 * it only as an object, and there is no query parameter for a PEM, so the URL
 * form is kept for the ordinary case and the object built only when
 * `DATABASE_SSL_CA` is set. Its value is the CA certificate, either as the PEM
 * itself or base64-encoded — the latter because most deployment consoles, and
 * Vercel's in particular, mangle a multi-line value.
 *
 * Turning verification off instead would be a line shorter and would leave the
 * connection open to anyone who can answer for the host, which is precisely
 * what the certificate is there to prevent.
 */
export function connectionConfig(
  url: string,
  defaults: Record<string, string | number>,
): string | ConnectionOptions {
  const withDefaults = withPoolDefaults(url, defaults);
  const ca = readCaCertificate();
  if (!ca) return withDefaults;

  const parsed = new URL(withDefaults);
  const options: Record<string, unknown> = {};
  for (const [key, value] of parsed.searchParams) {
    options[key] = NUMERIC_OPTIONS.has(key) ? Number(value) : value;
  }

  // Cast: the pool options carried on the URL are strings the driver coerces
  // itself, so they cannot be typed one by one without restating its whole
  // option list here.
  return {
    ...options,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    ssl: { ca },
  } as ConnectionOptions;
}

function readCaCertificate(): string | undefined {
  const raw = process.env.DATABASE_SSL_CA?.trim();
  if (!raw) return undefined;
  if (raw.includes("BEGIN CERTIFICATE")) return raw;
  return Buffer.from(raw, "base64").toString("utf8");
}
