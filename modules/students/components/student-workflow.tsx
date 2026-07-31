"use client";

import { CheckIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { interpolate } from "@/lib/i18n/format";
import {
  nextWorkflowStep,
  STUDENT_WORKFLOW_STEPS,
  type StudentWorkflowStep,
} from "@/modules/students/enums";

/**
 * The parcours: file → family → enrolment → class → fees → up to date.
 *
 * Its job is to answer "what is missing on this child?" at a glance, which is
 * the question a secretary actually has in front of them. Every step is read
 * from the rows (see `loadStudentWorkflow`), so it cannot claim a pupil is
 * billed when no schedule exists.
 *
 * Steps after the first gap are drawn as pending rather than as errors — a file
 * opened this morning is not wrong for having no fees yet.
 *
 * `steps` is narrowed by the caller rather than always being the full list:
 * whether a family is behind on its payments is money, and a teacher who may
 * view a pupil has no business reading it off their parcours.
 */
export function StudentWorkflow({
  state,
  steps = STUDENT_WORKFLOW_STEPS,
}: {
  state: Record<StudentWorkflowStep, boolean>;
  steps?: readonly StudentWorkflowStep[];
}) {
  const t = useT();
  const next = nextWorkflowStep(state, steps);

  return (
    <div className="bg-card rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t.student.workflow}
        </h2>
        {next ? (
          <Badge variant="secondary">
            {interpolate(t.student.nextStep, { step: t.student.steps[next] })}
          </Badge>
        ) : (
          <Badge>{t.student.workflowComplete}</Badge>
        )}
      </div>

      <ol className="flex flex-wrap items-center gap-x-1 gap-y-3">
        {steps.map((step, index) => {
          const done = state[step];
          const isNext = step === next;

          return (
            <li key={step} className="flex min-w-0 items-center gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors",
                    done && "bg-primary text-primary-foreground",
                    !done && isNext && "ring-primary text-primary ring-2",
                    !done && !isNext && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    done ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {t.student.steps[step]}
                </span>
              </div>

              {/* Connector, omitted after the last step. */}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 hidden h-px w-6 shrink-0 sm:block",
                    done ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
