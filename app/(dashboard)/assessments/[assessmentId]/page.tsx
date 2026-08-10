import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { formatDate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { StatusBadge } from "@/modules/assessments/components/assessments-manager";
import { MarkSheet } from "@/modules/assessments/components/mark-sheet";
import { PaperCard } from "@/modules/assessments/components/paper-card";
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
          canGrade={context.can(PERMISSIONS.ASSESSMENT_GRADE)}
          // Whose marking this is. Handing a paper back is the one move the
          // office cannot make for the teacher, so the bar has to know.
          isMine={sheet.isMine}
          isDevoir={sheet.isDevoir}
        />

        {/* What the paper covers — "leçon 3, p.42". Above the questions, since
            it is the thing the class was told and the questions are what came
            of it. Absent rather than empty when nothing was written. */}
        {assessment.notes ? (
          <Card className="gap-2 py-4">
            <CardHeader className="gap-1">
              <CardTitle className="text-base">
                {t.assessment.covers}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{assessment.notes}</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Above the roster: the paper is what the marks are marks *of*, and a
            teacher opening this to grade wants to reread it first. */}
        <PaperCard
          questions={sheet.questions}
          total={sheet.questionsTotal}
          maxScore={assessment.maxScore}
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
