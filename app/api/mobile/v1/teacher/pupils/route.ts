import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listMyPupils } from "@/modules/classroom/queries";

/** Every pupil the signed-in teacher teaches, for the remark composer's picker. */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_REMARK_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_REMARK_WRITE);
    }

    return listMyPupils(context);
  });
}

export { preflight as OPTIONS };
