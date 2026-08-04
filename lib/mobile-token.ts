import "server-only";

import { SignJWT, jwtVerify } from "jose";

/**
 * Bearer tokens for the native app.
 *
 * The web app authenticates with an Auth.js cookie, which a native client
 * cannot carry sensibly. Mobile gets its own pair of signed tokens instead —
 * but the same security model: like the session cookie, these carry nothing
 * but a user id, and `lib/dal.ts` still re-reads roles, permissions and the
 * account's active flag from the database on every single request. A
 * deactivated account therefore loses mobile access on its next call, without
 * any token blacklist to maintain.
 *
 * Signed with AUTH_SECRET, the same key Auth.js uses, so there is one secret to
 * rotate rather than two. The `typ` claim keeps the two kinds apart: a refresh
 * token presented as a Bearer credential is rejected, which is what stops a
 * long-lived token from being usable as an access token if it leaks from
 * storage.
 */

const ISSUER = "school-admin";
const AUDIENCE = "school-mobile";

/** Short, because it is sent on every request and cannot be revoked early. */
const ACCESS_TTL = "2h";

/**
 * Long, because the alternative is a parent re-typing their password every
 * fortnight. Revocation is by deactivating the account, which the DAL enforces
 * on the next request.
 */
const REFRESH_TTL = "60d";

export type TokenKind = "access" | "refresh";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  /** Seconds until `accessToken` expires, for the client's refresh timer. */
  expiresIn: number;
};

const ACCESS_TTL_SECONDS = 2 * 60 * 60;

function secret(): Uint8Array {
  const value = process.env["AUTH_SECRET"];
  // Failing loudly beats signing with a fallback key: a token signed with a
  // guessable secret is a token anybody can mint.
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

async function sign(userId: string, kind: TokenKind, ttl: string) {
  return new SignJWT({ typ: kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret());
}

export async function issueTokens(userId: string): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    sign(userId, "access", ACCESS_TTL),
    sign(userId, "refresh", REFRESH_TTL),
  ]);

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

/** Returns the user id the token was issued for, or null if it is not valid. */
export async function verifyMobileToken(
  token: string,
  kind: TokenKind,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (payload["typ"] !== kind) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Expired, tampered with, or signed by something else — all the same
    // answer to the caller, and none of them worth distinguishing to a client.
    return null;
  }
}

/** Pulls the credential out of an `Authorization: Bearer …` header. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}
