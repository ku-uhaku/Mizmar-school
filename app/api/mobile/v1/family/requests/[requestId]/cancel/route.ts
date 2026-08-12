import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { cancelRequest } from "@/modules/requests/service";

/**
 * A family withdrawing their own request.
 *
 * The id is never used alone: `cancelRequest` constrains it by the user who
 * filed it, so a crafted id matches nothing rather than withdrawing somebody
 * else's — and one guardian cannot withdraw what another asked for.
 *
 * Only while it is still PENDING. Past that the office has started work, and a
 * refusal here is the honest answer rather than a button that quietly wastes
 * what has already been written.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
): Promise<NextResponse> {
  const { requestId } = await params;

  return withAuth(async (context) => {
    const result = await cancelRequest(requestId, context.user.id);

    // Not-found stays a 404 — whether a request exists is not something a
    // caller who did not file it should learn.
    if (!result.ok && result.reason === "not-found") return null;

    return result.ok
      ? { ok: true as const }
      : { ok: false as const, reason: result.reason };
  });
}

export { preflight as OPTIONS };
