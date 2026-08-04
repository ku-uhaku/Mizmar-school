import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { apiError, json, preflight } from "@/lib/mobile-api";
import { issueTokens, verifyMobileToken } from "@/lib/mobile-token";

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

  const userId = await verifyMobileToken(parsed.data.refreshToken, "refresh");
  if (!userId) {
    return apiError("invalid_token", "Sign in again.", 401);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });

  if (!user?.isActive) {
    return apiError("invalid_token", "Sign in again.", 401);
  }

  // Rotated, not reissued: the old refresh token's remaining 60 days are not
  // extended silently, and a client that keeps using it is a client that has
  // stopped following the protocol.
  return json(await issueTokens(userId));
}

export { preflight as OPTIONS };
