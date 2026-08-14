"use client";

import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/action-state";
import { saveMassarCodeAction } from "@/modules/assessments/actions";

/**
 * The MASSAR sheet this paper answers for.
 *
 * ── Why a school would ever type this ───────────────────────────────────────
 * Normally it does not. The import reads the code out of the file's hidden
 * `E5` and stamps it, and a paper with no code is precisely what lets the first
 * NotesCC export claim it. This box is for the one case that flow cannot reach:
 * a contrôle the school set itself which they already hold the ministry's sheet
 * for, and which has to be paired before the marks can be sent back.
 *
 * Shown only to whoever may manage papers, and only on the paper's own screen —
 * it is a property of this one contrôle, not something to set in bulk.
 */
export function MassarCodeCard({
  assessmentId,
  massarCode,
}: {
  assessmentId: string;
  /** Null when the paper is still adoptable by any sheet that names it. */
  massarCode: string | null;
}) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(saveMassarCodeAction, IDLE);
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t.assessment.massarCode}</CardTitle>
        <CardDescription>{t.assessment.massarCodeHint}</CardDescription>
        <div className="ms-auto">
          {/* Which of the two states this paper is in, said plainly: a blank
              one is not incomplete, it is adoptable. */}
          <Badge variant="outline">
            {massarCode ? t.assessment.massarPaired : t.assessment.massarAdoptable}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={assessmentId} />

          <FormField
            name="massarCode"
            label={t.assessment.massarCode}
            error={errors.massarCode}
            className="min-w-56 flex-1"
          >
            <Input
              {...controlProps("massarCode", errors.massarCode)}
              defaultValue={massarCode ?? ""}
              placeholder="######"
              dir="ltr"
            />
          </FormField>

          <SubmitButton variant="outline">{t.common.save}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
