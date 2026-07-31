"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IDLE } from "@/lib/action-state";
import { saveSingletonAction } from "@/modules/configuration/actions";
import { ResourceField } from "@/modules/configuration/components/resource-dialog";
import type { ResourceDef, ResourceRow } from "@/modules/configuration/types";

/**
 * A singleton resource, as a page rather than a dialog.
 *
 * The list resources are lists you scan and correct, so they get a table and a
 * modal. This one is a page of policy you read top to bottom and change one
 * line of once a year, which wants the opposite: everything visible at once,
 * grouped, with one save at the end.
 *
 * The controls are the *same* `ResourceField` the dialog renders, so a field
 * type added for one is available to the other and neither can drift.
 */
export function SettingsForm({
  resource,
  row,
  canManage,
}: {
  resource: ResourceDef;
  /** Null when the school has never saved — fields fall back to their defaults. */
  row: ResourceRow | null;
  canManage: boolean;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveSingletonAction, IDLE);
  useActionFeedback(state);

  const errors = state.fieldErrors ?? {};
  const labels = t.configuration.fields as Record<string, string>;
  const hints = t.configuration.hints as Record<string, string>;
  const groups = t.configuration.groups as Record<string, string>;

  // Declaration order, not alphabetical: `resources.ts` puts the grading scale
  // before the matricule formats because that is the order a head of school
  // thinks about them in.
  const groupOrder: string[] = [];
  for (const field of resource.fields) {
    const key = field.groupKey ?? "other";
    if (!groupOrder.includes(key)) groupOrder.push(key);
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="__resource" value={resource.id} />

      {/* A reader without CONFIGURATION_MANAGE still sees the policy — knowing
          the pass mark is 10 is not the same as being allowed to move it — but
          a disabled fieldset takes every control out of the tab order, so the
          screen cannot be filled in and posted. The action re-checks anyway. */}
      <fieldset disabled={!canManage} className="grid gap-4">
        {groupOrder.map((groupKey) => (
          <Card key={groupKey} className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">
                {groups[groupKey] ?? groupKey}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {resource.fields
                .filter((field) => (field.groupKey ?? "other") === groupKey)
                .map((field) => (
                  <ResourceField
                    key={field.name}
                    field={field}
                    row={row ?? undefined}
                    choices={[]}
                    error={errors[field.name]}
                    label={labels[field.labelKey] ?? field.labelKey}
                    hint={field.hintKey ? hints[field.hintKey] : undefined}
                    noneLabel={t.common.none}
                  />
                ))}
            </CardContent>
          </Card>
        ))}
      </fieldset>

      {canManage ? (
        <div className="flex justify-end">
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
