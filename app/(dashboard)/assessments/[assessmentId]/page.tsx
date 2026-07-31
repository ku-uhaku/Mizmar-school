import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/dal";
import { formatDate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { StatusBadge } from "@/modules/assessments/components/assessments-manager";
import { MarkSheet } from "@/modules/assessments/components/mark-sheet";
import { PublishBar } from "@/modules/assessments/components/publish-bar";
import { acceptsMarks } from "@/modules/assessments/enums";
import { findMarkSheet } from "@/modules/assessments/queries";

export const metadata: Metadata = { title: "Feuille de notes" };

/**
 * One paper and its mark sheet.
 *
 * Thin by the usual rule — it authorizes, calls the module's read and renders.
 * Mark entry is gated twice on purpose: the permission decides whether this
 * reader may ever enter a mark, and the paper's own status decides whether
 * *anybody* may right now. A draft has not been sat.
 */
export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.ASSESSMENT_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the school and year in context; a paper from elsewhere reads as
  // absent rather than forbidden, so its existence cannot be probed.
  const sheet = await findMarkSheet(context, assessmentId);
  if (!sheet) notFound();

  const { assessment } = sheet;

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={`${assessment.subjectName} · ${assessment.classCode}${
          assessment.groupLabel ? ` · ${assessment.groupLabel}` : ""
        }`}
        backHref={`/assessments?class=${assessment.classId}&term=${assessment.termId}`}
        backLabel={t.assessment.title}
      >
        <StatusBadge status={assessment.status} />
        <Badge variant="secondary">{assessment.typeName}</Badge>
        <Badge variant="outline">
          /{assessment.maxScore} · ×{assessment.coefficient}
        </Badge>
        {assessment.scheduledOn ? (
          <Badge variant="outline">
            {formatDate(assessment.scheduledOn, locale)}
          </Badge>
        ) : null}
      </PageHeader>

      <div className="grid gap-4">
        <PublishBar
          assessmentId={assessment.id}
          status={assessment.status}
          teacherName={assessment.teacherName}
          canPublish={context.can(PERMISSIONS.ASSESSMENT_PUBLISH)}
        />

        <MarkSheet
          sheet={sheet}
          // Both gates: the reader's permission, and whether the paper is open
          // to marks at all.
          canGrade={
            context.can(PERMISSIONS.ASSESSMENT_GRADE) &&
            acceptsMarks(assessment.status)
          }
        />
      </div>
    </>
  );
}
