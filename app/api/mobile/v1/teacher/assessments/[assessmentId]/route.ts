import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { findMarkSheet } from "@/modules/assessments/queries";
import { saveMarks } from "@/modules/assessments/service";

/**
 * One paper's mark sheet: the roster, whatever is marked, and the statistics.
 *
 * `findMarkSheet` is the gate as well as the read — it refuses a colleague's
 * devoir, since a piece of work a teacher set for their own class is theirs.
 * A miss comes back as 404, which is also all a colleague is entitled to learn
 * about it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
): Promise<NextResponse> {
  const { assessmentId } = await params;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.ASSESSMENT_GRADE)) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    return findMarkSheet(context, assessmentId);
  });
}

/**
 * One pupil's mark, entered from the phone.
 *
 * One row per call rather than the whole sheet, for the same reason the
 * register posts one pupil at a time: marking a class of thirty happens over
 * several minutes on a patchy connection, and a payload carrying every row
 * would let the last write undo a mark entered five minutes earlier.
 *
 * The sheet is re-read through `findMarkSheet` before anything is written, so
 * the paper this posts onto is exactly the paper the caller could have opened —
 * a Server Function is reachable by direct POST, and the read and the write
 * must agree.
 */
const schema = z.object({
  enrollmentId: z.string().min(1),
  score: z.number().min(0).max(100).nullish(),
  isAbsent: z.boolean(),
  comment: z.string().trim().max(500).nullish(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
): Promise<NextResponse> {
  const { assessmentId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown mark.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.ASSESSMENT_GRADE)) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    const sheet = await findMarkSheet(context, assessmentId);
    if (!sheet) return null;

    const result = await saveMarks(
      sheet.assessment.id,
      [
        {
          enrollmentId: parsed.data.enrollmentId,
          score: parsed.data.score ?? null,
          isAbsent: parsed.data.isAbsent,
          // Whether an absence is excused is the office's call, exactly as it
          // is on the register — the phone never asserts it.
          isExcused: false,
          comment: parsed.data.comment?.trim() || null,
        },
      ],
      context.user.id,
    );

    if (!result.ok) {
      return { ok: false as const, reason: result.reason, sheet };
    }

    // The sheet as it now stands, so the phone re-renders on the server's
    // answer — including the recomputed class average — rather than on what it
    // hoped it wrote.
    const after = await findMarkSheet(context, assessmentId);
    if (!after) return null;

    return { ok: true as const, sheet: after };
  });
}

export { preflight as OPTIONS };
