import type { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/dal";
import { preflight, withAuth } from "@/lib/mobile-api";
import { PERMISSIONS } from "@/lib/permissions";
import { listAssessmentTypes, listTerms } from "@/modules/assessments/queries";
import { listMyTeaching } from "@/modules/classroom/queries";

/**
 * Everything the "set a piece of work" form has to offer, in one call.
 *
 * The classes come from `listMyTeaching` rather than the school's class list:
 * the form may only offer what the teacher actually teaches, and each row
 * already pairs a class with the subject it is taught for — which is the pair
 * `createDevoir` re-derives against their assignments anyway.
 *
 * `teacherCreatableOnly` is what decides whether a contrôle can be set here at
 * all. That is the school's policy in `AssessmentType.allowTeacherCreate`, not
 * a rule this route invents, so a school that lets its teachers set contrôles
 * gets them in the picker and one that does not never sees them.
 */
export async function GET(): Promise<NextResponse> {
  return withAuth(async (context) => {
    if (!context.can(PERMISSIONS.ASSESSMENT_GRADE)) {
      throw new ForbiddenError(PERMISSIONS.ASSESSMENT_GRADE);
    }

    const [types, terms, teaching] = await Promise.all([
      listAssessmentTypes(context, { teacherCreatableOnly: true }),
      listTerms(context),
      listMyTeaching(context),
    ]);

    return { types, terms, teaching };
  });
}

export { preflight as OPTIONS };
