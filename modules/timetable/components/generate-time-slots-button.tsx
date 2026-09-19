"use client";

import { ClockIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { cn } from "@/lib/utils";
import { generateTimeSlotsAction } from "@/modules/timetable/actions";
import {
  DAY_SESSIONS,
  SCHEDULE_KINDS,
  TEACHING_DAYS,
  formatDuration,
  minutesSinceMidnight,
} from "@/modules/timetable/enums";
import { layPeriodBlock } from "@/modules/timetable/presets";

/** Slot lengths a school commonly runs, offered as one-click choices. */
const PERIOD_LENGTH_CHOICES = [45, 55, 60, 75, 90, 120] as const;

/**
 * Lays a morning, or an afternoon, onto every day ticked — in one go.
 *
 * ── Why one block at a time ──────────────────────────────────────────────────
 * A morning and an afternoon start at different times and belong to different
 * sessions, so one call describes one of them: pick the days, the start time,
 * how long a period runs and how many, where the break falls, and it is
 * written identically onto every day ticked. Doing the afternoon is opening
 * this again with different numbers — which is the whole point: no row is
 * ever typed by hand for a second day.
 *
 * Safe to run again on the same days — see `generateTimeSlots` — so getting a
 * time wrong is fixed by reopening this with the correction, not by deleting
 * rows first. Changing a day's *length* (Friday from 1h30 to 1h) needs the
 * replace option, because slots that start at different times do not correct
 * each other.
 *
 * Lengths differ by day simply by running this once per group of days: Monday
 * to Thursday at 1h30, then Friday at 1h. Nothing in the week is assumed equal.
 */
export function GenerateTimeSlotsButton() {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(generateTimeSlotsAction, IDLE);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const [days, setDays] = React.useState<Set<number>>(
    () => new Set([1, 2, 3, 4, 5]),
  );
  const [breakAfterPeriod, setBreakAfterPeriod] = React.useState("2");
  // Held so the preview below can draw the block before anything is written.
  const [startTime, setStartTime] = React.useState("08:00");
  const [periodMinutes, setPeriodMinutes] = React.useState("60");
  const [periodCount, setPeriodCount] = React.useState("4");
  const [breakMinutes, setBreakMinutes] = React.useState("15");
  const [replace, setReplace] = React.useState(false);

  const errors = state.fieldErrors ?? {};

  /** The block as it will be laid, on one day — every ticked day gets the same. */
  const preview = React.useMemo(() => {
    const length = Number(periodMinutes);
    const count = Number(periodCount);
    if (!/^\d{2}:\d{2}$/.test(startTime) || !(length >= 15) || !(count >= 1)) {
      return [];
    }
    return layPeriodBlock({
      days: [1],
      session: "MORNING",
      scheduleKind: "STANDARD",
      startTime,
      periodMinutes: length,
      periodCount: Math.min(count, 12),
      breakAfterPeriod: Number(breakAfterPeriod) > 0 ? Number(breakAfterPeriod) : null,
      breakMinutes: Number(breakMinutes) || 0,
    });
  }, [startTime, periodMinutes, periodCount, breakAfterPeriod, breakMinutes]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClockIcon />
          {t.timetable.generateTimeSlots}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.timetable.generateTimeSlots}</DialogTitle>
            <DialogDescription className="text-pretty">
              {t.timetable.generateTimeSlotsHint}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="gts-session">{t.timetable.session}</Label>
              <Select name="session" defaultValue="MORNING">
                <SelectTrigger id="gts-session" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_SESSIONS.map((session) => (
                    <SelectItem key={session} value={session}>
                      {t.configOptions.sessions[session]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gts-kind">{t.timetable.scheduleKind}</Label>
              <Select name="scheduleKind" defaultValue="STANDARD">
                <SelectTrigger id="gts-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t.configOptions.scheduleKinds[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="gts-start">{t.timetable.startTime}</Label>
              <Input
                id="gts-start"
                name="startTime"
                type="time"
                dir="ltr"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
              {errors.startTime ? (
                <p className="text-destructive text-xs">{errors.startTime}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gts-length">{t.timetable.periodMinutes}</Label>
              <Input
                id="gts-length"
                name="periodMinutes"
                type="number"
                min={15}
                max={180}
                step={5}
                dir="ltr"
                value={periodMinutes}
                onChange={(event) => setPeriodMinutes(event.target.value)}
                required
              />
              {/* The lengths schools actually run, one click away: typing 90
                each time a Monday is set is where a typo becomes a slot that
                ends at 09:35. */}
              <div className="flex flex-wrap gap-1">
                {PERIOD_LENGTH_CHOICES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setPeriodMinutes(String(minutes))}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[11px]",
                      Number(periodMinutes) === minutes
                        ? "border-primary/40 bg-primary/10"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatDuration(minutes)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gts-count">{t.timetable.periodCount}</Label>
              <Input
                id="gts-count"
                name="periodCount"
                type="number"
                min={1}
                max={12}
                dir="ltr"
                value={periodCount}
                onChange={(event) => setPeriodCount(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="gts-break-after">
                {t.timetable.breakAfterPeriod}
              </Label>
              <Input
                id="gts-break-after"
                name="breakAfterPeriod"
                type="number"
                min={0}
                max={12}
                dir="ltr"
                value={breakAfterPeriod}
                onChange={(event) => setBreakAfterPeriod(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                {t.timetable.breakAfterPeriodHint}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gts-break-minutes">
                {t.timetable.breakMinutes}
              </Label>
              <Input
                id="gts-break-minutes"
                name="breakMinutes"
                type="number"
                min={0}
                max={60}
                dir="ltr"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
                disabled={breakAfterPeriod === "0" || breakAfterPeriod === ""}
              />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{t.timetable.daysToApply}</legend>
            <div className="flex flex-wrap gap-3">
              {TEACHING_DAYS.map((day) => {
                const checked = days.has(day);
                return (
                  <label
                    key={day}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setDays((current) => {
                          const next = new Set(current);
                          if (value) next.add(day);
                          else next.delete(day);
                          return next;
                        })
                      }
                    />
                    {
                      t.configOptions.days[
                        String(day) as keyof typeof t.configOptions.days
                      ]
                    }
                    {checked ? (
                      <input type="hidden" name="days" value={day} />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* What one ticked day will look like, so 1h30 on Monday and 1h on
            Friday are seen before they are saved. Proportional to length. */}
          {preview.length > 0 ? (
            <div className="grid gap-1" dir="ltr">
              <div className="flex gap-0.5">
                {preview.map((slot) => {
                  const minutes =
                    minutesSinceMidnight(slot.endTime) -
                    minutesSinceMidnight(slot.startTime);
                  return (
                    <div
                      key={slot.startTime}
                      style={{ flexGrow: minutes, flexBasis: 0 }}
                      className={cn(
                        "min-w-0 rounded border px-1 py-1 text-center text-[10px] leading-tight",
                        slot.isBreak
                          ? "bg-muted/50 text-muted-foreground border-dashed"
                          : "border-primary/30 bg-primary/10",
                      )}
                    >
                      <span className="block">{slot.startTime}</span>
                      <span className="text-muted-foreground block">
                        {formatDuration(minutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              checked={replace}
              onCheckedChange={(value) => setReplace(value === true)}
              className="mt-0.5"
            />
            <span className="grid gap-0.5">
              <span>{t.timetable.replaceSlots}</span>
              <span className="text-muted-foreground text-xs">
                {t.timetable.replaceSlotsHint}
              </span>
            </span>
            {replace ? <input type="hidden" name="replace" value="on" /> : null}
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <SubmitButton disabled={days.size === 0}>
              {t.common.save}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
