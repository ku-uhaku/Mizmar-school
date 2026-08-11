import type { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError } from "@/lib/dal";
import { apiError, preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { NOTES_MAX } from "@/modules/assessments/enums";
import { listAssessments } from "@/modules/assessments/queries";
import { createDevoir } from "@/modules/assessments/service";

/**
 * The teacher's own papers — devoirs they set and contrôles they have to mark.
 *
 * Confined to `teacherId: context.user.id` here rather than filtered on the
 * phone: "my marking" is the whole point of the list, and a colleague's papers
 * must not travel to the device only to be hidden by it.
 *
 * `kind` splits the two the same way the web workspace does, on
 * `AssessmentType.allowTeacherCreate` — so the list a teacher opens to mark
 * contrôles never mixes in the devoirs they set themselves.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const kindParam = params.get("kind");
  const kind =
    kindParam === "DEVOIR" || kindParam === "CONTROLE" ? kindParam : undefined;

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.ASSESSMENT_GRADE)) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    return listAssessments(context, {
      teacherId: context.user.id,
      ...(kind ? { kind } : {}),
      // What is still the teacher's to do something about: a GRADED paper is
      // finished and a DRAFT has not been announced.
      statuses: ["PUBLISHED", "SUBMITTED"],
      take: 100,
    });
  });
}

/**
 * Setting a piece of work from the phone.
 *
 * Only the kinds the school marks `allowTeacherCreate` can be set here, which
 * `createDevoir` re-checks rather than trusting the picker — so whether a
 * teacher may set a contrôle as well as a devoir stays a school policy in the
 * configuration, not a decision this route makes.
 *
 * No question editor: a barème is typed at a desk, and the paper can gain one
 * later on the web. The mark sheet does not need it.
 */
const createSchema = z.object({
  schoolClassId: z.string().min(1),
  subjectId: z.string().min(1),
  termId: z.string().min(1),
  assessmentTypeId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(NOTES_MAX).nullish(),
  scheduledOn: z.string().min(1),
  maxScore: z.number().int().min(1).max(100),
  coefficient: z.number().int().min(1).max(20),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Unknown assessment.", 400);
  }

  const scheduledOn = new Date(parsed.data.scheduledOn);
  if (Number.isNaN(scheduledOn.getTime())) {
    return apiError("invalid_request", "Invalid date.", 400);
  }

  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.ASSESSMENT_GRADE)) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    const schoolId = context.currentSchool?.id;
    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolId || !schoolYearId) return null;

    const result = await createDevoir({
      authorId: context.user.id,
      schoolId,
      schoolYearId,
      // The office half of the pair — see the note on `createDevoir`.
      actsForSchool: context.can(PERMISSIONS.ASSESSMENT_MANAGE),
      schoolClassId: parsed.data.schoolClassId,
      subjectId: parsed.data.subjectId,
      termId: parsed.data.termId,
      assessmentTypeId: parsed.data.assessmentTypeId,
      title: parsed.data.title,
      notes: parsed.data.notes?.trim() || null,
      scheduledOn,
      maxScore: parsed.data.maxScore,
      coefficient: parsed.data.coefficient,
      questions: [],
    });

    // The refusal travels in the body rather than as a status code: "you do not
    // teach that class" and "the term is closed" are different problems the
    // screen words differently, and `withAuth` turns a null into a bare 404
    // that could say neither.
    if (!result.ok) return { ok: false as const, reason: result.reason };

    return { ok: true as const, assessmentId: result.assessmentId };
  });
}

export { preflight as OPTIONS };
