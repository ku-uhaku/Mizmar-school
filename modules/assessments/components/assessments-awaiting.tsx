"use client";

import Link from "next/link";
import * as React from "react";
import { ClipboardCheckIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IDLE } from "@/lib/action-state";
import { formatDate } from "@/lib/i18n/format";
import { setAssessmentStatusAction } from "@/modules/assessments/actions";
import type { AssessmentRow } from "@/modules/assessments/queries";

/**
 * Papers a teacher has handed in, waiting on the office to accept them.
 *
 * ── The queue that did not exist ────────────────────────────────────────────
 * Validating a paper was always possible — the control is on the paper's own
 * screen — but there was no list that would take you to one. The screen below
 * this panel shows *contrôles, one class at a time*, and deliberately hides
 * devoirs as the teacher's own business. So a devoir marked and handed in on
 * Friday appeared on nobody's list: the office had to already know it existed
 * to go and accept it, and until they did, its marks stayed invisible to the
 * family.
 *
 * This ignores both of those filters on purpose. A paper waiting on a decision
 * is the office's business whichever class it belongs to and whoever set it.
 *
 * Hidden entirely when the queue is empty — a panel that permanently says
 * "nothing to do" is furniture at the top of a screen people use every day.
 */
export function AssessmentsAwaiting({
  assessments,
}: {
  assessments: AssessmentRow[];
}) {
  const { t, locale } = useI18n();
  const [state, formAction] = React.useActionState(
    setAssessmentStatusAction,
    IDLE,
  );
  useActionFeedback(state);

  if (assessments.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning/5 mb-4">
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardCheckIcon className="text-warning size-4" />
          <span className="text-sm font-medium">
            {t.assessment.validationQueue}
          </span>
          <Badge variant="secondary" className="tabular-nums">
            {assessments.length}
          </Badge>
        </div>

        <ul className="grid gap-2">
          {assessments.map((assessment) => (
            <li
              key={assessment.id}
              className="bg-background flex flex-wrap items-center gap-2 rounded-lg border p-3"
            >
              <Link
                href={`/assessments/${assessment.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="block truncate text-sm font-medium">
                  {assessment.title}
                </span>
                <span className="text-muted-foreground text-xs">
                  {[
                    assessment.classCode,
                    assessment.subjectLabel,
                    assessment.teacherName,
                    assessment.scheduledOn
                      ? formatDate(assessment.scheduledOn, locale)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>

              <Badge variant="outline" className="tabular-nums">
                {assessment.markedCount}/{assessment.rosterCount}
              </Badge>

              {/*
                One form per row rather than one shared one: the paper's id is a
                hidden field, and a single form would need the id swapped in
                before every submit — which is exactly the sort of thing that
                validates the wrong paper when two are pressed quickly.

                Accepting is refused server-side if the sheet is unfinished, and
                the message says so. That check is not repeated here: the office
                pressing it on a paper with two marks missing should be told
                which rule stopped them, not have the button quietly disabled.
              */}
              <form action={formAction}>
                <input type="hidden" name="id" value={assessment.id} />
                <input type="hidden" name="status" value="GRADED" />
                <Button type="submit" size="sm">
                  {t.assessment.acceptMarks}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
