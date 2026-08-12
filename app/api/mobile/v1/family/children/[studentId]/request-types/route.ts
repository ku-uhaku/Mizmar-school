import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { listRequestTypesFor } from "@/modules/portal/queries";

/**
 * What this child's school will issue.
 *
 * Under the child rather than at the top level because the catalogue belongs to
 * a school, and a parent with children in two schools of the same groupe has
 * two of them — offering one merged list would let them ask one school for a
 * paper only the other writes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const { studentId } = await params;
  return withAuth((context) =>
    listRequestTypesFor(context.user.id, studentId),
  );
}

export { preflight as OPTIONS };
