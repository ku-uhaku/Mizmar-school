import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolId } from "@/lib/scope";
import { REMARK_KINDS, REMARK_MAX_LENGTH, REMARK_TONES } from "@/modules/classroom/enums";
import { writeRemark } from "@/modules/classroom/service";

/**
 * Writes an observation about a pupil the teacher teaches.
 *
 * Unlike the web form, this never asks to release the remark to the family —
 * that grant (`classroom.remarkPublish`) is an office decision, and a phone
 * composer is not the place to build a permission-conditional toggle for it.
 * A remark from here is always the internal note; publishing stays a web
 * workflow, exactly as `writeRemark`'s own `isVisibleToFamily` gate expects.
 */
const schema = z.object({
  enrollmentId: z.string().min(1),
  subjectId: z.string().min(1).nullish(),
  kind: z.enum(REMARK_KINDS),
  tone: z.enum(REMARK_TONES),
  body: z.string().trim().min(3).max(REMARK_MAX_LENGTH),
  occurredOn: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown remark.", 400);
  }

  const occurredOn = new Date(parsed.data.occurredOn);
  if (Number.isNaN(occurredOn.getTime())) {
    return apiError("invalid_request", "Invalid date.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_REMARK_WRITE)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_REMARK_WRITE);
    }

    const result = await writeRemark({
      authorId: context.user.id,
      schoolId: currentSchoolId(context),
      actsForSchool: context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH),
      enrollmentId: parsed.data.enrollmentId,
      subjectId: parsed.data.subjectId ?? null,
      kind: parsed.data.kind,
      tone: parsed.data.tone,
      body: parsed.data.body.trim(),
      occurredOn,
      isVisibleToFamily: false,
    });
    if (!result.ok) return null;

    return { ok: true };
  });
}

export { preflight as OPTIONS };
