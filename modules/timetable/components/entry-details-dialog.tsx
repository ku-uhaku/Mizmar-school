"use client";

import * as React from "react";
import { useActionState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { interpolate } from "@/lib/i18n/format";
import { saveEntryDetailsAction } from "@/modules/timetable/actions";
import {
  MAX_ENTRY_DETAILS,
  minutesSinceMidnight,
} from "@/modules/timetable/enums";
import type {
  DetailSubjectChoice,
  EntryDetailView,
} from "@/modules/timetable/queries";

type Row = { subjectId: string; startTime: string; endTime: string };

/**
 * What is taught inside one lesson, and when — "Grammaire 08:00–08:30".
 *
 * The lesson keeps its subject; this only adds lines under it. So the rows start
 * as the details the lesson already has and saving replaces exactly those, and
 * nothing here can change who teaches the period, in what room, or whether it
 * clashes. The checks on the times are for feedback only — the action repeats
 * them against the lesson's own period.
 */
export function EntryDetailsDialog({
  open,
  onOpenChange,
  entryId,
  subjectId,
  subjectName,
  slot,
  subjects,
  details,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  /** The lesson's own subject, so its components can be offered first. */
  subjectId: string;
  subjectName: string;
  slot: { startTime: string; endTime: string };
  subjects: DetailSubjectChoice[];
  details: EntryDetailView[];
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveEntryDetailsAction, IDLE);
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  // The lesson's own components first — the usual answer — then the rest.
  const options = React.useMemo(() => {
    const own = subjects.filter((subject) => subject.parentId === subjectId);
    const rest = subjects.filter((subject) => subject.parentId !== subjectId);
    return [...own, ...rest];
  }, [subjects, subjectId]);

  const [rows, setRows] = React.useState<Row[]>(() =>
    details.map((detail) => ({
      subjectId: detail.subjectId,
      startTime: detail.startTime,
      endTime: detail.endTime,
    })),
  );

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const addRow = () =>
    setRows((current) => {
      const last = current[current.length - 1];
      return [
        ...current,
        {
          subjectId: options[0]?.id ?? "",
          startTime: last?.endTime ?? slot.startTime,
          endTime: slot.endTime,
        },
      ];
    });

  const valid = React.useMemo(() => {
    const slotStart = minutesSinceMidnight(slot.startTime);
    const slotEnd = minutesSinceMidnight(slot.endTime);
    const seen = new Set<string>();

    return rows.every((row) => {
      if (row.subjectId === "" || !row.startTime || !row.endTime) return false;
      const start = minutesSinceMidnight(row.startTime);
      const end = minutesSinceMidnight(row.endTime);
      const key = `${row.subjectId}@${row.startTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return start < end && start >= slotStart && end <= slotEnd;
    });
  }, [rows, slot]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {interpolate(t.timetable.detailTitle, {
              subject: subjectName,
              time: `${slot.startTime}–${slot.endTime}`,
            })}
          </DialogTitle>
          <DialogDescription>{t.timetable.detailHint}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="entryId" value={entryId} />
          {rows.map((row, index) => (
            <React.Fragment key={index}>
              <input
                type="hidden"
                name="detailSubjectId"
                value={row.subjectId}
              />
              <input type="hidden" name="detailStart" value={row.startTime} />
              <input type="hidden" name="detailEnd" value={row.endTime} />
            </React.Fragment>
          ))}

          <div className="grid gap-3">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2"
              >
                <div className="grid gap-1.5">
                  {index === 0 ? (
                    <Label>{t.timetable.detailSubject}</Label>
                  ) : null}
                  <Select
                    value={row.subjectId}
                    onValueChange={(id) => update(index, { subjectId: id })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.parentLabel
                            ? `${subject.parentLabel} › ${subject.label}`
                            : subject.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  {index === 0 ? <Label>{t.timetable.detailFrom}</Label> : null}
                  <Input
                    type="time"
                    dir="ltr"
                    value={row.startTime}
                    onChange={(e) =>
                      update(index, { startTime: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  {index === 0 ? <Label>{t.timetable.detailTo}</Label> : null}
                  <Input
                    type="time"
                    dir="ltr"
                    value={row.endTime}
                    onChange={(e) => update(index, { endTime: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.timetable.detailRemove}
                  onClick={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>

          {!valid ? (
            <p className="text-destructive text-sm">
              {t.timetable.detailsInvalid}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length >= MAX_ENTRY_DETAILS || options.length === 0}
              onClick={addRow}
            >
              <PlusIcon />
              {t.timetable.detailAdd}
            </Button>
            <SubmitButton disabled={!valid}>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
