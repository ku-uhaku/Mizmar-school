"use client";

import * as React from "react";

import { useActionState } from "react";

import {
  createSchoolYearAction,
  updateSchoolYearAction,
} from "@/modules/school-years/actions";
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
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SCHOOL_YEAR_STATUSES,
  YEAR_COPY_PARTS,
  type YearCopyPart,
} from "@/modules/school-years/enums";
import type { Dictionary } from "@/lib/i18n/types";

const NONE = "__none__";

/** Kept beside the enum so a new part is a compile error until it is labelled. */
const COPY_LABELS: Record<YearCopyPart, (t: Dictionary) => string> = {
  CALENDAR: (t) => t.schoolYear.copyCalendar,
  STRUCTURE: (t) => t.schoolYear.copyStructure,
  FEES: (t) => t.schoolYear.copyFees,
  TRANSPORT: (t) => t.schoolYear.copyTransport,
};

const COPY_HINTS: Record<YearCopyPart, (t: Dictionary) => string> = {
  CALENDAR: (t) => t.schoolYear.copyCalendarHint,
  STRUCTURE: (t) => t.schoolYear.copyStructureHint,
  FEES: (t) => t.schoolYear.copyFeesHint,
  TRANSPORT: (t) => t.schoolYear.copyTransportHint,
};

export type SchoolYearRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  isDefault: boolean;
};

export function SchoolYearDialog({
  open,
  onOpenChange,
  year,
  existingYears = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year?: SchoolYearRow;
  /** The school's other years, newest first — what a new one can start from. */
  existingYears?: SchoolYearRow[];
}) {
  const t = useT();
  const isEdit = Boolean(year);

  /**
   * Which year to start from, and what to bring across.
   *
   * Only offered when creating: copying onto a year that already exists is a
   * different act with different risks, and folding it into the edit form would
   * put it one mis-click from a year somebody is halfway through setting up.
   */
  const [copyFromId, setCopyFromId] = React.useState(NONE);
  const [parts, setParts] = React.useState<Set<string>>(
    () => new Set(YEAR_COPY_PARTS),
  );

  function togglePart(part: string, checked: boolean) {
    setParts((current) => {
      const next = new Set(current);
      if (checked) next.add(part);
      else next.delete(part);
      return next;
    });
  }

  const [state, formAction] = useActionState(
    isEdit ? updateSchoolYearAction : createSchoolYearAction,
    IDLE,
  );
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t.schoolYear.editYear : t.schoolYear.newYear}
          </DialogTitle>
          <DialogDescription>{t.schoolYear.nameHint}</DialogDescription>
        </DialogHeader>

        <form
          key={year?.id ?? "new"}
          action={formAction}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          {year ? <input type="hidden" name="id" value={year.id} /> : null}

          <DialogBody className="grid gap-4 py-1">
            <FormField
              name="name"
              label={t.schoolYear.name}
              hint={t.schoolYear.nameHint}
              error={errors.name}
              required
            >
              <Input
                {...controlProps("name", errors.name, t.schoolYear.nameHint)}
                defaultValue={valueOf(state, "name", year?.name)}
                placeholder="2025-2026"
                dir="ltr"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="startDate"
                label={t.schoolYear.startDate}
                error={errors.startDate}
                required
              >
                <Input
                  {...controlProps("startDate", errors.startDate)}
                  type="date"
                  defaultValue={valueOf(state, "startDate", year?.startDate)}
                  required
                />
              </FormField>

              <FormField
                name="endDate"
                label={t.schoolYear.endDate}
                error={errors.endDate}
                required
              >
                <Input
                  {...controlProps("endDate", errors.endDate)}
                  type="date"
                  defaultValue={valueOf(state, "endDate", year?.endDate)}
                  required
                />
              </FormField>
            </div>

            <FormField
              name="status"
              label={t.schoolYear.status}
              error={errors.status}
            >
              <Select
                name="status"
                defaultValue={
                  valueOf(state, "status", year?.status) || "PLANNED"
                }
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_YEAR_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t.schoolYear.statuses[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {!isEdit && existingYears.length > 0 ? (
              <div className="grid gap-3 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="copyFromYearId">{t.schoolYear.copyFrom}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.schoolYear.copyFromHint}
                  </p>
                </div>

                <Select
                  name="copyFromYearId"
                  value={copyFromId}
                  onValueChange={setCopyFromId}
                >
                  <SelectTrigger id="copyFromYearId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      {t.schoolYear.copyNothing}
                    </SelectItem>
                    {existingYears.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* The parts only matter once a source is chosen, so they stay
                  out of the way until then. */}
                {copyFromId !== NONE ? (
                  <div className="grid gap-2">
                    {YEAR_COPY_PARTS.map((part) => {
                      const checked = parts.has(part);
                      return (
                        <label
                          key={part}
                          htmlFor={`copy-${part}`}
                          className="flex items-start gap-3 rounded-lg border px-3 py-2"
                        >
                          <Checkbox
                            id={`copy-${part}`}
                            checked={checked}
                            onCheckedChange={(value) =>
                              togglePart(part, value === true)
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {COPY_LABELS[part](t)}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                              {COPY_HINTS[part](t)}
                            </span>
                          </span>
                          {/* Radix's Checkbox is not a native input, so the
                            value rides on a hidden field — the same trick the
                            permission matrix uses. */}
                          {checked ? (
                            <input
                              type="hidden"
                              name="copyParts"
                              value={part}
                            />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">{t.schoolYear.isDefault}</Label>
                <p className="text-muted-foreground text-xs">
                  {t.schoolYear.makeDefault}
                </p>
              </div>
              <Switch
                id="isDefault"
                name="isDefault"
                defaultChecked={checkedOf(
                  state,
                  "isDefault",
                  year?.isDefault ?? false,
                )}
              />
            </div>
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
              {isEdit ? t.common.save : t.schoolYear.createYear}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
