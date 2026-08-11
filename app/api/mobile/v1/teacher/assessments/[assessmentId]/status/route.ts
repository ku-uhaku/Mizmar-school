import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolYearId } from "@/lib/scope";
import { setAssessmentStatus } from "@/modules/assessments/service";

/**
 * Handing a paper in, and taking it back.
 *
 * The only status move a teacher may make, and deliberately the only one this
 * route offers: announcing a paper, accepting the marks and cancelling are the
 * office's, and they stay on the web behind `assessment.publish`. So the phone
 * needs no notion of who is office — it simply cannot reach those transitions.
 *
 * Confined to the caller's own paper as a `where` rather than a check
 * afterwards, so asking after a colleague's is indistinguishable from asking
 * after one that does not exist.
 */
const schema = z.object({ status: z.enum(["SUBMITTED", "PUBLISHED"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
): Promise<NextResponse> {
  const { assessmentId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown status.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.ASSESSMENT_GRADE)) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return null;

    const existing = await db.assessment.findFirst({
      where: {
        id: assessmentId,
        schoolId,
        term: { schoolYearId: currentSchoolYearId(context) },
        teacherId: context.user.id,
      },
      select: { id: true, status: true },
    });
    if (!existing) return null;

    // A teacher may hand back a paper that is open, and take back one they have
    // handed in. They may not reach past the office's own moves — a GRADED
    // paper is finished, and reopening it is the office's decision.
    if (existing.status !== "PUBLISHED" && existing.status !== "SUBMITTED") {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_PUBLISH);
    }

    const result = await setAssessmentStatus(existing.id, parsed.data.status);
    if (!result.ok) return { ok: false as const, reason: result.reason };

    return { ok: true as const, status: parsed.data.status };
  });
}

export { preflight as OPTIONS };
