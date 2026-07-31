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
 * Each step is a button that opens the tab which resolves it, so the answer to
 * "what is missing" is one click from the thing that fixes it rather than a
 * label the reader then has to act on themselves. Steps after the first gap are
 * drawn as pending rather than as errors — a file opened this morning is not
 * wrong for having no fees yet.
 *
 * `steps` is narrowed by the caller rather than always being the full list:
 * whether a family is behind on its payments is money, and a teacher who may
 * view a pupil has no business reading it off their parcours.
 */
export function StudentWorkflow({
  state,
  steps = STUDENT_WORKFLOW_STEPS,
  onStepSelect,
}: {
  state: Record<StudentWorkflowStep, boolean>;
  steps?: readonly StudentWorkflowStep[];
  /** Opens the tab that resolves a step. */
  onStepSelect?: (step: StudentWorkflowStep) => void;
}) {
  const t = useT();
  const next = nextWorkflowStep(state, steps);
  const doneCount = steps.filter((step) => state[step]).length;
  const complete = next === null;

  return (
    <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t.student.workflow}
        </h2>
        {complete ? (
          <Badge className="bg-success text-background hover:bg-success">
            {t.student.workflowComplete}
          </Badge>
        ) : (
          <Badge variant="secondary">
            {interpolate(t.student.nextStep, { step: t.student.steps[next] })}
          </Badge>
        )}
        <span className="text-muted-foreground ms-auto text-xs tabular-nums">
          {interpolate(t.student.stepsDone, {
            done: doneCount,
            total: steps.length,
          })}
        </span>
      </div>

      {/*
        Scrolls rather than wraps below `sm`: a parcours that reflows into three
        ragged rows stops reading as a sequence, which is the only thing it is
        for. The rail underneath carries the same progress for a narrow screen
        that only shows part of it.
      */}
      <ol className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
        {steps.map((step, index) => {
          const done = state[step];
          const isNext = step === next;

          return (
            <li key={step} className="flex min-w-0 shrink-0 items-center gap-1">
              <StepButton
                label={t.student.steps[step]}
                index={index}
                done={done}
                isNext={isNext}
                onSelect={onStepSelect ? () => onStepSelect(step) : undefined}
              />

              {/* Connector, omitted after the last step. */}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-1 hidden h-px w-5 shrink-0 sm:block",
                    done ? "bg-success" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div
        className="bg-muted mt-3 h-1 overflow-hidden rounded-full sm:hidden"
        role="img"
        aria-label={interpolate(t.student.stepsDone, {
          done: doneCount,
          total: steps.length,
        })}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            complete ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * One step. A button when the caller can act on it, a plain span otherwise —
 * rendering a dead button would offer an affordance that does nothing.
 */
function StepButton({
  label,
  index,
  done,
  isNext,
  onSelect,
}: {
  label: string;
  index: number;
  done: boolean;
  isNext: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors",
          done && "bg-success text-background",
          !done && isNext && "ring-primary text-primary ring-2",
          !done && !isNext && "bg-muted text-muted-foreground",
        )}
      >
        {done ? <CheckIcon className="size-3.5" /> : index + 1}
      </span>
      <span
        className={cn(
          "truncate text-sm",
          done && "font-medium",
          !done && isNext && "text-primary font-medium",
          !done && !isNext && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </>
  );

  if (!onSelect) {
    return <span className="flex min-w-0 items-center gap-2 px-1">{body}</span>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="hover:bg-muted/60 focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md px-1 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {body}
    </button>
  );
}
