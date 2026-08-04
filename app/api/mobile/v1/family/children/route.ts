import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { listMyChildren } from "@/modules/portal/queries";

/**
 * The signed-in guardian's children.
 *
 * No permission is asserted, and that is the design: a parent holds none. The
 * authorization is the household scope inside the query, which is why the user
 * id goes in rather than an `AuthContext` — see modules/portal/queries.ts.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth((context) => listMyChildren(context.user.id));
}

export { preflight as OPTIONS };
