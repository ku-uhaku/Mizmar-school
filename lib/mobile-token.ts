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

/**
 * The value of `User.credentialsChangedAt` when the token was minted, as epoch
 * milliseconds — 0 for an account whose password has never been changed.
 *
 * `iat` cannot serve this purpose. It says when *this* token was signed, and a
 * refresh mints a token with a fresh one, so a stolen refresh token would keep
 * renewing itself past the reset it was supposed to be killed by. The stamp is
 * copied forward across a refresh instead, and re-checked against the row.
 */
export const CREDENTIALS_CLAIM = "cv";

export function credentialsStamp(changedAt: Date | null | undefined): number {
  return changedAt ? changedAt.getTime() : 0;
}

async function sign(
  userId: string,
  kind: TokenKind,
  ttl: string,
  stamp: number,
) {
  return new SignJWT({ typ: kind, [CREDENTIALS_CLAIM]: stamp })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret());
}

export async function issueTokens(
  userId: string,
  credentialsChangedAt: Date | null = null,
): Promise<TokenPair> {
  const stamp = credentialsStamp(credentialsChangedAt);
  const [accessToken, refreshToken] = await Promise.all([
    sign(userId, "access", ACCESS_TTL, stamp),
    sign(userId, "refresh", REFRESH_TTL, stamp),
  ]);

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

export type VerifiedToken = {
  userId: string;
  /** What the account's credentials looked like when this was issued. */
  credentialsStamp: number;
};

/** Returns who the token was issued for, or null if it is not valid. */
export async function verifyMobileToken(
  token: string,
  kind: TokenKind,
): Promise<VerifiedToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Pinned rather than inferred: the key is symmetric, so jose would only
      // accept HMAC anyway, but saying so keeps that true if the key type ever
      // changes.
      algorithms: ["HS256"],
    });

    if (payload["typ"] !== kind) return null;
    if (typeof payload.sub !== "string") return null;

    const claim = payload[CREDENTIALS_CLAIM];
    return {
      userId: payload.sub,
      // A token minted before this claim existed reads as 0, which is older
      // than any real reset and so cannot outlive one.
      credentialsStamp: typeof claim === "number" ? claim : 0,
    };
  } catch {
    // Expired, tampered with, or signed by something else — all the same
    // answer to the caller, and none of them worth distinguishing to a client.
    return null;
  }
}

/**
 * Whether a credential minted with `stamp` still speaks for this account.
 *
 * Shared by the cookie and the Bearer path so the two cannot drift: a password
 * change moves the column forward, and every credential issued before it stops
 * being accepted on its very next request.
 */
export function credentialsStillValid(
  stamp: number,
  changedAt: Date | null | undefined,
): boolean {
  if (!changedAt) return true;
  return stamp >= changedAt.getTime();
}

/** Pulls the credential out of an `Authorization: Bearer …` header. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}
