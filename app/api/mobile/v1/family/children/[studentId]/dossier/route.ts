import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadChildDossier } from "@/modules/portal/queries";

/**
 * What the school still needs from this family, and what it already has.
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
  return withAuth((context) => loadChildDossier(context.user.id, studentId));
}

export { preflight as OPTIONS };
