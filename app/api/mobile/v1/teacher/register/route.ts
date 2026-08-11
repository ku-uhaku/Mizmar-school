import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, dateParam, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolId } from "@/lib/scope";
import { ATTENDANCE_STATUSES } from "@/modules/classroom/enums";
import { findRegister } from "@/modules/classroom/queries";
import { saveRegister } from "@/modules/classroom/service";

/**
 * One lesson's register, mirroring `app/(dashboard)/teacher/attendance/page.tsx`:
 * the class, subject, period and day all travel as query params / body fields
 * rather than a single lesson id, because `findRegister` already re-derives
 * ownership from them against the signed-in teacher's own assignments — a
 * timetable entry id would only be one more hop to the same check.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const schoolClassId = params.get("schoolClassId");
  if (!schoolClassId) {
    return apiError("invalid_request", "Missing lesson.", 400);
  }

  const ref = {
    schoolClassId,
    subjectId: params.get("subjectId") || null,
    timeSlotId: params.get("timeSlotId") || null,
    date: dateParam(params.get("date")),
  };

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW);
    }

    const register = await findRegister(context, ref);
    if (!register) return null;

    return {
      ...register,
      canMark: context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK),
    };
  });
}

/**
 * One pupil, marked. A payload carrying the whole roster would let a save from
 * a stale screen overwrite a mark a colleague — or the same teacher, on
 * another tap — has since made; one mark per call is what `saveRegister`
 * upserts safely regardless of arrival order.
 */
const schema = z.object({
  schoolClassId: z.string().min(1),
  subjectId: z.string().min(1).nullish(),
  timeSlotId: z.string().min(1).nullish(),
  date: z.string().min(1),
  enrollmentId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
  minutesLate: z.number().int().min(0).max(120).nullish(),
  reason: z.string().trim().max(500).nullish(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown mark.", 400);
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) {
    return apiError("invalid_request", "Invalid date.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK)) {
      throw new ForbiddenError(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK);
    }

    const result = await saveRegister({
      teacherId: context.user.id,
      schoolId: currentSchoolId(context),
      // Same rule as the web action: the office half of the attendance pair is
      // what relaxes *which roster*, never which school. See the note at the
      // top of modules/classroom/service.ts.
      actsForSchool: context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY),
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId ?? null,
      timeSlotId: parsed.data.timeSlotId ?? null,
      date,
      marks: [
        {
          enrollmentId: parsed.data.enrollmentId,
          status: parsed.data.status,
          minutesLate: parsed.data.minutesLate ?? null,
          reason: parsed.data.reason?.trim() || null,
        },
      ],
    });
    if (!result.ok) return null;

    // The sheet as it now stands, so the phone re-renders on the server's
    // answer rather than on what it hoped it wrote — same rule as the driver's
    // register endpoint.
    const register = await findRegister(context, {
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId ?? null,
      timeSlotId: parsed.data.timeSlotId ?? null,
      date,
    });
    if (!register) return null;

    return { ...register, canMark: true };
  });
}

export { preflight as OPTIONS };
