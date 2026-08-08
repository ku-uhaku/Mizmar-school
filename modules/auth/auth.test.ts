import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * The sign-in path.
 *
 * `checkCredentials` is the one funnel all three ways in go through — the web
 * login action, Auth.js's own credentials callback, and the native app's
 * `/api/mobile/v1/auth/login` — so everything the login has to promise is
 * promised here or nowhere:
 *
 *   * a wrong address and a wrong password are indistinguishable to the caller,
 *   * a locked address costs no bcrypt work,
 *   * the counter is keyed on the *normalised* address, so varying the casing
 *     is not a way around it.
 *
 * The database is faked rather than mocked call-by-call: the throttle's whole
 * behaviour is a state machine over one row, and asserting on `upsert` argument
 * shapes would pin the implementation instead of the rule.
 */

// ── An in-memory stand-in for the two tables this path touches ───────────────

type AttemptRow = {
  email: string;
  failedCount: number;
  lastFailedAt: Date | null;
  lockedUntil: Date | null;
};

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
};

const attempts = new Map<string, AttemptRow>();
const users = new Map<string, UserRow>();

const fakeDb = {
  loginAttempt: {
    findUnique: async ({ where }: { where: { email: string } }) =>
      attempts.get(where.email) ?? null,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { email: string };
      create: AttemptRow;
      update: Partial<AttemptRow>;
    }) => {
      const existing = attempts.get(where.email);
      attempts.set(
        where.email,
        existing ? { ...existing, ...update } : { ...create },
      );
      return attempts.get(where.email);
    },
    deleteMany: async ({ where }: { where: { email: string } }) => {
      attempts.delete(where.email);
      return { count: 1 };
    },
  },
  user: {
    findUnique: async ({ where }: { where: { email: string } }) =>
      users.get(where.email) ?? null,
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
async function attemptLogin(email: string): Promise<"tried" | "blocked"> {
  const verdict = await checkLoginThrottle(email);
  if (verdict.locked) return "blocked";
  await recordFailedLogin(email);
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
  it("lets an unknown address through", async () => {
    expect(await checkLoginThrottle("nobody@school.ma")).toEqual({
      locked: false,
    });
  });

  it("locks on the fifth consecutive failure, not the fourth", async () => {
    const email = "bursar@school.ma";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(email);
      expect(await checkLoginThrottle(email)).toEqual({ locked: false });
    }

    await recordFailedLogin(email);
    const verdict = await checkLoginThrottle(email);
    expect(verdict.locked).toBe(true);
  });

  it("rounds the wait up, so nobody is told to wait zero minutes", async () => {
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);

    // 100ms into a one-minute lock: 59.9s remaining must not round to 59.
    vi.advanceTimersByTime(100);
    const verdict = await checkLoginThrottle(email);
    expect(verdict.locked && verdict.retryAfterSeconds).toBe(60);
  });

  it("clears itself once the lock has run out", async () => {
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);
    expect((await checkLoginThrottle(email)).locked).toBe(true);

    vi.advanceTimersByTime(1 * MINUTE + 1);
    expect(await checkLoginThrottle(email)).toEqual({ locked: false });
  });

  it("forgets a stale run, so two typos in March and three in June do not add up", async () => {
    const email = "bursar@school.ma";
    await recordFailedLogin(email);
    await recordFailedLogin(email);

    // Past the 15-minute window that makes a run "consecutive".
    vi.advanceTimersByTime(16 * MINUTE);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(email);
    }
    // Four in the new run: the two old ones must not have counted.
    expect(await checkLoginThrottle(email)).toEqual({ locked: false });

    await recordFailedLogin(email);
    expect((await checkLoginThrottle(email)).locked).toBe(true);
  });

  it("escalates the second lock beyond the first", async () => {
    const email = "bursar@school.ma";

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);
    const first = await checkLoginThrottle(email);
    expect(first.locked && first.retryAfterSeconds).toBe(60);

    vi.advanceTimersByTime(1 * MINUTE + 1);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);
    const second = await checkLoginThrottle(email);
    expect(second.locked && second.retryAfterSeconds).toBe(5 * 60);
  });

  it("keeps counting through a lock rather than resetting on the way out", async () => {
    // A grind that waits out its lock and carries on must escalate, not start
    // over — that is what `stillLocked` is for in recordFailedLogin.
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);

    // One more while still inside the lock.
    await recordFailedLogin(email);
    vi.advanceTimersByTime(1 * MINUTE + 1);

    // Four more reaches ten, which is the second lock.
    for (let i = 0; i < 4; i++) await recordFailedLogin(email);
    const verdict = await checkLoginThrottle(email);
    expect(verdict.locked && verdict.retryAfterSeconds).toBe(5 * 60);
  });

  it("a correct password forgets the run entirely", async () => {
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(email);
    }
    await clearLoginAttempts(email);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailedLogin(email);
    }
    expect(await checkLoginThrottle(email)).toEqual({ locked: false });
  });

  it("counts addresses that match no user, so the lockout does not answer 'does this person work here?'", async () => {
    const email = "not-a-real-address@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);
    expect((await checkLoginThrottle(email)).locked).toBe(true);
  });

  it("never locks permanently: every lock has a finite wait", async () => {
    const email = "bursar@school.ma";
    for (let round = 0; round < 8; round++) {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        await attemptLogin(email);
      }
      const verdict = await checkLoginThrottle(email);
      if (verdict.locked) {
        expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
        expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60 * 60);
        vi.advanceTimersByTime(verdict.retryAfterSeconds * 1000 + 1);
      }
    }
    expect((await checkLoginThrottle(email)).locked).toBe(false);
  });

  it("escalates all the way to the longest lock the ladder declares", async () => {
    // A patient attacker waits out each lock and keeps going. The ladder tops
    // out at an hour, and the run must actually reach it: an attacker whose
    // counter resets on the way is one the ladder never slows down.
    const email = "bursar@school.ma";
    const waits: number[] = [];

    for (let round = 0; round < 4; round++) {
      let guard = 0;
      // Fail until this round produces a lock.
      while (!(await checkLoginThrottle(email)).locked && guard++ < 50) {
        await recordFailedLogin(email);
      }
      const verdict = await checkLoginThrottle(email);
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
    users.set("bursar@school.ma", {
      id: "user-1",
      email: "bursar@school.ma",
      passwordHash: hash,
      isActive: true,
    });
  });

  it("accepts the right password", async () => {
    const result = await checkCredentials("bursar@school.ma", PASSWORD);
    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  it("gives an unknown address and a wrong password the same answer", async () => {
    const unknown = await checkCredentials("ghost@school.ma", "whatever");
    const wrong = await checkCredentials("bursar@school.ma", "whatever");

    expect(unknown).toEqual({ ok: false, reason: "invalid" });
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
  });

  it("does the bcrypt work even for an address with no account", async () => {
    // Skipping the compare would make "unknown address" measurably faster and
    // turn the login form into an employee directory. DUMMY_HASH is what keeps
    // the two paths comparable; this pins that the compare still happens.
    const started = performance.now();
    await checkCredentials("ghost@school.ma", "whatever");
    const elapsed = performance.now() - started;
    // A skipped bcrypt(12) compare would come back in single-digit ms.
    expect(elapsed).toBeGreaterThan(20);
  });

  it("normalises the address, so casing and padding are not a way around the counter", async () => {
    for (const spelling of [
      "  bursar@school.ma  ",
      "BURSAR@SCHOOL.MA",
      "Bursar@School.Ma",
    ]) {
      const result = await checkCredentials(spelling, PASSWORD);
      expect(result, spelling).toEqual({ ok: true, userId: "user-1" });
    }
  });

  it("counts a failure once per attempt, however the address was spelled", async () => {
    await checkCredentials("BURSAR@school.ma", "wrong");
    await checkCredentials("  bursar@SCHOOL.ma ", "wrong");
    await checkCredentials("Bursar@School.Ma", "wrong");

    expect(attempts.get("bursar@school.ma")?.failedCount).toBe(3);
    expect(attempts.size).toBe(1);
  });

  it("refuses a deactivated account even with the right password", async () => {
    users.set("bursar@school.ma", {
      id: "user-1",
      email: "bursar@school.ma",
      passwordHash: hash,
      isActive: false,
    });

    expect(await checkCredentials("bursar@school.ma", PASSWORD)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("distinguishes a deactivated account from a wrong password only when the password was right", async () => {
    // Otherwise "deactivated" would confirm an address exists to anyone typing
    // a guess at it.
    users.set("bursar@school.ma", {
      id: "user-1",
      email: "bursar@school.ma",
      passwordHash: hash,
      isActive: false,
    });

    expect(await checkCredentials("bursar@school.ma", "wrong")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("clears the counter for a deactivated account that got the password right", async () => {
    users.set("bursar@school.ma", {
      id: "user-1",
      email: "bursar@school.ma",
      passwordHash: hash,
      isActive: false,
    });
    await checkCredentials("bursar@school.ma", "wrong");
    expect(attempts.has("bursar@school.ma")).toBe(true);

    await checkCredentials("bursar@school.ma", PASSWORD);
    expect(attempts.has("bursar@school.ma")).toBe(false);
  });

  it("refuses a locked address before touching the hash", async () => {
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);

    const started = performance.now();
    const result = await checkCredentials(email, PASSWORD);
    const elapsed = performance.now() - started;

    expect(result).toMatchObject({ ok: false, reason: "throttled" });
    // No bcrypt work: a locked address must not be a way to burn the CPU.
    expect(elapsed).toBeLessThan(20);
  });

  it("keeps the right password from being spent while the address is locked", async () => {
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);

    const result = await checkCredentials(email, PASSWORD);
    expect(result.ok).toBe(false);
    // Still locked afterwards — a correct password does not lift the lock.
    expect((await checkLoginThrottle(email)).locked).toBe(true);
  });

  it("does not count a blocked attempt again, so a lock cannot be extended by hammering it", async () => {
    const email = "bursar@school.ma";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await recordFailedLogin(email);
    const before = attempts.get(email)?.failedCount;

    for (let i = 0; i < 20; i++) await checkCredentials(email, "wrong");

    expect(attempts.get(email)?.failedCount).toBe(before);
  });

  it("rejects an empty password against a real account", async () => {
    expect(await checkCredentials("bursar@school.ma", "")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});
