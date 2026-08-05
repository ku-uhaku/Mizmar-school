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
 *
 * ── Why the response is picked apart rather than returned whole ──────────────
 * `SchoolLifeStats` also carries the day's register — up to a hundred pupils
 * with the reason a teacher typed against each — the latest carnet remarks
 * including the ones marked internal, and the papers awaiting acceptance. None
 * of it is read by any of the four spaces. Returning the object whole put all
 * of it on a phone, and made the hand-mirrored DTO in `mobile/src/api/types.ts`
 * a description of a subset rather than of the payload. What the app reads is
 * spelled out here, so adding a field to the web dashboard cannot quietly ship
 * it to a handset.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.SCHOOL_LIFE_VIEW)) {
      throw new ForbiddenError(PERMISSIONS.SCHOOL_LIFE_VIEW);
    }

    const stats = await loadSchoolLifeStats(context);

    return {
      schoolName: context.currentSchool?.name ?? null,
      schoolYearName: context.currentSchoolYear?.name ?? null,
      stats: {
        standing: stats.standing,
        families: stats.families,
        enrolment: stats.enrolment,
        billing: stats.billing,
        byLevel: stats.byLevel,
      },
    };
  });
}

export { preflight as OPTIONS };
