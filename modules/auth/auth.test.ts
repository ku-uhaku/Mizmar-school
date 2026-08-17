import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * The sign-in path.
 *
 * `checkCredentials` is the one funnel all three ways in go through — the web
 * login action, Auth.js's own credentials callback, and the native app's
 * `/api/mobile/v1/auth/login` — so everything the login has to promise is
 * promised here or nowhere:
 *
 *   * a wrong username and a wrong password are indistinguishable to the caller,
 *   * a locked username costs no bcrypt work,
 *   * the counter is keyed on the *normalised* username, so varying the casing
 *     is not a way around it.
 *
 * The database is faked rather than mocked call-by-call: the throttle's whole
 * behaviour is a state machine over one row, and asserting on `upsert` argument
 * shapes would pin the implementation instead of the rule.
 */

// ── An in-memory stand-in for the two tables this path touches ───────────────

type AttemptRow = {
  identifier: string;
  failedCount: number;
  lastFailedAt: Date | null;
  lockedUntil: Date | null;
};

type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
};

const attempts = new Map<string, AttemptRow>();
const users = new Map<string, UserRow>();

const fakeDb = {
  loginAttempt: {
    findUnique: async ({ where }: { where: { identifier: string } }) =>
      attempts.get(where.identifier) ?? null,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { identifier: string };
      create: AttemptRow;
      update: Partial<AttemptRow>;
    }) => {
      const existing = attempts.get(where.identifier);
      attempts.set(
        where.identifier,
        existing ? { ...existing, ...update } : { ...create },
      );
      return attempts.get(where.identifier);
    },
    deleteMany: async ({ where }: { where: { identifier: string } }) => {
      attempts.delete(where.identifier);
      return { count: 1 };
    },
  },
  user: {
    findUnique: async ({ where }: { where: { username: string } }) =>
      users.get(where.username) ?? null,
  },
};

vi.mock("@/lib/db", () => ({ db: fakeDb, auditClient: fakeDb }));
vi.mock("@/lib/audit", () => ({ recordEvent: vi.fn(async () => {}) }));

const {
  checkLoginThrottle,
  recordFailedLogin,
  clearLoginAttempts,
  MAX_FAILED_ATTEMPTS,
} = await import("@/lib/login-throttle");
const { checkCredentials, hashPassword } = await import("@/lib/auth");

const MINUTE = 60 * 1000;

/** Drives the throttle the way a caller does: check, and only then record. */
async function attemptLogin(username: string): Promise<"tried" | "blocked"> {
  const verdict = await checkLoginThrottle(username);
  if (verdict.locked) return "blocked";
  await recordFailedLogin(username);
  return "tried";
}

beforeEach(() => {
  attempts.clear();
  users.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── The throttle ─────────────────────────────────────────────────────────────

describe("login throttle", () => {
  it("lets an unknown username through", async () => {
    expect(await checkLoginThrottle("nobody@school.ma")).toEqual({
      locked: false,
    });
  });

  it("locks on the fifth consecutive failure, not the fourth", async () => {
    const username = "a.bursar";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(username);
      expect(await checkLoginThrottle(username)).toEqual({ locked: false });
    }

    await recordFailedLogin(username);
    const verdict = await checkLoginThrottle(username);
    expect(verdict.locked).toBe(true);
  });

  it("rounds the wait up, so nobody is told to wait zero minutes", async () => {
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);

    // 100ms into a one-minute lock: 59.9s remaining must not round to 59.
    vi.advanceTimersByTime(100);
    const verdict = await checkLoginThrottle(username);
    expect(verdict.locked && verdict.retryAfterSeconds).toBe(60);
  });

  it("clears itself once the lock has run out", async () => {
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);
    expect((await checkLoginThrottle(username)).locked).toBe(true);

    vi.advanceTimersByTime(1 * MINUTE + 1);
    expect(await checkLoginThrottle(username)).toEqual({ locked: false });
  });

  it("forgets a stale run, so two typos in March and three in June do not add up", async () => {
    const username = "a.bursar";
    await recordFailedLogin(username);
    await recordFailedLogin(username);

    // Past the 15-minute window that makes a run "consecutive".
    vi.advanceTimersByTime(16 * MINUTE);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(username);
    }
    // Four in the new run: the two old ones must not have counted.
    expect(await checkLoginThrottle(username)).toEqual({ locked: false });

    await recordFailedLogin(username);
    expect((await checkLoginThrottle(username)).locked).toBe(true);
  });

  it("escalates the second lock beyond the first", async () => {
    const username = "a.bursar";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);
    const first = await checkLoginThrottle(username);
    expect(first.locked && first.retryAfterSeconds).toBe(60);

    vi.advanceTimersByTime(1 * MINUTE + 1);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);
    const second = await checkLoginThrottle(username);
    expect(second.locked && second.retryAfterSeconds).toBe(5 * 60);
  });

  it("keeps counting through a lock rather than resetting on the way out", async () => {
    // A grind that waits out its lock and carries on must escalate, not start
    // over — that is what `stillLocked` is for in recordFailedLogin.
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);

    // One more while still inside the lock.
    await recordFailedLogin(username);
    vi.advanceTimersByTime(1 * MINUTE + 1);

    // Four more reaches ten, which is the second lock.
    for (let i = 0; i < 4; i++) await recordFailedLogin(username);
    const verdict = await checkLoginThrottle(username);
    expect(verdict.locked && verdict.retryAfterSeconds).toBe(5 * 60);
  });

  it("a correct password forgets the run entirely", async () => {
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(username);
    }
    await clearLoginAttempts(username);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(username);
    }
    expect(await checkLoginThrottle(username)).toEqual({ locked: false });
  });

  it("counts usernames that match no user, so the lockout does not answer 'does this person work here?'", async () => {
    const username = "nobody.here";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);
    expect((await checkLoginThrottle(username)).locked).toBe(true);
  });

  it("never locks permanently: every lock has a finite wait", async () => {
    const username = "a.bursar";
    for (let round = 0; round < 8; round++) {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        await attemptLogin(username);
      }
      const verdict = await checkLoginThrottle(username);
      if (verdict.locked) {
        expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
        expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60 * 60);
        vi.advanceTimersByTime(verdict.retryAfterSeconds * 1000 + 1);
      }
    }
    expect((await checkLoginThrottle(username)).locked).toBe(false);
  });

  it("escalates all the way to the longest lock the ladder declares", async () => {
    // A patient attacker waits out each lock and keeps going. The ladder tops
    // out at an hour, and the run must actually reach it: an attacker whose
    // counter resets on the way is one the ladder never slows down.
    const username = "a.bursar";
    const waits: number[] = [];

    for (let round = 0; round < 4; round++) {
      let guard = 0;
      // Fail until this round produces a lock.
      while (!(await checkLoginThrottle(username)).locked && guard++ < 50) {
        await recordFailedLogin(username);
      }
      const verdict = await checkLoginThrottle(username);
      if (!verdict.locked) break;
      waits.push(verdict.retryAfterSeconds);
      vi.advanceTimersByTime(verdict.retryAfterSeconds * 1000 + 1);
    }

    expect(waits).toEqual([60, 5 * 60, 15 * 60, 60 * 60]);
  });
});

// ── Credentials ──────────────────────────────────────────────────────────────

describe("checkCredentials", () => {
  const PASSWORD = "correct-horse-battery";
  let hash: string;

  beforeEach(async () => {
    vi.useRealTimers();
    hash ??= await hashPassword(PASSWORD);
    users.set("a.bursar", {
      id: "user-1",
      username: "a.bursar",
      passwordHash: hash,
      isActive: true,
    });
  });

  it("accepts the right password", async () => {
    const result = await checkCredentials("a.bursar", PASSWORD);
    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  it("gives an unknown username and a wrong password the same answer", async () => {
    const unknown = await checkCredentials("a.ghost", "whatever");
    const wrong = await checkCredentials("a.bursar", "whatever");

    expect(unknown).toEqual({ ok: false, reason: "invalid" });
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
  });

  it("does the bcrypt work even for a username with no account", async () => {
    // Skipping the compare would make "unknown username" measurably faster and
    // turn the login form into an employee directory. DUMMY_HASH is what keeps
    // the two paths comparable; this pins that the compare still happens.
    const started = performance.now();
    await checkCredentials("a.ghost", "whatever");
    const elapsed = performance.now() - started;
    // A skipped bcrypt(12) compare would come back in single-digit ms.
    expect(elapsed).toBeGreaterThan(20);
  });

  it("normalises the username, so casing and padding are not a way around the counter", async () => {
    for (const spelling of [
      "  a.bursar  ",
      "A.BURSAR",
      "A.Bursar",
    ]) {
      const result = await checkCredentials(spelling, PASSWORD);
      expect(result, spelling).toEqual({ ok: true, userId: "user-1" });
    }
  });

  it("counts a failure once per attempt, however the username was spelled", async () => {
    await checkCredentials("A.bursar", "wrong");
    await checkCredentials("  a.BURSAR ", "wrong");
    await checkCredentials("A.Bursar", "wrong");

    expect(attempts.get("a.bursar")?.failedCount).toBe(3);
    expect(attempts.size).toBe(1);
  });

  it("refuses a deactivated account even with the right password", async () => {
    users.set("a.bursar", {
      id: "user-1",
      username: "a.bursar",
      passwordHash: hash,
      isActive: false,
    });

    expect(await checkCredentials("a.bursar", PASSWORD)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("distinguishes a deactivated account from a wrong password only when the password was right", async () => {
    // Otherwise "deactivated" would confirm a username exists to anyone typing
    // a guess at it.
    users.set("a.bursar", {
      id: "user-1",
      username: "a.bursar",
      passwordHash: hash,
      isActive: false,
    });

    expect(await checkCredentials("a.bursar", "wrong")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("clears the counter for a deactivated account that got the password right", async () => {
    users.set("a.bursar", {
      id: "user-1",
      username: "a.bursar",
      passwordHash: hash,
      isActive: false,
    });
    await checkCredentials("a.bursar", "wrong");
    expect(attempts.has("a.bursar")).toBe(true);

    await checkCredentials("a.bursar", PASSWORD);
    expect(attempts.has("a.bursar")).toBe(false);
  });

  it("refuses a locked username before touching the hash", async () => {
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);

    const started = performance.now();
    const result = await checkCredentials(username, PASSWORD);
    const elapsed = performance.now() - started;

    expect(result).toMatchObject({ ok: false, reason: "throttled" });
    // No bcrypt work: a locked username must not be a way to burn the CPU.
    expect(elapsed).toBeLessThan(20);
  });

  it("keeps the right password from being spent while the username is locked", async () => {
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);

    const result = await checkCredentials(username, PASSWORD);
    expect(result.ok).toBe(false);
    // Still locked afterwards — a correct password does not lift the lock.
    expect((await checkLoginThrottle(username)).locked).toBe(true);
  });

  it("does not count a blocked attempt again, so a lock cannot be extended by hammering it", async () => {
    const username = "a.bursar";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(username);
    const before = attempts.get(username)?.failedCount;

    for (let i = 0; i < 20; i++) await checkCredentials(username, "wrong");

    expect(attempts.get(username)?.failedCount).toBe(before);
  });

  it("rejects an empty password against a real account", async () => {
    expect(await checkCredentials("a.bursar", "")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
