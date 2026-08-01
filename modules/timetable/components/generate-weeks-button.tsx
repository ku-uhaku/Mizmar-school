"use client";

import { CalendarRangeIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { generateSchoolWeeksAction } from "@/modules/timetable/actions";
import { SCHOOL_WEEK_PARITIES } from "@/modules/timetable/enums";

/**
 * Lays out the year's numbered weeks.
 *
 * Behind a confirm rather than a bare button because it rewrites the numbering
 * the whole year is read against — a contrôle "in S12" means a different
 * fortnight afterwards if the holidays changed. Safe to re-run, and it says so:
 * the operator's real question is whether they are about to break something.
 *
 * The only choice is which foot the rotation starts on. Everything else is a
 * consequence of the year's dates and its holidays — see `planSchoolWeeks`.
 */
export function GenerateWeeksButton() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(generateSchoolWeeksAction, IDLE);

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarRangeIcon />
          {t.timetable.generateWeeks}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{t.timetable.generateWeeks}</DialogTitle>
            <DialogDescription className="text-pretty">
              {t.timetable.generateWeeksHint}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select name="firstParity" defaultValue="A">
              <SelectTrigger id="firstParity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_WEEK_PARITIES.map((parity) => (
                  <SelectItem key={parity} value={parity}>
                    {t.timetable.weekParities[parity]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
