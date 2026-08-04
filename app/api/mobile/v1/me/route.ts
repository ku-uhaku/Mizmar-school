import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadMobileIdentity } from "@/modules/portal/identity";

/** Who the caller is and which spaces of the app they may open. */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => loadMobileIdentity(context));
}

export { preflight as OPTIONS };
