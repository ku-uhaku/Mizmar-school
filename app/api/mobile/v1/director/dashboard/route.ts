import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { loadSchoolLifeStats } from "@/modules/school-life/queries";

/**
 * The figures a director or manager opens the app for.
 *
 * `loadSchoolLifeStats` composes each module's own count rather than
 * re-deriving the scoping, so what a director sees here is exactly what the web
 * dashboard would show them — including seeing only their own school when that
 * is all their membership reaches.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.SCHOOL_LIFE_VIEW)) {
      throw new ForbiddenError(PERMISSIONS.SCHOOL_LIFE_VIEW);
    }

    return {
      schoolName: context.currentSchool?.name ?? null,
      schoolYearName: context.currentSchoolYear?.name ?? null,
      stats: await loadSchoolLifeStats(context),
    };
  });
}

export { preflight as OPTIONS };
