import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { listMyChannels } from "@/modules/portal/queries";

/**
 * The conversations this household may open.
 *
 * Empty when the school has both switches off, which is the default — see
 * `listMyChannels`. The switches are checked in the query rather than here, so
 * no caller can forget them.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => listMyChannels(context.user.id));
}

export { preflight as OPTIONS };
