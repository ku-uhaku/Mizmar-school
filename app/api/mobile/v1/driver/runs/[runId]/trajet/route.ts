import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { loadRunItinerary } from "@/modules/transport/queries";

/**
 * Le trajet: where this voyage goes, and how many children at each stop.
 *
 * Behind TRANSPORT_VIEW rather than TRANSPORT_ATTENDANCE — reading the line is
 * not taking the register, and an accompagnateur or a relief driver who may see
 * the route is not necessarily the one marking the sheet.
 *
 * `loadRunItinerary` is crew-scoped, so a run belonging to another bus answers
 * null and this returns 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await params;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_VIEW);
    }

    return loadRunItinerary(context, runId);
  });
}

export { preflight as OPTIONS };
