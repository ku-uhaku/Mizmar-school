import { NextResponse } from "next/server";
import { z } from "zod";

import { checkCredentials } from "@/lib/auth";
import { apiError, json, preflight } from "@/lib/mobile-api";
import { issueTokens } from "@/lib/mobile-token";

/**
 * Sign-in for the native app.
 *
 * Deliberately goes through the same `checkCredentials` the web login and the
 * Auth.js callback use: the per-address throttle in lib/login-throttle.ts and
 * the constant-time answer for an unknown email are enforced in there, and a
 * second credential path would quietly opt mobile out of both.
 */

const schema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return apiError("invalid_request", "Email and password are required.", 400);
  }

  const result = await checkCredentials(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    if (result.reason === "throttled") {
      return NextResponse.json(
        {
          error: {
            code: "too_many_attempts",
            message: "Too many failed attempts.",
            retryAfterSeconds: result.retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: { "retry-after": String(result.retryAfterSeconds) },
        },
      );
    }

    if (result.reason === "disabled") {
      return apiError("account_disabled", "This account is deactivated.", 403);
    }

    // Wrong password and unknown address share one answer, as they do on the
    // web: telling a caller which of the two they got is telling them whether
    // an address is real.
    return apiError("invalid_credentials", "Incorrect email or password.", 401);
  }

  return json(await issueTokens(result.userId, result.credentialsChangedAt));
}

export { preflight as OPTIONS };
