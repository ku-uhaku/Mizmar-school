import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { loadTeacherTimetable } from "@/modules/timetable/queries";

/**
 * The signed-in teacher's own week.
 *
 * Always their own grid: `loadTeacherTimetable` is handed `context.user.id`
 * rather than an id from the request, so this cannot be pointed at a
 * colleague's week. That is why the workspace code is the only gate — a teacher
 * is always allowed to see where they are expected to be.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const schedule = new URL(request.url).searchParams.get("schedule");
  // Moroccan schools switch to a compressed day for Ramadan; the grid is stored
  // twice rather than rewritten, so the choice is just which one to read.
  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_WORKSPACE);
    }

    return loadTeacherTimetable(context, context.user.id, scheduleKind);
  });
}

export { preflight as OPTIONS };
