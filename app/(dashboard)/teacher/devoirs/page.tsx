import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { defaultDateWithin } from "@/lib/school-year";
import {
  listAssessmentTypes,
  listAssessments,
  listTerms,
} from "@/modules/assessments/queries";
import { DevoirsManager } from "@/modules/classroom/components/devoirs-manager";
import { listMyTeaching } from "@/modules/classroom/queries";

export const metadata: Metadata = { title: "Devoirs" };

/**
 * The work this teacher has set.
 *
 * Their own papers only, and only the kinds the school lets a teacher set —
 * contrôles are planned by the head of studies and live on `/assessments`.
 * Both halves of that split are `where` clauses, not a check on the page.
 */
export default async function TeacherDevoirsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
    return <ForbiddenState />;
  }

  const [devoirs, teaching, terms, types] = await Promise.all([
    listAssessments(context, {
      teacherId: context.user.id,
      kind: "DEVOIR",
    }),
    listMyTeaching(context),
    listTerms(context),
    // Only what the school has opened to teachers — see AssessmentType.
    listAssessmentTypes(context, { teacherCreatableOnly: true }),
  ]);

  return (
    <>
      <PageHeader
        title={t.classroom.devoirs}
        description={t.classroom.devoirsHint}
        backHref="/teacher"
        backLabel={t.classroom.title}
      />

      <DevoirsManager
        defaultDate={defaultDateWithin(context.currentSchoolYear)}
        devoirs={devoirs}
        teaching={teaching}
        terms={terms}
        types={types}
        canCreate={context.can(PERMISSIONS.ASSESSMENT_GRADE)}
      />
    </>
  );
}
