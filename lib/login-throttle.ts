import "server-only";

import { db } from "@/lib/db";

/**
 * Brute-force protection for the sign-in form.
 *
 * ── Why this is in `lib/` ────────────────────────────────────────────────────
 * It has to wrap `checkCredentials`, and `checkCredentials` is reached by two
 * separate paths: the login Server Function, and Auth.js's own
 * `/api/auth/callback/credentials`. Guarding only the action would leave the
 * second one wide open, so the throttle lives beside `lib/auth.ts` and is
 * applied inside the credential check itself — the same reasoning that puts
 * authorization in the action rather than on the page.
 *
 * ── The shape of the defence ────────────────────────────────────────────────
 * Counted per username, not per IP. A school shares one connection: half the
 * staff room sits behind a single address, so locking by IP would take the whole
 * office out because one person forgot which password they used. Counting per
 * username means an attacker grinding one account only ever locks that account,
 * which is the loss we are willing to accept.
 *
 * Usernames that match no user are counted too. If only real accounts were
 * throttled, the slowdown itself would answer "does this person work here?" —
 * the same enumeration leak `DUMMY_HASH` exists to close on the timing side.
 *
 * Lockouts escalate rather than being fixed, so an honest mistype costs a
 * minute and a sustained grind costs an hour. They are never permanent: a
 * locked-out bursar at 8am on a Monday must not need an administrator.
 */

/** Failures on one username before it is locked. */
export const MAX_FAILED_ATTEMPTS = 5;

/**
 * How long a run of failures stays "consecutive". Two wrong passwords in March
 * and three in June are not an attack, and should not add up to one.
 */
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Lock durations, stepped through as a username keeps failing after it has
 * already been locked once. The last entry repeats for good.
 */
const LOCK_DURATIONS_MS = [
  1 * 60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
] as const;

export type ThrottleVerdict =
  | { locked: false }
  | { locked: true; retryAfterSeconds: number };

/** How long the caller must wait, given how many times it has been locked. */
function lockDurationFor(failedCount: number): number {
  // 5 failures is the first lock, 10 the second, and so on.
  const step = Math.floor(failedCount / MAX_FAILED_ATTEMPTS) - 1;
  const index = Math.min(Math.max(step, 0), LOCK_DURATIONS_MS.length - 1);
  return LOCK_DURATIONS_MS[index];
}

/**
 * Whether this username may attempt a password right now.
 *
 * Called before the hash is compared, so a locked username costs no bcrypt work
 * — which is also what stops the throttle being turned into a way to burn the
 * server's CPU.
 */
export async function checkLoginThrottle(
  identifier: string,
): Promise<ThrottleVerdict> {
  const row = await db.loginAttempt.findUnique({
    where: { identifier },
    select: { lockedUntil: true },
  });

  if (!row?.lockedUntil) return { locked: false };

  const remainingMs = row.lockedUntil.getTime() - Date.now();
  if (remainingMs <= 0) return { locked: false };

  return {
    locked: true,
    // Rounded up: telling somebody to wait "0 minutes" is worse than useless.
    retryAfterSeconds: Math.ceil(remainingMs / 1000),
  };
}

/** Records one failed attempt, locking the username once it crosses the line. */
export async function recordFailedLogin(identifier: string): Promise<void> {
  const now = new Date();

  const existing = await db.loginAttempt.findUnique({
    where: { identifier },
    select: { failedCount: true, lastFailedAt: true, lockedUntil: true },
  });

  // A stale run starts over, so an honest user is never a couple of typos away
  // from a lockout months later. A run that has been locked keeps counting, so
  // waiting out a lock and carrying on escalates rather than resets.
  //
  // The window is measured from whichever came later: the last failure, or the
  // moment the lock lifted. Measuring from the failure alone silently capped
  // the ladder — no failure is recorded *during* a lock, so `lastFailedAt`
  // froze when the lock started, and a lock at least as long as the window
  // (the 15-minute rung) guaranteed the next failure looked stale and reset the
  // count to one. The hour-long rung was therefore unreachable, and a patient
  // grind cycled 1 → 5 → 15 → 1 minutes for ever instead of degrading.
  const lastFailedAt = existing?.lastFailedAt ?? null;
  const previousLock = existing?.lockedUntil ?? null;
  const runContinuesFrom =
    lastFailedAt && previousLock
      ? new Date(Math.max(lastFailedAt.getTime(), previousLock.getTime()))
      : (previousLock ?? lastFailedAt);

  // Negative while a lock is still running, which is the "still locked" case.
  const withinWindow =
    runContinuesFrom !== null &&
    now.getTime() - runContinuesFrom.getTime() < ATTEMPT_WINDOW_MS;

  const failedCount = existing && withinWindow ? existing.failedCount + 1 : 1;

  const lockedUntil =
    failedCount >= MAX_FAILED_ATTEMPTS && failedCount % MAX_FAILED_ATTEMPTS === 0
      ? new Date(now.getTime() + lockDurationFor(failedCount))
      : (existing?.lockedUntil ?? null);

  await db.loginAttempt.upsert({
    where: { identifier },
    create: { identifier, failedCount, lastFailedAt: now, lockedUntil },
    update: { failedCount, lastFailedAt: now, lockedUntil },
  });
}

/**
 * Forgets a username's failures. Called on a correct password — including for
 * a deactivated account, because knowing the password proves this is not the
 * grind the counter is here to stop.
 */
export async function clearLoginAttempts(identifier: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { identifier } });
}
