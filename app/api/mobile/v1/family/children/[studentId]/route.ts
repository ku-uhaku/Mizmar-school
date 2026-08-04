import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadChildDetail } from "@/modules/portal/queries";

/**
 * One child's card: marks, absences, fees, bus.
 *
 * A student id that is not this guardian's resolves to null, which `withAuth`
 * answers as 404 — the same answer as a child who does not exist, because
 * distinguishing the two would confirm that a given pupil is enrolled here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const { studentId } = await params;
  return withAuth((context) => loadChildDetail(context.user.id, studentId));
}

export { preflight as OPTIONS };
