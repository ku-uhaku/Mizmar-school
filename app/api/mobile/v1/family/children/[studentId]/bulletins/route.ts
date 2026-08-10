import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadChildBulletins } from "@/modules/portal/queries";

/**
 * The bulletins a family may read — the issued ones, frozen as the school
 * issued them. See the note on `loadChildBulletins`.
 *
 * No permission is asserted: a parent holds none. The authorization is the
 * household scope inside the query, so a student id that is not this
 * guardian's resolves to nothing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const { studentId } = await params;
  return withAuth((context) => loadChildBulletins(context.user.id, studentId));
}

export { preflight as OPTIONS };
