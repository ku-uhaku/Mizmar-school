import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { submitList } from "@/modules/supplies/service";

/**
 * Hands the list to the direction.
 *
 * The teacher's last move on it: from here the decision is the office's, and
 * only an APPROVED list is ever shown to a family. `submitList` scopes by
 * author as well as school — submitting somebody else's draft would put their
 * name on a decision they did not ask for.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> },
): Promise<NextResponse> {
  const { listId } = await params;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.SUPPLY_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.SUPPLY_WRITE);
    }

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return null;

    const result = await submitList(listId, schoolId, context.user.id);
    if (!result.ok) return { ok: false as const, reason: result.reason };

    return { ok: true as const };
  });
}

export { preflight as OPTIONS };
