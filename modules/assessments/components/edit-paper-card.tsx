"use client";

import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { saveAssessmentAction } from "@/modules/assessments/actions";
import { MAX_SEQUENCE, NOTES_MAX } from "@/modules/assessments/enums";
import type { MarkSheet } from "@/modules/assessments/queries";

/**
 * The paper's own particulars, corrected after it was set: its title, when it
 * is sat, the scale and weight, and what it covers.
 *
 * ── Why the whole form and not just the date ────────────────────────────────
 * The generator writes a term's contrôles in September from the school's
 * defaults, and every one of them is a guess: the date is a placeholder, the
 * title is "Contrôle n°2" until somebody knows what is on it, and the barème is
 * the kind's rather than this paper's. Correcting one of those without the
 * others would mean deleting the paper and generating it again, which is how a
 * mark sheet loses the questions typed against it.
 *
 * ── Why it disappears once published ────────────────────────────────────────
 * Rendered only while `acceptsEdits` — see the reasoning there. The card going
 * away is the screen saying the same thing the action would: the announcement
 * has been made, and unmaking it is `PublishBar`'s deliberate step back to
 * draft, not a quiet save here.
 *
 * The kind, the class and the subject are deliberately absent. Those are what a
 * paper *is* — changing them makes it a different paper, and the unique index
 * on Assessment is what would then refuse it. Set that one instead.
 */
export function EditPaperCard({
  assessment,
}: {
  assessment: MarkSheet["assessment"];
}) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(saveAssessmentAction, IDLE);
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t.assessment.editAssessment}</CardTitle>
        <CardDescription className="text-pretty">
          {t.assessment.editAssessmentHint}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={assessment.id} />

          <FormField
            name="title"
            label={t.assessment.paperTitle}
            error={errors.title}
            required
          >
            <Input
              {...controlProps("title", errors.title)}
              defaultValue={valueOf(state, "title", assessment.title)}
              maxLength={160}
            />
          </FormField>

          <FormField
            name="notes"
            label={t.assessment.covers}
            hint={t.assessment.coversHint}
            error={errors.notes}
          >
            <Textarea
              {...controlProps("notes", errors.notes, t.assessment.coversHint)}
              defaultValue={valueOf(state, "notes", assessment.notes ?? "")}
              maxLength={NOTES_MAX}
              rows={2}
              placeholder={t.assessment.coversPlaceholder}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Blank is a real answer, not an omission: a round generated in
              September is dated later, and `scheduledOn` is nullable for it. */}
            <FormField
              name="scheduledOn"
              label={t.assessment.scheduledOn}
              error={errors.scheduledOn}
            >
              <Input
                {...controlProps("scheduledOn", errors.scheduledOn)}
                type="date"
                defaultValue={valueOf(
                  state,
                  "scheduledOn",
                  assessment.scheduledOn ?? "",
                )}
                dir="ltr"
              />
            </FormField>

            <FormField
              name="sequence"
              label={t.assessment.sequence}
              hint={t.assessment.sequenceHint}
              error={errors.sequence}
              required
            >
              <Input
                {...controlProps("sequence", errors.sequence, t.assessment.sequenceHint)}
                type="number"
                min={1}
                max={MAX_SEQUENCE}
                defaultValue={valueOf(
                  state,
                  "sequence",
                  String(assessment.sequence),
                )}
                dir="ltr"
              />
            </FormField>

            <FormField
              name="maxScore"
              label={t.assessment.maxScore}
              error={errors.maxScore}
              required
            >
              <Input
                {...controlProps("maxScore", errors.maxScore)}
                type="number"
                min={1}
                max={100}
                defaultValue={valueOf(
                  state,
                  "maxScore",
                  String(assessment.maxScore),
                )}
                dir="ltr"
              />
            </FormField>

            <FormField
              name="coefficient"
              label={t.assessment.coefficient}
              hint={t.assessment.coefficientHint}
              error={errors.coefficient}
              required
            >
              <Input
                {...controlProps(
                  "coefficient",
                  errors.coefficient,
                  t.assessment.coefficientHint,
                )}
                type="number"
                min={1}
                max={20}
                defaultValue={valueOf(
                  state,
                  "coefficient",
                  String(assessment.coefficient),
                )}
                dir="ltr"
              />
            </FormField>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="countsTowardAverage">
                {t.assessment.countsTowardAverage}
              </Label>
              <p className="text-muted-foreground text-xs text-pretty">
                {t.assessment.countsTowardAverageHint}
              </p>
            </div>
            <Switch
              id="countsTowardAverage"
              name="countsTowardAverage"
              defaultChecked={checkedOf(
                state,
                "countsTowardAverage",
                assessment.countsTowardAverage,
              )}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton variant="outline">{t.common.save}</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
