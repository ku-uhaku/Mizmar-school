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
 *
 * ── The handshake ───────────────────────────────────────────────────────────
 * Once a paper is published there are two people waiting on each other, and the
 * bar's job is to say which one. The teacher marks and hands it back
 * (SUBMITTED); the office reads it and accepts (GRADED). Each sees only their
 * own move plus a line saying what the other is waiting for — a teacher offered
 * an "accept" button they may not press learns nothing from it being there.
 */
export function PublishBar({
  assessmentId,
  status,
  teacherName,
  canPublish,
  canGrade,
  isMine,
  isDevoir,
}: {
  assessmentId: string;
  status: string;
  teacherName: string | null;
  /** The office's codes: announce a paper, accept its marks, cancel it. */
  canPublish: boolean;
  /** May enter marks at all — the teacher's half of the pair. */
  canGrade: boolean;
  /** This reader is the teacher answerable for the paper. */
  isMine: boolean;
  /** A paper the teacher set themselves — nobody validates it. */
  isDevoir: boolean;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    setAssessmentStatusAction,
    IDLE,
  );
  useActionFeedback(state);

  // Only the teacher of the paper hands it in, and only while it is open to
  // them. The office never does it on their behalf — see ASSESSMENT_STATUSES.
  const canSubmit =
    canGrade &&
    isMine &&
    !isDevoir &&
    (status === "PUBLISHED" || status === "SUBMITTED");

  const message =
    status === "DRAFT"
      ? t.assessment.notPublished
      : status === "SUBMITTED"
        ? canPublish
          ? t.assessment.awaitingYourValidation
          : t.assessment.awaitingValidation
        : status === "GRADED"
          ? t.assessment.markSheet
          : null;

  // Nothing to say and nothing to do — do not take up the room.
  if (!canPublish && !canSubmit && !message) return null;

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

        {/* One form per move, because each posts a different target status and
            a nested form is not a thing. */}
        <div className="flex flex-wrap gap-2">
          {canSubmit ? (
            <form action={formAction}>
              <input type="hidden" name="id" value={assessmentId} />
              <input
                type="hidden"
                name="status"
                value={status === "SUBMITTED" ? "PUBLISHED" : "SUBMITTED"}
              />
              <SubmitButton
                size="sm"
                variant={status === "SUBMITTED" ? "outline" : "default"}
              >
                {status === "SUBMITTED" ? <UndoIcon /> : <SendIcon />}
                {status === "SUBMITTED"
                  ? t.assessment.takeBack
                  : t.assessment.submitMarks}
              </SubmitButton>
            </form>
          ) : null}

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
              ) : status === "PUBLISHED" || status === "SUBMITTED" ? (
                <>
                  <input type="hidden" name="status" value="GRADED" />
                  <SubmitButton
                    size="sm"
                    // The office's move is the primary one once the teacher has
                    // handed the paper back, and secondary before that.
                    variant={status === "SUBMITTED" ? "default" : "outline"}
                  >
                    <CheckCircle2Icon />
                    {t.assessment.acceptMarks}
                  </SubmitButton>
                </>
              ) : status === "GRADED" ? (
                <>
                  <input type="hidden" name="status" value="PUBLISHED" />
                  <SubmitButton size="sm" variant="outline">
                    <UndoIcon />
                    {t.assessment.reopen}
                  </SubmitButton>
                </>
              ) : null}
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
