"use client";

import * as React from "react";
import { useActionState } from "react";
import { CalendarClockIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Combobox } from "@/components/form/combobox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDLE } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import { WEEK_PARITIES } from "@/modules/timetable/enums";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteTimetableEntryAction,
  deleteTimetableExceptionAction,
  saveTimetableEntryAction,
  saveTimetableExceptionAction,
} from "@/modules/timetable/actions";
import type { TimetableChoices } from "@/modules/timetable/components/timetable-grid";
import type { ExceptionView, TimetableCell } from "@/modules/timetable/queries";

/**
 * What goes in one cell of the grid.
 *
 * Choosing a subject fills the teacher in from the class's teaching assignment,
 * because that is who is answerable for the subject and is right nine times in
 * ten — but it stays editable, since a colleague covers the tenth.
 */
export function TimetableCellDialog({
  open,
  onOpenChange,
  schoolClassId,
  timeSlotId,
  dayOfWeek,
  entry,
  choices,
  maxSpan,
  repeatableDays,
  weekStart,
  weekNumber,
  exception,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolClassId: string;
  timeSlotId: string;
  /** The day the clicked cell sits on. Always included when saving. */
  dayOfWeek: number;
  entry: NonNullable<TimetableCell["entry"]> | null;
  choices: TimetableChoices;
  /** Consecutive periods free to extend into, including this one. */
  maxSpan: number;
  /** Days whose bell schedule runs this same period. */
  repeatableDays: number[];
  /** Monday of the week on screen. Null on grids drawn without a week. */
  weekStart: string | null;
  weekNumber: number | null;
  /** The one-off change already on this period, if any. */
  exception: ExceptionView | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveTimetableEntryAction, IDLE);
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const [subjectId, setSubjectId] = React.useState(
    entry?.subjectId ?? choices.subjects[0]?.id ?? "",
  );
  const [teacherId, setTeacherId] = React.useState(
    entry?.teacherId ?? choices.teacherBySubject[subjectId] ?? "__none__",
  );
  // Editing starts from the days the lesson already runs on — which, for a
  // block, is just the one clicked; repeating is always an addition.
  const [days, setDays] = React.useState<number[]>([dayOfWeek]);
  const [clearing, startClearing] = React.useTransition();

  const [weekState, weekAction] = useActionState(
    saveTimetableExceptionAction,
    IDLE,
  );
  useActionFeedback(weekState, { onSuccess: () => onOpenChange(false) });
  const [restoring, startRestoring] = React.useTransition();

  function restoreWeek() {
    if (!exception) return;
    startRestoring(async () => {
      const result = await deleteTimetableExceptionAction(exception.id);
      if (result.status === "success") {
        toast.success(result.message ?? t.timetable.exceptionCleared);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  const errors = state.fieldErrors ?? {};
  const otherDays = repeatableDays.filter((day) => day !== dayOfWeek);
  const spanOptions = Array.from({ length: maxSpan }, (_, index) => index + 1);

  function chooseSubject(value: string) {
    setSubjectId(value);
    // Only overwrite the teacher when the cell is new — re-picking the subject
    // on an existing lesson should not silently reassign whoever was covering.
    if (!entry) {
      setTeacherId(choices.teacherBySubject[value] ?? "__none__");
    }
  }

  function clear() {
    if (!entry) return;
    startClearing(async () => {
      // Ends the lesson after last week rather than erasing the term —
      // see the note on the action.
      const result = await deleteTimetableEntryAction(entry.id, weekNumber);
      if (result.status === "success") {
        toast.success(result.message ?? t.timetable.cleared);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entry ? t.timetable.editLesson : t.timetable.addLesson}
          </DialogTitle>
          <DialogDescription>{t.timetable.subjectHint}</DialogDescription>
        </DialogHeader>

        <form action={formAction} key={entry?.id ?? timeSlotId}>
          <input type="hidden" name="schoolClassId" value={schoolClassId} />
          <input type="hidden" name="timeSlotId" value={timeSlotId} />
          {/* The week the grid is showing. It is what makes a change start
            here rather than be retroactively true of September. */}
          {weekNumber !== null ? (
            <input type="hidden" name="weekNumber" value={weekNumber} />
          ) : null}
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

          <div className="grid gap-5">
            <FormField
              name="subjectId"
              label={t.timetable.subject}
              error={errors.subjectId}
              required
            >
              <Select
                name="subjectId"
                value={subjectId}
                onValueChange={chooseSubject}
              >
                <SelectTrigger id="subjectId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {choices.subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              name="teacherId"
              label={t.timetable.teacher}
              hint={t.timetable.teacherHint}
              error={errors.teacherId}
            >
              <Combobox
                id="teacherId"
                name="teacherId"
                value={teacherId}
                onValueChange={setTeacherId}
                emptyOption={{ value: "__none__", label: t.common.none }}
                options={choices.teachers.map((teacher) => ({
                  value: teacher.id,
                  label: teacher.label,
                }))}
              />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                name="roomId"
                label={t.timetable.room}
                hint={t.timetable.roomHint}
                error={errors.roomId}
              >
                <Select
                  name="roomId"
                  defaultValue={
                    valueOf(state, "roomId", entry?.roomId) || "__none__"
                  }
                >
                  <SelectTrigger id="roomId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.common.none}</SelectItem>
                    {choices.rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.code}
                        {room.name ? ` — ${room.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="classGroupId"
                label={t.timetable.group}
                hint={t.timetable.groupHint}
                error={errors.classGroupId}
              >
                <Select
                  name="classGroupId"
                  defaultValue={
                    valueOf(state, "classGroupId", entry?.classGroupId) ||
                    "__none__"
                  }
                  disabled={choices.groups.length === 0}
                >
                  <SelectTrigger id="classGroupId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.timetable.wholeClass}
                    </SelectItem>
                    {choices.groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                name="spanSlots"
                label={t.timetable.duration}
                hint={t.timetable.durationHint}
                error={errors.spanSlots}
              >
                <Select
                  name="spanSlots"
                  defaultValue={String(Math.min(entry?.span ?? 1, maxSpan))}
                  disabled={maxSpan === 1}
                >
                  <SelectTrigger id="spanSlots" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {spanOptions.map((span) => (
                      <SelectItem key={span} value={String(span)}>
                        {interpolate(t.timetable.periods, { count: span })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                name="termId"
                label={t.timetable.term}
                hint={t.timetable.termHint}
                error={errors.termId}
              >
                <Select
                  name="termId"
                  defaultValue={
                    valueOf(state, "termId", entry?.termId) || "__none__"
                  }
                >
                  <SelectTrigger id="termId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.timetable.allYear}
                    </SelectItem>
                    {choices.terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {weekNumber !== null ? (
                <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
                  <div className="min-w-0">
                    <Label htmlFor="applyToFollowing">
                      {t.timetable.applyToFollowing}
                    </Label>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t.timetable.applyToFollowingHint}
                    </p>
                  </div>
                  {/* On by default: a lesson set up in week 12 normally runs
                    from then on, and the one-off swap is the exception. */}
                  <Switch
                    id="applyToFollowing"
                    name="applyToFollowing"
                    defaultChecked
                  />
                </div>
              ) : null}

              <FormField
                name="weekParity"
                label={t.timetable.weekParity}
                hint={t.timetable.weekParityHint}
                error={errors.weekParity}
              >
                <Select
                  name="weekParity"
                  defaultValue={
                    valueOf(state, "weekParity", entry?.weekParity) || "ALL"
                  }
                >
                  <SelectTrigger id="weekParity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_PARITIES.map((parity) => (
                      <SelectItem key={parity} value={parity}>
                        {t.timetable.weekParities[parity]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Repeat across the week. The clicked day is always written and is
                shown as a fixed chip rather than a checked box, so nobody tries
                to clear it and wonders why the lesson stayed. */}
            {otherDays.length > 0 ? (
              <fieldset className="grid gap-2 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">
                  {t.timetable.repeatOn}
                </legend>
                <p className="text-muted-foreground -mt-1 text-xs">
                  {t.timetable.repeatOnHint}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-medium">
                    {
                      t.timetable.daysShort[
                        String(dayOfWeek) as keyof typeof t.timetable.daysShort
                      ]
                    }
                  </span>
                  {otherDays.map((day) => {
                    const checked = days.includes(day);
                    return (
                      <label
                        key={day}
                        className={cn(
                          "cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors",
                          checked
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="days"
                          value={day}
                          checked={checked}
                          onChange={(event) =>
                            setDays((current) =>
                              event.target.checked
                                ? [...current, day]
                                : current.filter((other) => other !== day),
                            )
                          }
                          className="sr-only"
                        />
                        {
                          t.timetable.daysShort[
                            String(day) as keyof typeof t.timetable.daysShort
                          ]
                        }
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
          </div>

          <DialogFooter className="mt-5 sm:justify-between">
            {entry ? (
              <Button
                type="button"
                variant="ghost"
                onClick={clear}
                disabled={clearing}
                className="text-destructive hover:text-destructive"
              >
                <Trash2Icon />
                {t.timetable.clearSlot}
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t.common.cancel}
              </Button>
              <SubmitButton>{t.common.save}</SubmitButton>
            </div>
          </DialogFooter>
        </form>

        {/*
          "This week only", kept apart from the form above and posting to its
          own action. The two are different decisions — the form changes the
          recurring grid from now on, this changes week N and nothing else — and
          putting them behind one Save is how somebody moves a lesson for the
          whole year meaning to move it once. Absent when the grid is drawn
          without a week behind it, since there is no week to change.
        */}
        {weekStart && weekNumber !== null ? (
          <div className="mt-2 rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClockIcon className="text-muted-foreground size-4" />
              <h3 className="text-sm font-medium">
                {t.timetable.thisWeekOnly}
              </h3>
            </div>
            <p className="text-muted-foreground mb-3 text-xs text-pretty">
              {interpolate(t.timetable.thisWeekOnlyHint, {
                number: weekNumber,
              })}
            </p>

            {exception ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  {exception.kind === "CANCELLED"
                    ? t.timetable.cancelledThisWeek
                    : (exception.subjectName ?? t.timetable.replaceLesson)}
                  {exception.note ? (
                    <span className="text-muted-foreground ms-1.5 text-xs">
                      {exception.note}
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={restoreWeek}
                  disabled={restoring}
                >
                  {t.timetable.backToUsual}
                </Button>
              </div>
            ) : (
              <form action={weekAction} className="grid gap-3">
                <input
                  type="hidden"
                  name="schoolClassId"
                  value={schoolClassId}
                />
                <input type="hidden" name="timeSlotId" value={timeSlotId} />
                <input type="hidden" name="weekStart" value={weekStart} />
                {entry?.classGroupId ? (
                  <input
                    type="hidden"
                    name="classGroupId"
                    value={entry.classGroupId}
                  />
                ) : null}

                <FormField
                  name="note"
                  label={t.timetable.reason}
                  error={weekState.fieldErrors?.note}
                >
                  <Input
                    id="note"
                    name="note"
                    placeholder={t.timetable.reasonPlaceholder}
                  />
                </FormField>

                {/* Only cancelling is offered here for now, so the kind is
                  fixed rather than chosen — a select with one option is a
                  question with one answer. */}
                <input type="hidden" name="kind" value="CANCELLED" />

                <div className="flex flex-wrap gap-2">
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                  >
                    {t.timetable.cancelLesson}
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
