import "server-only";

/**
 * Retrying a generated reference that lost its race.
 *
 * Every generated reference in the app — a receipt number, a pupil's matricule,
 * a dossier familial's code, a staff number — is allocated by reading what has
 * already been issued and adding one. That read and the insert that consumes it
 * are two statements, so two people at the guichet at the same second read the
 * same highest number and ask for the same code. The unique index on the column
 * is what guarantees only one of them gets it; these helpers are what turn the
 * other one's refusal into a second attempt instead of a five-hundred.
 *
 * Retried rather than pre-locked because the collision is rare and a lock on
 * every enrolment is not.
 *
 * Lives in `lib/` rather than in a module because four modules allocate a
 * reference this way — treasury, students, families and hr — and a copy per
 * module is three chances to get the P2002 matching subtly wrong.
 */

/**
 * Whether a write failed on a unique index, optionally on a named column.
 *
 * Matched structurally rather than with `instanceof PrismaClientKnownRequestError`:
 * the extended client in lib/db.ts re-wraps errors, and a failed `instanceof`
 * here would turn a retryable collision into a five-hundred handed to a cashier
 * with a parent standing in front of them.
 *
 * `column` matters because only *some* collisions are worth retrying. Two
 * cashiers reaching for the same receipt number is a race that the next attempt
 * wins; anything else is a request that will fail identically five times over.
 */
export function isDuplicateKey(error: unknown, column?: string): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: unknown }).code !== "P2002"
  ) {
    return false;
  }
  if (!column) return true;

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return JSON.stringify(target ?? "").includes(column);
}

/**
 * Runs a write that allocates a `code`, retrying while it keeps losing the race.
 *
 * The whole allocate-and-write must be inside `run` — retrying only the insert
 * would ask for the same taken number five times over. Narrowed to the `code`
 * column for the same reason: any other unique failure is a request that will
 * fail identically on every attempt, so re-running it only delays the error the
 * caller needs to see.
 */
export async function withCodeRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 4 || !isDuplicateKey(error, "code")) throw error;
    }
  }
}
