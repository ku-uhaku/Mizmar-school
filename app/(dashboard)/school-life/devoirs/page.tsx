import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { DevoirsReview } from "@/modules/assessments/components/devoirs-review";
import {
  ASSESSMENT_PAGE_SIZE,
  statusesForStage,
} from "@/modules/assessments/enums";
import {
  listAssessmentFilterChoices,
  listAssessments,
  listTerms,
} from "@/modules/assessments/queries";

export const metadata: Metadata = { title: "Devoirs" };

/**
 * The devoirs teachers have set, seen from the direction.
 *
 * Thin, as every page is: authorize, call the module's queries, render. The
 * filters arrive as query parameters and go straight into the read — see
 * `DevoirsReview` on why they are not applied in the browser.
 *
 * Gated on the view code rather than the publish one, unlike the remarks review
 * beside it. Releasing a remark to a family is the whole purpose of that screen;
 * this one answers a question a head of studies has without being able to
 * validate anything — how much homework is being set, by whom, and in which
 * classes. The accept button is the part that needs `assessment.publish`, and it
 * is only rendered for whoever holds it.
 */
export default async function SchoolLifeDevoirsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.ASSESSMENT_VIEW)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;
  const one = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const filters = {
    search: one("q"),
    teacherId: one("teacher"),
    schoolClassId: one("class"),
    subjectId: one("subject"),
    termId: one("term"),
    stage: one("stage"),
  };

  // An unrecognised stage leaves the list unfiltered rather than empty — see
  // `statusesForStage`.
  const statuses = filters.stage ? statusesForStage(filters.stage) : [];

  const [assessments, choices, terms] = await Promise.all([
    listAssessments(context, {
      kind: "DEVOIR",
      search: filters.search || undefined,
      teacherId: filters.teacherId || undefined,
      classId: filters.schoolClassId || undefined,
      subjectId: filters.subjectId || undefined,
      termId: filters.termId || undefined,
      statuses: statuses.length > 0 ? statuses : undefined,
      recentFirst: true,
      take: ASSESSMENT_PAGE_SIZE,
    }),
    listAssessmentFilterChoices(context, { kind: "DEVOIR" }),
    listTerms(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.assessment.devoirsReview}
        description={t.assessment.devoirsReviewHint}
      />

      <DevoirsReview
        assessments={assessments}
        choices={choices}
        terms={terms}
        filters={filters}
        canValidate={context.can(PERMISSIONS.ASSESSMENT_PUBLISH)}
      />
    </>
  );
}
