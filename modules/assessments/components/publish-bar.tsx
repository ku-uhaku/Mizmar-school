"use client";

import * as React from "react";
import { CheckCircle2Icon, SendIcon, UndoIcon } from "lucide-react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { IDLE } from "@/lib/action-state";
import { setAssessmentStatusAction } from "@/modules/assessments/actions";

/**
 * Where a paper is, and the one move available from here.
 *
 * Publishing is what opens mark entry, so this sits above the sheet rather than
 * in a menu: a teacher who cannot type a mark needs to see *why* without going
 * looking. Withdrawing back to draft is offered only while nothing has been
 * entered — the action refuses it afterwards, and an enabled button that always
 * fails is worse than no button.
 */
export function PublishBar({
  assessmentId,
  status,
  teacherName,
  canPublish,
}: {
  assessmentId: string;
  status: string;
  teacherName: string | null;
  canPublish: boolean;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    setAssessmentStatusAction,
    IDLE,
  );
  useActionFeedback(state);

  const message =
    status === "DRAFT"
      ? t.assessment.notPublished
      : status === "GRADED"
        ? t.assessment.markSheet
        : null;

  // Nothing to say and nothing to do — do not take up the room.
  if (!canPublish && !message) return null;

  return (
    <Card className="gap-0 py-3">
      <CardContent className="flex flex-wrap items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          {message ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {message}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {teacherName ?? t.assessment.noTeacher}
          </p>
        </div>

        {canPublish ? (
          <form action={formAction} className="flex gap-2">
            <input type="hidden" name="id" value={assessmentId} />

            {status === "DRAFT" ? (
              <>
                <input type="hidden" name="status" value="PUBLISHED" />
                <SubmitButton size="sm">
                  <SendIcon />
                  {t.assessment.publish}
                </SubmitButton>
              </>
            ) : status === "PUBLISHED" ? (
              <>
                <input type="hidden" name="status" value="GRADED" />
                <SubmitButton size="sm" variant="outline">
                  <CheckCircle2Icon />
                  {t.assessmentOptions.statuses.GRADED}
                </SubmitButton>
              </>
            ) : status === "GRADED" ? (
              <>
                <input type="hidden" name="status" value="PUBLISHED" />
                <SubmitButton size="sm" variant="outline">
                  <UndoIcon />
                  {t.assessmentOptions.statuses.PUBLISHED}
                </SubmitButton>
              </>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
