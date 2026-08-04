import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { dateParam, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listMyRuns } from "@/modules/transport/queries";
import { ensureDayRuns } from "@/modules/transport/service";

/**
 * The chauffeur's circuits for a day.
 *
 * `listMyRuns` matches on `vehicle.driver.userId`, so this returns the runs of
 * the bus this account actually drives and nothing else — a second driver
 * cannot read the first one's day by asking nicely.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const date = dateParam(new URL(request.url).searchParams.get("date"));

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
      throw new ForbiddenError(PERMISSIONS.TRANSPORT_VIEW);
    }

    // The board is generated on the way in, exactly as the office screen does
    // it — there is no scheduler in this deployment, and a driver opening the
    // app at 06:50 is the event that means "today has begun". The unique index
    // makes the second caller of the morning write nothing.
    const schoolYearId = context.currentSchoolYear?.id;
    if (schoolYearId) await ensureDayRuns(schoolYearId, date);

    return { date: date.toISOString(), runs: await listMyRuns(context, date) };
  });
}

export { preflight as OPTIONS };
