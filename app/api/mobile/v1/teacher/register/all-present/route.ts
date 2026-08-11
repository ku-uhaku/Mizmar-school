import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolId } from "@/lib/scope";
import { findRegister } from "@/modules/classroom/queries";
import { saveRegister } from "@/modules/classroom/service";

/**
 * "Les autres sont là" — every pupil not yet marked, recorded present.
 *
 * ── Why it only touches the unmarked ────────────────────────────────────────
 * In a class of thirty, two are away. The phone's flow is to tap those two and
 * then say the rest turned up, so this fills the gaps rather than resetting the
 * sheet: a teacher who has already marked a retard must not lose it by pressing
 * the button that finishes the register. The web sheet resets everybody because
 * there the whole grid is in front of you and the save is one deliberate act;
 * here each tap has already been written, so overwriting them would be
 * destroying work rather than defaulting it.
 *
 * The roster comes from `findRegister`, which resolves the lesson against the
 * teacher's own assignments — so the ids this writes are the school's, never
 * the request's.
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

    const unmarked = register.pupils.filter((pupil) => pupil.status === null);
    if (unmarked.length === 0) {
      return { ...register, canMark: true };
    }

    const result = await saveRegister({
      teacherId: context.user.id,
      schoolId: currentSchoolId(context),
      actsForSchool: context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY),
      ...ref,
      marks: unmarked.map((pupil) => ({
        enrollmentId: pupil.enrollmentId,
        status: "PRESENT",
        minutesLate: null,
        reason: null,
      })),
    });
    if (!result.ok) return null;

    const after = await findRegister(context, ref);
    if (!after) return null;

    return { ...after, canMark: true };
  });
}

export { preflight as OPTIONS };
