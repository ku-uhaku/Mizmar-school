import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { recordEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { CREDENTIALS_CLAIM, credentialsStamp } from "@/lib/mobile-token";
import { generatePassword, hashPassword, verifyPassword } from "@/lib/password";
import {
  checkLoginThrottle,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/login-throttle";
import { SESSION_ENTITY } from "@/modules/audit/enums";
import { normalizeUsername } from "@/modules/users/enums";
import { hasWebAccess } from "@/modules/access/web-access";

/**
 * Auth.js v5. Sessions are JWT-based: the token carries only the user id, and
 * every request re-reads roles, permissions and the school context from the
 * database through lib/dal.ts. That means deactivating a user or changing their
 * role takes effect on their next request rather than when their token expires.
 */

/** Compared against when no user matches, so an unknown username costs the same
 *  amount of time as a wrong password and cannot be distinguished by timing. */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.NgW7ZzGvXhZWjBmxJmLTk1TF.4LcJ2W";

/*
  Re-exported rather than defined here: hashing a password used to cost an import
  of Auth.js, which no seed or script can afford — see lib/password.ts. Callers
  already reaching for `@/lib/auth` keep working.
*/
export { generatePassword, hashPassword, verifyPassword };

/**
 * Verifies a username and a password.
 *
 * ── One credential, one column ──────────────────────────────────────────────
 * Every account signs in with its username — staff at the web dashboard,
 * guardians and drivers on the phone. `User.email` is a mailbox the school may
 * or may not hold and is never looked at here, so an address cannot be used to
 * reach an account and an account with no address is not shut out.
 *
 * It used to depend on whether there was an `@` in what was typed, which meant a
 * username equal to another account's email local part could shadow it at the
 * login box. There is now nothing to disambiguate.
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
  // Lowercased by the same helper the column is written through, so the lookup
  // cannot miss a row over capitals and the throttle counter cannot be reset by
  // varying them.
  const username = normalizeUsername(identifier);

  // Before the hash comparison, so a locked identifier costs no bcrypt work.
  const throttle = await checkLoginThrottle(username);
  if (throttle.locked) {
    await recordAttempt(username, "LOGIN_BLOCKED", {
      retryAfterSeconds: throttle.retryAfterSeconds,
    });
    return {
      ok: false,
      reason: "throttled",
      retryAfterSeconds: throttle.retryAfterSeconds,
    };
  }

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      credentialsChangedAt: true,
    },
  });

  if (!user) {
    await bcrypt.compare(plainPassword, DUMMY_HASH);
    await recordFailedLogin(username);
    // Recorded as what was typed, not as an account: there is no account. Which
    // is itself worth having in the trail — a run of these against invented
    // names is somebody guessing who works here.
    await recordAttempt(username, "LOGIN_FAILED", { reason: "unknown" });
    return { ok: false, reason: "invalid" };
  }

  const matches = await verifyPassword(plainPassword, user.passwordHash);
  if (!matches) {
    await recordFailedLogin(username);
    await recordAttempt(username, "LOGIN_FAILED", {
      reason: "password",
    });
    return { ok: false, reason: "invalid" };
  }

  // The password was right, so this is not the grind the counter guards
  // against — clear it even when the account turns out to be deactivated.
  await clearLoginAttempts(username);

  if (!user.isActive) {
    await recordAttempt(username, "LOGIN_FAILED", { reason: "disabled" });
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
 * The actor is the username that was typed, because that is all there is —
 * there is no session, and often no account either. `checkCredentials` is the
 * one funnel both sign-in paths go through, which is why the recording sits here
 * rather than in the login action.
 *
 * `actorEmail` stays null: what arrived is a username, and putting it in a
 * column called an address would make the audit list lie about which of the two
 * somebody typed. The username is searchable through `actorLabel` — see the
 * search in modules/audit/queries.ts.
 *
 * Successes are *not* recorded here: this function runs twice for one
 * successful sign-in — once from the action and once from Auth.js re-verifying
 * — and a trail that shows every login twice is a trail nobody trusts. The
 * success is recorded in `authorize` below, which runs once.
 */
async function recordAttempt(
  username: string,
  action: "LOGIN_FAILED" | "LOGIN_BLOCKED",
  metadata: Record<string, unknown>,
): Promise<void> {
  await recordEvent({
    action,
    entity: SESSION_ENTITY,
    entityLabel: username,
    metadata,
    actor: { actorId: null, actorLabel: username, actorEmail: null },
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
        // `text`, not `email`: everybody signs in with a username, and the
        // browser must not refuse one for lacking an `@`.
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
          await recordAttempt(normalizeUsername(identifier), "LOGIN_BLOCKED", {
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
          entityLabel: account.username,
          actor: {
            actorId: account.id,
            actorLabel: account.profile
              ? `${account.profile.firstName} ${account.profile.lastName}`.trim() ||
                account.username
              : account.username,
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
