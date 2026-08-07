import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadChildTimetable } from "@/modules/portal/queries";

/**
 * The child's week, flat: one entry per lesson.
 *
 * No permission is asserted — a parent holds none. The authorization is the
 * household scope inside the query: a student id that is not this guardian's
 * resolves to nothing, the same answer as a child who does not exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const { studentId } = await params;
  return withAuth((context) => loadChildTimetable(context.user.id, studentId));
}

export { preflight as OPTIONS };
