import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import {
  checkLoginThrottle,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/login-throttle";

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

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Verifies an email/password pair.
 * Returns the user id on success, or a reason the caller can turn into a
 * localised message.
 *
 * Rate-limited per address (see lib/login-throttle.ts). The limit is enforced
 * here rather than in the login action because Auth.js's own credentials
 * callback comes through this same function — a guard on the action alone
 * would leave `/api/auth/callback/credentials` unthrottled.
 */
export async function checkCredentials(
  email: string,
  plainPassword: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "disabled" }
  | { ok: false; reason: "throttled"; retryAfterSeconds: number }
> {
  const normalizedEmail = email.trim().toLowerCase();

  // Before the hash comparison, so a locked address costs no bcrypt work.
  const throttle = await checkLoginThrottle(normalizedEmail);
  if (throttle.locked) {
    return {
      ok: false,
      reason: "throttled",
      retryAfterSeconds: throttle.retryAfterSeconds,
    };
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!user) {
    await bcrypt.compare(plainPassword, DUMMY_HASH);
    await recordFailedLogin(normalizedEmail);
    return { ok: false, reason: "invalid" };
  }

  const matches = await verifyPassword(plainPassword, user.passwordHash);
  if (!matches) {
    await recordFailedLogin(normalizedEmail);
    return { ok: false, reason: "invalid" };
  }

  // The password was right, so this is not the grind the counter guards
  // against — clear it even when the account turns out to be deactivated.
  await clearLoginAttempts(normalizedEmail);

  if (!user.isActive) return { ok: false, reason: "disabled" };

  return { ok: true, userId: user.id };
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Re-verifies even though the login action already checked. Server
      // Functions are reachable directly, so this must never be the only gate.
      authorize: async (credentials) => {
        const email = credentials?.email;
        const plain = credentials?.password;
        if (typeof email !== "string" || typeof plain !== "string") return null;

        const result = await checkCredentials(email, plain);
        if (!result.ok) return null;

        await db.user.update({
          where: { id: result.userId },
          data: { lastLoginAt: new Date() },
        });

        return { id: result.userId };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
