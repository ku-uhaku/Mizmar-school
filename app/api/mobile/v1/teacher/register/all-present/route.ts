import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolId } from "@/lib/scope";
import { findRegister } from "@/modules/classroom/queries";
import { saveSession } from "@/modules/classroom/service";

/**
 * "Les autres sont là" — the appel is finished.
 *
 * ── Why it now writes nothing ───────────────────────────────────────────────
 * It used to fill in a PRESENT row for every pupil nobody had tapped. Presence
 * is the absence of a row, so there is nothing left to fill in: the two pupils
 * the teacher tapped are already recorded, and everybody else is present by
 * saying so. What the button means is "I have finished", and that is exactly
 * what closing the séance records.
 *
 * The lesson is still resolved through `findRegister`, which checks it against
 * the teacher's own assignments — so the séance this closes is the school's,
 * never the request's.
 */
const schema = z.object({
  schoolClassId: z.string().min(1),
  subjectId: z.string().min(1).nullish(),
  timeSlotId: z.string().min(1).nullish(),
  date: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown lesson.", 400);
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) {
    return apiError("invalid_request", "Invalid date.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK);
    }

    const ref = {
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId ?? null,
      timeSlotId: parsed.data.timeSlotId ?? null,
      date,
    };

    const register = await findRegister(context, ref);
    if (!register) return null;

    const result = await saveSession({
      teacherId: context.user.id,
      schoolId: currentSchoolId(context),
      actsForSchool: context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY),
      // "The rest are here" is the end of the appel, so this is the call that
      // closes the séance — see `saveSession`.
      close: true,
      ...ref,
      // No marks: whoever was away has already been tapped, and everybody else
      // is recorded by not being.
      marks: [],
    });
    if (!result.ok) return null;

    const after = await findRegister(context, ref);
    if (!after) return null;

    return { ...after, canMark: true };
  });
}

export { preflight as OPTIONS };
