import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { listClassmates } from "@/modules/portal/queries";

/**
 * The class list: who else sits in this child's class, and whose birthday it is.
 *
 * No permission is asserted — a parent holds none. The authorization is the
 * household scope inside the query, which resolves the child in the URL before
 * it will name anybody at all; the class is taken from that child's own
 * enrolment rather than from the request. See `listClassmates` for what a
 * household is allowed to learn about somebody else's child, and what it is not.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const { studentId } = await params;
  return withAuth((context) => listClassmates(context.user.id, studentId));
}

export { preflight as OPTIONS };
