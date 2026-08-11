import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listRemarks } from "@/modules/classroom/queries";

/**
 * What this teacher has written, and whether the direction has released it.
 *
 * `mineOnly` because a colleague's note is their own until the school decides
 * otherwise — the same rule the web workspace applies. The point of the screen
 * is the `isVisibleToFamily` flag on each row: a teacher writing from a phone
 * needs to see that the note is waiting on the direction rather than already in
 * front of a parent.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_REMARK_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_REMARK_WRITE);
    }

    return listRemarks(context, { mineOnly: true });
  });
}

export { preflight as OPTIONS };
