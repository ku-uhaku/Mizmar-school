"use client";

import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import {
  createConfigItemAction,
  updateConfigItemAction,
} from "@/modules/configuration/actions";
import type {
  Choice,
  FieldDef,
  ResourceDef,
  ResourceRow,
} from "@/modules/configuration/types";

/** Blank is a real value for a nullable Select, which cannot hold "". */
const NONE = "none";

/**
 * The create / edit modal, built from the resource's field descriptors.
 *
 * Always a dialog, never a page: configuration is a list you scan and correct,
 * and losing the list to a full-page form on every edit makes that worse.
 */
export function ResourceDialog({
  open,
  onOpenChange,
  resource,
  choices,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ResourceDef;
  choices: Record<string, Choice[]>;
  row?: ResourceRow;
}) {
  const t = useT();
  const isEdit = Boolean(row);

  const [state, formAction] = useActionState(
    isEdit ? updateConfigItemAction : createConfigItemAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const errors = state.fieldErrors ?? {};
  const labels = t.configuration.fields as Record<string, string>;
  const hints = t.configuration.hints as Record<string, string>;
  const resourceName = (t.configuration.resources as Record<string, string>)[
    resource.labelKey
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t.configuration.editItem : t.configuration.newItem}
          </DialogTitle>
          <DialogDescription>{resourceName}</DialogDescription>
        </DialogHeader>

        {/* `key` remounts the form when the target row changes, so defaults are
            re-read instead of the previous row's values sticking. */}
        <form
          key={row?.id ?? "new"}
          action={formAction}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <input type="hidden" name="__resource" value={resource.id} />
          {row ? <input type="hidden" name="id" value={row.id} /> : null}

          <DialogBody className="grid gap-4 py-1 sm:grid-cols-2">
            {resource.fields.map((field) => (
              <ResourceField
                key={field.name}
                field={field}
                row={row}
                choices={choices[field.name] ?? []}
                error={errors[field.name]}
                label={labels[field.labelKey] ?? field.labelKey}
                hint={field.hintKey ? hints[field.hintKey] : undefined}
                noneLabel={t.common.none}
              />
            ))}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <SubmitButton>
              {isEdit ? t.common.save : t.common.create}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResourceField({
  field,
  row,
  choices,
  error,
  label,
  hint,
  noneLabel,
}: {
  field: FieldDef;
  row?: ResourceRow;
  choices: Choice[];
  error?: string;
  label: string;
  hint?: string;
  noneLabel: string;
}) {
  const t = useT();
  const current = row?.[field.name];
  const span = field.wide || field.type === "textarea" ? "sm:col-span-2" : "";

  // A switch reads better as a bordered row with its label than as a form field.
  if (field.type === "boolean") {
    const checked =
      current === null || current === undefined
        ? Boolean(field.defaultValue)
        : Boolean(current);

    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
          span,
        )}
      >
        <div className="space-y-0.5">
          <Label htmlFor={field.name}>{label}</Label>
          {hint ? (
            <p className="text-muted-foreground text-xs">{hint}</p>
          ) : null}
        </div>
        <Switch id={field.name} name={field.name} defaultChecked={checked} />
      </div>
    );
  }

  return (
    <FormField
      name={field.name}
      label={label}
      hint={hint}
      error={error}
      required={field.required}
      className={span}
    >
      <FieldControl
        field={field}
        current={current}
        choices={choices}
        error={error}
        hint={hint}
        noneLabel={noneLabel}
        optionLabels={
          field.optionsKey
            ? ((t.configOptions as Record<string, Record<string, string>>)[
                field.optionsKey
              ] ?? {})
            : {}
        }
      />
    </FormField>
  );
}

function FieldControl({
  field,
  current,
  choices,
  error,
  hint,
  noneLabel,
  optionLabels,
}: {
  field: FieldDef;
  current: string | number | boolean | null | undefined;
  choices: Choice[];
  error?: string;
  hint?: string;
  noneLabel: string;
  optionLabels: Record<string, string>;
}) {
  const props = controlProps(field.name, error, hint);
  const nullable = field.nullable ?? !field.required;

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...props}
          defaultValue={(current as string) ?? ""}
          maxLength={field.maxLength}
          rows={3}
        />
      );

    case "select": {
      const fallback = nullable ? NONE : String(field.defaultValue ?? "");
      return (
        <Select
          name={field.name}
          defaultValue={current !== null && current !== undefined && current !== ""
            ? String(current)
            : fallback}
        >
          <SelectTrigger id={field.name} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nullable ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {optionLabels[option] ?? option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "reference":
      return (
        <Select
          name={field.name}
          defaultValue={current ? String(current) : nullable ? NONE : ""}
        >
          <SelectTrigger id={field.name} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nullable ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
            {choices.map((choice) => (
              <SelectItem key={choice.id} value={choice.id}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "money":
      // Stored in centimes, entered in dirhams.
      return (
        <Input
          {...props}
          type="number"
          step="0.01"
          min={field.min}
          defaultValue={
            typeof current === "number" ? (current / 100).toFixed(2) : ""
          }
          dir="ltr"
          required={field.required}
        />
      );

    case "number":
      return (
        <Input
          {...props}
          type="number"
          min={field.min}
          max={field.max}
          defaultValue={current === null || current === undefined ? "" : String(current)}
          dir="ltr"
          required={field.required}
        />
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <Input
            {...props}
            type="color"
            defaultValue={(current as string) ?? "#2563eb"}
            className="h-9 w-16 p-1"
          />
        </div>
      );

    case "time":
    case "date":
      return (
        <Input
          {...props}
          type={field.type}
          defaultValue={(current as string) ?? ""}
          dir="ltr"
          required={field.required}
        />
      );

    default:
      return (
        <Input
          {...props}
          defaultValue={(current as string) ?? ""}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          dir={field.dir}
          required={field.required}
        />
      );
  }
}
