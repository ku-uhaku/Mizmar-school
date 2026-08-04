import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { dateParam, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listMyLessons, teacherSummary } from "@/modules/classroom/queries";

/**
 * The teacher's day: their lessons for the date, and the standing figures the
 * espace enseignant shows.
 *
 * Both queries already scope to `context.user.id` — a teacher sees their own
 * classes and no one else's — so the permission asserted here is about opening
 * the space at all, not about which rows come back.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const date = dateParam(new URL(request.url).searchParams.get("date"));

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_WORKSPACE);
    }

    const [summary, lessons] = await Promise.all([
      teacherSummary(context, date),
      listMyLessons(context, date),
    ]);

    return { date: date.toISOString(), summary, lessons };
  });
}

export { preflight as OPTIONS };
