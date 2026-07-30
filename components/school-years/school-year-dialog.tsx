"use client";

import { useActionState } from "react";

import {
  createSchoolYearAction,
  updateSchoolYearAction,
} from "@/app/actions/school-years";
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
import { SCHOOL_YEAR_STATUSES } from "@/lib/enums";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year?: SchoolYearRow;
}) {
  const t = useT();
  const isEdit = Boolean(year);

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
              defaultValue={year?.name ?? ""}
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
                defaultValue={year?.startDate ?? ""}
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
                defaultValue={year?.endDate ?? ""}
                required
              />
            </FormField>
          </div>

          <FormField
            name="status"
            label={t.schoolYear.status}
            error={errors.status}
          >
            <Select name="status" defaultValue={year?.status ?? "PLANNED"}>
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
              defaultChecked={year?.isDefault ?? false}
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
