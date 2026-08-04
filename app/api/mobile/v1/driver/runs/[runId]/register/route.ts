import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { loadRunRegister } from "@/modules/transport/queries";

/** Who is expected on this run, and who has been marked. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await params;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_ATTENDANCE);
    }

    return loadRunRegister(context, runId);
  });
}

export { preflight as OPTIONS };
