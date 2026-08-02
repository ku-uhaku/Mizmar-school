"use client";

import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/form/combobox";
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
                submitted={state.values}
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

export function ResourceField({
  field,
  row,
  submitted,
  choices,
  error,
  label,
  hint,
  noneLabel,
}: {
  field: FieldDef;
  row?: ResourceRow;
  /**
   * What the last, rejected submission sent. React empties an uncontrolled form
   * the moment its action returns, so without this a validation error would
   * hand the user back the *stored* row and silently discard their edit — see
   * the note on `ActionState.values`.
   */
  submitted?: Record<string, string>;
  choices: Choice[];
  error?: string;
  label: string;
  hint?: string;
  noneLabel: string;
}) {
  const t = useT();
  // The rejected submission wins over the stored row; `undefined` rather than
  // `""` is the test, so a field the user deliberately cleared stays cleared.
  const current = submitted?.[field.name] ?? row?.[field.name];
  const span = field.wide || field.type === "textarea" ? "sm:col-span-2" : "";

  // A switch reads better as a bordered row with its label than as a form field.
  if (field.type === "boolean") {
    const checked = submitted
      ? // An unticked switch posts nothing at all, so its absence from a
        // submission that did happen means false — not "fall back to the row".
        submitted[field.name] === "on" ||
        submitted[field.name] === "true" ||
        submitted[field.name] === "1"
      : current === null || current === undefined
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
          defaultValue={
            current !== null && current !== undefined && current !== ""
              ? String(current)
              : fallback
          }
        >
          <SelectTrigger id={field.name} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nullable ? (
              <SelectItem value={NONE}>{noneLabel}</SelectItem>
            ) : null}
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {optionLabels[option] ?? option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    /*
      A reference is a row out of another table, and those lists are long: the
      teachers, the levels, the rubriques, the quartiers. So it is a combobox
      rather than a select — it posts the same hidden value, and grows a search
      box once the list is long enough to need one. See `Combobox`.
    */
    case "reference":
      return (
        <Combobox
          id={field.name}
          name={field.name}
          defaultValue={current ? String(current) : nullable ? NONE : ""}
          emptyOption={nullable ? { value: NONE, label: noneLabel } : undefined}
          options={choices.map((choice) => ({
            value: choice.id,
            label: choice.label,
          }))}
        />
      );

    case "multiselect": {
      // A checkbox per option, all posting under the same name — FormData
      // collects them with `getAll`, and the value stored is the join.
      const selected = new Set(
        String(current ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
      );

      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border px-4 py-3">
          {(field.options ?? []).map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 text-sm font-normal"
            >
              <Checkbox
                name={field.name}
                value={option}
                defaultChecked={selected.has(option)}
              />
              {optionLabels[option] ?? option}
            </label>
          ))}
        </div>
      );
    }

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

    case "percent":
      // Stored in basis points, entered as a percentage.
      return (
        <Input
          {...props}
          type="number"
          step="0.01"
          min={field.min}
          max={field.max}
          defaultValue={
            typeof current === "number"
              ? String(current / 100)
              : field.defaultValue !== undefined
                ? String(field.defaultValue)
                : ""
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
          defaultValue={
            current === null || current === undefined ? "" : String(current)
          }
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
