import type { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/dal";
import { apiError, json, preflight } from "@/lib/mobile-api";
import { issueTokens } from "@/lib/mobile-token";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { changeOwnPassword } from "@/modules/profile/service";

/**
 * The caller changes their own password.
 *
 * Written for the parent who was handed a password by the office and wants one
 * they can remember — but it is the account's own screen, so a teacher or a
 * chauffeur uses the same door. There is no id in the body: the account is the
 * one the token speaks for, so there is nothing here to spoof.
 *
 * Forgetting the new one is not this endpoint's problem, and deliberately so:
 * there is no self-service recovery, the office reissues one (`family.portal`,
 * modules/families/actions.ts). A school that can hand a parent a password at
 * the counter does not need an email-reset flow this app has no address to send
 * to.
 *
 * ── Why it answers with tokens ──────────────────────────────────────────────
 * The change stamps `credentialsChangedAt`, which is exactly what makes every
 * credential minted before it stop working — including the one that made this
 * call. The web accepts landing on the sign-in screen; a phone should not, so
 * the new pair comes back in the same response and the client stores it. The
 * user's *other* devices are still evicted, which is the point of the stamp.
 */

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

export async function POST(request: Request): Promise<NextResponse> {
  const context = await getAuthContext();
  if (!context) {
    return apiError("unauthenticated", "Sign in to continue.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "invalid_request",
      `A password of at least ${PASSWORD_MIN_LENGTH} characters is required.`,
      400,
    );
  }

  const result = await changeOwnPassword(context.user.id, parsed.data);

  if (!result.ok) {
    if (result.reason === "wrong-password") {
      // 403 rather than 401: a 401 is what the client retries by refreshing its
      // token, and the token is fine — it is the typed password that is wrong.
      return apiError("wrong_password", "Incorrect current password.", 403);
    }
    return apiError("not_found", "Not found.", 404);
  }

  return json(await issueTokens(context.user.id, result.credentialsChangedAt));
}

export { preflight as OPTIONS };
