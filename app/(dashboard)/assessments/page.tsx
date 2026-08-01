import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { defaultDateWithin } from "@/lib/school-year";
import { AssessmentsManager } from "@/modules/assessments/components/assessments-manager";
import {
  listAssessableClasses,
  listAssessmentTypes,
  listAssessments,
  listTerms,
  loadProgrammesByClass,
} from "@/modules/assessments/queries";

export const metadata: Metadata = { title: "Contrôles" };

/**
 * The contrôles of one class and term.
 *
 * The pair travels in the query string rather than in component state: what a
 * class is sitting is a permission-scoped server read, so keeping it in the
 * address means a reload lands on the same round. Both ids are only ever
 * *hints* — the queries scope them to the school and year in context, so one
 * from elsewhere simply matches nothing.
 */
export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.ASSESSMENT_VIEW)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;

  const [classes, terms, types, programmes] = await Promise.all([
    listAssessableClasses(context),
    listTerms(context),
    listAssessmentTypes(context),
    // Every class's marked subjects, so the generator's picker fills in the
    // moment a class is chosen rather than after a round trip.
    loadProgrammesByClass(context),
  ]);

  // Default to the first class and the term that is actually running, which is
  // what somebody opening this screen in November is looking for.
  const selectedClass =
    classes.find((option) => option.id === params.class) ?? classes[0] ?? null;
  const selectedTerm =
    terms.find((term) => term.id === params.term) ??
    terms.find((term) => term.status === "ACTIVE") ??
    terms[0] ??
    null;

  const assessments = selectedClass
    ? await listAssessments(context, {
        classId: selectedClass.id,
        termId: selectedTerm?.id,
      })
    : [];

  return (
    <>
      <PageHeader
        title={t.assessment.title}
        description={t.assessment.subtitle}
      />

      <AssessmentsManager
        defaultDate={defaultDateWithin(context.currentSchoolYear)}
        assessments={assessments}
        classes={classes}
        terms={terms}
        types={types}
        programmes={programmes}
        classId={selectedClass?.id ?? null}
        termId={selectedTerm?.id ?? null}
        permissions={{
          canManage: context.can(PERMISSIONS.ASSESSMENT_MANAGE),
          canDelete: context.can(PERMISSIONS.ASSESSMENT_DELETE),
        }}
      />
    </>
  );
}
