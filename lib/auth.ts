import { randomInt } from "node:crypto";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { recordEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { CREDENTIALS_CLAIM, credentialsStamp } from "@/lib/mobile-token";
import {
  checkLoginThrottle,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/login-throttle";
import { SESSION_ENTITY } from "@/modules/audit/enums";
import { looksLikeEmail } from "@/modules/users/enums";
import { hasWebAccess } from "@/modules/access/web-access";

/**
 * Auth.js v5. Sessions are JWT-based: the token carries only the user id, and
 * every request re-reads roles, permissions and the school context from the
 * database through lib/dal.ts. That means deactivating a user or changing their
 * role takes effect on their next request rather than when their token expires.
 */

/** Compared against when no user matches, so a wrong email costs the same
 *  amount of time as a wrong password and cannot be distinguished by timing. */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.NgW7ZzGvXhZWjBmxJmLTk1TF.4LcJ2W";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/**
 * A password for an account somebody else opens on a person's behalf — a
 * parent's portal login, handed over at the counter.
 *
 * The alphabet has `0/O` and `1/l/I` removed: this gets dictated down a
 * telephone or copied off a slip of paper, and a glyph nobody can read back is a
 * support call. `crypto.randomInt` rather than `Math.random` — the value is a
 * credential, and it is uniform without the modulo bias a hand-rolled version
 * would carry.
 */
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Verifies an identifier and a password.
 *
 * ── Why one function takes both a username and an email ─────────────────────
 * The two audiences sign in at different doors. The web dashboard is a staff
 * surface, so its form asks for a username; the phone serves guardians too, and
 * a parent gives the email address the school already holds for them. Both
 * arrive here, and which column to look in is decided by whether there is an
 * `@` in what was typed — see `looksLikeEmail`.
 *
 * An account with no username is therefore not locked out: nothing about the
 * email path changed, which is what makes the username rollout safe on a school
 * whose accounts predate it.
 *
 * Returns the user id on success, or a reason the caller can turn into a
 * localised message.
 *
 * Rate-limited per identifier (see lib/login-throttle.ts). The limit is
 * enforced here rather than in the login action because Auth.js's own
 * credentials callback comes through this same function — a guard on the action
 * alone would leave `/api/auth/callback/credentials` unthrottled.
 */
export async function checkCredentials(
  identifier: string,
  plainPassword: string,
): Promise<
  | { ok: true; userId: string; credentialsChangedAt: Date | null }
  | { ok: false; reason: "invalid" | "disabled" }
  | { ok: false; reason: "throttled"; retryAfterSeconds: number }
> {
  // Lowercased for both columns: an email is case-insensitive by convention and
  // a username is by rule, so one normalisation serves and the throttle counter
  // cannot be reset by varying the capitals.
  const normalizedEmail = identifier.trim().toLowerCase();

  // Before the hash comparison, so a locked identifier costs no bcrypt work.
  const throttle = await checkLoginThrottle(normalizedEmail);
  if (throttle.locked) {
    await recordAttempt(normalizedEmail, "LOGIN_BLOCKED", {
      retryAfterSeconds: throttle.retryAfterSeconds,
    });
    return {
      ok: false,
      reason: "throttled",
      retryAfterSeconds: throttle.retryAfterSeconds,
    };
  }

  /*
    An `@` decides which column, rather than trying one and then the other.

    Two lookups would let an attacker tell a real username from a real email by
    timing, and — worse — would let somebody register a username that happens to
    equal another account's email local part and shadow them at the login box.
    One identifier, one column, no ambiguity about whose account was found.
  */
  const user = await db.user.findUnique({
    where: looksLikeEmail(normalizedEmail)
      ? { email: normalizedEmail }
      : { username: normalizedEmail },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      credentialsChangedAt: true,
    },
  });

  if (!user) {
    await bcrypt.compare(plainPassword, DUMMY_HASH);
    await recordFailedLogin(normalizedEmail);
    // Recorded as an address, not as an account: there is no account. Which is
    // itself worth having in the trail — a run of these against invented
    // addresses is somebody guessing who works here.
    await recordAttempt(normalizedEmail, "LOGIN_FAILED", { reason: "unknown" });
    return { ok: false, reason: "invalid" };
  }

  const matches = await verifyPassword(plainPassword, user.passwordHash);
  if (!matches) {
    await recordFailedLogin(normalizedEmail);
    await recordAttempt(normalizedEmail, "LOGIN_FAILED", {
      reason: "password",
    });
    return { ok: false, reason: "invalid" };
  }

  // The password was right, so this is not the grind the counter guards
  // against — clear it even when the account turns out to be deactivated.
  await clearLoginAttempts(normalizedEmail);

  if (!user.isActive) {
    await recordAttempt(normalizedEmail, "LOGIN_FAILED", { reason: "disabled" });
    return { ok: false, reason: "disabled" };
  }

  return {
    ok: true,
    userId: user.id,
    credentialsChangedAt: user.credentialsChangedAt,
  };
}

/**
 * Whether this account may open the web dashboard.
 *
 * Deliberately *not* inside `checkCredentials`: the native app signs in through
 * that same function, and a teacher's credentials are perfectly good — it is
 * this surface they are refused, not their account. Both web sign-in paths call
 * this after the password has been accepted; the phone calls neither.
 *
 * An account that has vanished between the two reads answers `false`. There is
 * nothing to let in.
 */
export async function accountMayOpenWebApp(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isSuperAdmin: true,
      orgRoleId: true,
      memberships: { select: { role: { select: { name: true } } } },
    },
  });

  return user ? hasWebAccess(user) : false;
}

/**
 * Puts a refused sign-in in the trail.
 *
 * The actor is the address that was typed, because that is all there is — there
 * is no session, and often no account either. `checkCredentials` is the one
 * funnel both sign-in paths go through, which is why the recording sits here
 * rather than in the login action.
 *
 * Successes are *not* recorded here: this function runs twice for one
 * successful sign-in — once from the action and once from Auth.js re-verifying
 * — and a trail that shows every login twice is a trail nobody trusts. The
 * success is recorded in `authorize` below, which runs once.
 */
async function recordAttempt(
  email: string,
  action: "LOGIN_FAILED" | "LOGIN_BLOCKED",
  metadata: Record<string, unknown>,
): Promise<void> {
  await recordEvent({
    action,
    entity: SESSION_ENTITY,
    entityLabel: email,
    metadata,
    actor: { actorId: null, actorLabel: email, actorEmail: email },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // The app is deployed behind whatever host the school runs it on; there is no
  // fixed canonical URL to pin.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        // `text`, not `email`: staff sign in with a username, and the browser
        // must not refuse one for lacking an `@`.
        identifier: { label: "Identifier", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // Re-verifies even though the login action already checked. Server
      // Functions are reachable directly, so this must never be the only gate.
      authorize: async (credentials) => {
        const identifier = credentials?.identifier;
        const plain = credentials?.password;
        if (typeof identifier !== "string" || typeof plain !== "string") {
          return null;
        }

        const result = await checkCredentials(identifier, plain);
        if (!result.ok) return null;

        /*
          The web app's own door, after the password and before the cookie.

          A teacher's account is refused here rather than at the first page it
          asks for, so no session is ever issued for it — there is no cookie to
          steal, to keep, or to come back with. The same account signs into the
          native app a second later, which is where their work is.
        */
        if (!(await accountMayOpenWebApp(result.userId))) {
          await recordAttempt(identifier.trim().toLowerCase(), "LOGIN_BLOCKED", {
            reason: "web_access_denied",
          });
          return null;
        }

        const account = await db.user.update({
          where: { id: result.userId },
          data: { lastLoginAt: new Date() },
          include: { profile: true },
        });

        // Carried into the JWT below, so this session can be told apart from
        // one issued before a password change.
        const stamp = credentialsStamp(account.credentialsChangedAt);

        // Once per sign-in, whichever path it came in by. The name is copied in
        // as it reads now, like every other entry — see the ActivityLog schema.
        await recordEvent({
          action: "LOGIN",
          entity: SESSION_ENTITY,
          entityId: account.id,
          entityLabel: account.email,
          actor: {
            actorId: account.id,
            actorLabel: account.profile
              ? `${account.profile.firstName} ${account.profile.lastName}`.trim() ||
                account.email
              : account.email,
            actorEmail: account.email,
            organizationId: account.organizationId,
            schoolId: account.currentSchoolId,
            schoolYearId: account.currentSchoolYearId,
          },
        });

        return { id: result.userId, credentialsStamp: stamp };
      },
    }),
  ],
  callbacks: {
    /*
      Set once, at sign-in, and carried forward untouched.

      Auth.js re-signs the session cookie on every read to push its expiry out,
      which stamps a fresh `iat` each time — so `iat` says nothing about when
      the holder actually authenticated and cannot be used to expire a
      credential. The payload survives that re-signing, so the credentials stamp
      is put in here and compared against the row in lib/dal.ts.
    */
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token[CREDENTIALS_CLAIM] = (user as { credentialsStamp?: number })
          .credentialsStamp ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      const stamp = token[CREDENTIALS_CLAIM];
      session.user.credentialsStamp = typeof stamp === "number" ? stamp : 0;
      return session;
    },
  },
});
