import { NextResponse } from "next/server";
import { z } from "zod";

import { checkCredentials } from "@/lib/auth";
import { apiError, json, preflight } from "@/lib/mobile-api";
import { issueTokens } from "@/lib/mobile-token";

/**
 * Sign-in for the native app.
 *
 * Deliberately goes through the same `checkCredentials` the web login and the
 * Auth.js callback use: the per-identifier throttle in lib/login-throttle.ts
 * and the constant-time answer for an unknown account are enforced in there,
 * and a second credential path would quietly opt mobile out of both.
 *
 * ── Why `email` is still an accepted field name ─────────────────────────────
 * What arrives is a username — the same credential the web dashboard asks for,
 * for a guardian as much as for a teacher. But a copy of this app already
 * installed on somebody's phone sends the value under the key `email`, and
 * refusing that key would sign every one of them out with no way back. So both
 * names are read and neither says anything about which column is looked in:
 * `checkCredentials` resolves a username and nothing else. `identifier` is the
 * name to use from here on.
 */

const schema = z
  .object({
    identifier: z.string().trim().min(1).max(255).optional(),
    email: z.string().trim().min(1).max(255).optional(),
    password: z.string().min(1).max(200),
  })
  .refine((body) => Boolean(body.identifier ?? body.email), {
    error: "An identifier is required.",
  });

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "invalid_request",
      "A username and a password are required.",
      400,
    );
  }

  const result = await checkCredentials(
    // The new name wins where both are sent.
    (parsed.data.identifier ?? parsed.data.email) as string,
    parsed.data.password,
  );

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

    // Wrong password and unknown account share one answer, as they do on the
    // web: telling a caller which of the two they got is telling them whether
    // an account is real.
    return apiError(
      "invalid_credentials",
      "Incorrect username or password.",
      401,
    );
  }

  return json(await issueTokens(result.userId, result.credentialsChangedAt));
}

export { preflight as OPTIONS };
