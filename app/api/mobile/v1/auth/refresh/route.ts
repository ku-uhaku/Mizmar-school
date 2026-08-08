import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { apiError, json, preflight } from "@/lib/mobile-api";
import {
  credentialsStillValid,
  issueTokens,
  verifyMobileToken,
} from "@/lib/mobile-token";

/**
 * Trades a refresh token for a fresh pair.
 *
 * The account is re-read here, not merely the signature checked: a token minted
 * before somebody was deactivated must stop working, and this is the point at
 * which a 60-day credential is re-tested against the database.
 */

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return apiError("invalid_request", "A refresh token is required.", 400);
  }

  const verified = await verifyMobileToken(parsed.data.refreshToken, "refresh");
  if (!verified) {
    return apiError("invalid_token", "Sign in again.", 401);
  }

  const user = await db.user.findUnique({
    where: { id: verified.userId },
    select: { isActive: true, credentialsChangedAt: true },
  });

  if (!user?.isActive) {
    return apiError("invalid_token", "Sign in again.", 401);
  }

  // The point of re-testing here rather than only in the DAL: a refresh token
  // is the one credential that can mint fresh ones, so a token issued before a
  // password change must die at this door. Otherwise resetting a compromised
  // account's password would leave whoever holds the old token renewing their
  // way past it for the rest of its sixty days.
  if (!credentialsStillValid(verified.credentialsStamp, user.credentialsChangedAt)) {
    return apiError("invalid_token", "Sign in again.", 401);
  }

  // The pair is reissued with the account's current stamp; the presented token
  // keeps its own remaining life, which is why the check above is what has to
  // stop it rather than any bookkeeping about which tokens have been seen.
  return json(await issueTokens(verified.userId, user.credentialsChangedAt));
}

export { preflight as OPTIONS };
