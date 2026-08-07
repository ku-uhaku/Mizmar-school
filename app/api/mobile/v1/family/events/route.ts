import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { listMyEvents } from "@/modules/portal/queries";

/**
 * What the school has announced to this household.
 *
 * No permission is asserted, for the same reason as the children endpoint: a
 * parent holds none. The authorization is the household scope inside the query,
 * plus the published-status filter — a draft cannot leave the building however
 * this is called. See `listMyEvents`.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => listMyEvents(context.user.id));
}

export { preflight as OPTIONS };
