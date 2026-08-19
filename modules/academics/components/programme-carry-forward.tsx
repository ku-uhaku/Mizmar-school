"use client";

import { CopyIcon } from "lucide-react";
import * as React from "react";

import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { copyProgrammeAction } from "@/modules/academics/actions";
import type { ProgrammeYearChoice } from "@/modules/academics/queries";

/**
 * "Take last year's programme" — the button that makes a year-scoped programme
 * bearable.
 *
 * A cursus is forty-odd rows of coefficients and volumes horaires, and nobody
 * retypes it every September. The year copy on the years screen offers the same
 * thing at the moment a year is created; this is for the ordinary case where the
 * year already exists and its programme is empty — or short of a niveau opened
 * since.
 *
 * Re-running is safe and the dialog says so: the copy upserts on
 * (year, niveau, matière, filière), so a coefficient already corrected here is
 * left exactly as it is.
 */
export function ProgrammeCarryForward({
  years,
  canManage,
}: {
  years: ProgrammeYearChoice[];
  canManage: boolean;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(copyProgrammeAction, IDLE);
  const [sourceYearId, setSourceYearId] = React.useState(years[0]?.id ?? "");

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  // Nothing to copy *from* is not a disabled button with an explanation, it is
  // no button: a school in its first year has no earlier programme, and saying
  // so on a screen it will never need is noise.
  if (!canManage || years.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CopyIcon />
        {t.configuration.carryProgramme}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{t.configuration.carryProgramme}</DialogTitle>
              <DialogDescription className="text-pretty">
                {t.configuration.carryProgrammeHint}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <FormField
                name="sourceYearId"
                label={t.configuration.carryProgrammeFrom}
              >
                <Select
                  name="sourceYearId"
                  value={sourceYearId}
                  onValueChange={setSourceYearId}
                >
                  <SelectTrigger id="sourceYearId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {interpolate(t.configuration.carryProgrammeYear, {
                          year: year.name,
                          count: year.rows,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <SubmitButton disabled={sourceYearId === ""}>
                <CopyIcon />
                {t.configuration.carryProgrammeConfirm}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
