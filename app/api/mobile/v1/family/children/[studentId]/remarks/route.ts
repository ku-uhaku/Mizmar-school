import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadChildRemarks } from "@/modules/portal/queries";

/**
 * The carnet de liaison, filtered to what a teacher released to the family — see the note on `loadChildRemarks`.
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
  return withAuth((context) => loadChildRemarks(context.user.id, studentId));
}

export { preflight as OPTIONS };
