import type { NextResponse } from "next/server";

import { preflight, withAuth } from "@/lib/mobile-api";
import { loadChildSupplies } from "@/modules/portal/queries";

/**
 * The listes de fournitures this child's class has been given.
 *
 * Approved lists only — a draft is somebody thinking and a rejected one is a
 * decision, and neither is a shopping list. See `loadChildSupplies`.
 *
 * No permission is asserted: a parent holds none, and the authorization is the
 * household scope inside the query.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const { studentId } = await params;
  return withAuth((context) => loadChildSupplies(context.user.id, studentId));
}

export { preflight as OPTIONS };
