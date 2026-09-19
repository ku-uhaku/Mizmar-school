"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  DicesIcon,
  Loader2Icon,
  SparklesIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { interpolate } from "@/lib/i18n/format";
import {
  formatDuration,
  GENERATOR_BLOCK_OPTIONS,
  GENERATOR_DAY_LIMIT_OPTIONS,
} from "@/modules/timetable/enums";
import { cn } from "@/lib/utils";
import {
  applyTimetableAction,
  previewTimetableAction,
} from "@/modules/timetable/actions";
import { randomSeed } from "@/modules/timetable/generator";
import type { GeneratorRequest, TimetableDraft } from "@/modules/timetable/service";

/**
 * Draws a week automatically, and lets somebody look at it before keeping it.
 *
 * ── Why it previews ─────────────────────────────────────────────────────────
 * A generated timetable is a proposal, not a decision. The head of studies who
 * presses this has a view about which morning the maths goes in, and a button
 * that silently rewrote six classes' weeks would be used exactly once. So the
 * flow is: choose the rules, look at the grid, and then either keep it or throw
 * it away — the throwing away costing nothing, because nothing was written.
 *
 * Re-rolling is the point of the seed. The same options with a different seed
 * give a different legal week in about a second, so "not that one" is a button
 * rather than an argument.
 *
 * ── What crosses the wire ───────────────────────────────────────────────────
 * The options and the seed, never the grid. The server lays it out again from
 * the database on apply — see `applyTimetableDraft`. That is what stops a
 * crafted request booking any teacher into any class, and it is why the applied
 * result is reported with its own counts rather than the preview's.
 */
/** A teaching slot the dialog can offer to include or leave out. */
export type PickableSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  minutes: number;
};

/** How one subject is treated in this run. */
type SubjectMode = "ANY" | "ONLY" | "FIXED";

type SubjectRule = {
  /** Leave the subject out of this run altogether. */
  skip: boolean;
  mode: SubjectMode;
  /** The créneaux the mode refers to. Empty means no restriction at all. */
  slotIds: ReadonlySet<string>;
};

const NO_RULE: SubjectRule = { skip: false, mode: "ANY", slotIds: new Set() };

export type PickableSubject = { id: string; label: string; colorHex: string | null };

export function TimetableGenerator({
  classCount,
  currentClassId,
  scheduleKind,
  slots,
  subjects,
}: {
  /** How many classes "every class" would cover — for the scope label only.
   *  The names on the preview come from the draft, which is the server's. */
  classCount: number;
  currentClassId: string;
  scheduleKind: string;
  /** The week's teaching slots, so a run can be limited to some of them. */
  slots: PickableSlot[];
  /** The programme's subjects, for leaving some out or fixing them to créneaux. */
  subjects: PickableSubject[];
}) {
  const t = useT();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [scope, setScope] = React.useState<"CLASS" | "ALL">("CLASS");
  const [replaceExisting, setReplaceExisting] = React.useState(true);
  /*
    Held in minutes, because slots are not all the same length: 1h30 on Monday
    to Thursday and 1h on Friday is an ordinary week, and the placer sums real
    slot lengths rather than counting periods against a typical one.
    0 for the lesson length means one lesson per slot, whatever its length.
  */
  const [blockMinutes, setBlockMinutes] = React.useState(0);
  const [maxMinutesPerDay, setMaxMinutesPerDay] = React.useState(120);
  /** Slots the user has switched off. Held as the exclusions so that a slot the
   *  school adds later is included by default. */
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(new Set());
  /** Per-subject rules for this run only — nothing here is saved. */
  const [rules, setRules] = React.useState<ReadonlyMap<string, SubjectRule>>(
    new Map(),
  );

  const [draft, setDraft] = React.useState<TimetableDraft | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [applying, startApplying] = React.useTransition();

  /** The exact request that produced the draft on screen, for applying it. */
  const requestFor = React.useCallback(
    (seed: number): GeneratorRequest => {
      // Built from the subjects on screen, not from every rule ever set: a
      // rule left over from another class's programme must not ride along
      // unseen.
      const skipSubjectIds: string[] = [];
      const subjectSlots: Record<string, string[]> = {};
      const pins: { subjectId: string; timeSlotIds: string[] }[] = [];
      for (const subject of subjects) {
        const rule = rules.get(subject.id) ?? NO_RULE;
        if (rule.skip) {
          skipSubjectIds.push(subject.id);
          continue;
        }
        if (rule.slotIds.size === 0) continue;
        if (rule.mode === "ONLY") subjectSlots[subject.id] = [...rule.slotIds];
        // A pin means one class only — see GeneratorOptions.pins.
        if (rule.mode === "FIXED" && scope === "CLASS") {
          pins.push({ subjectId: subject.id, timeSlotIds: [...rule.slotIds] });
        }
      }

      return {
        // Empty means every class of the year — see GeneratorRequest.
        schoolClassIds: scope === "ALL" ? [] : [currentClassId],
        scheduleKind,
        seed,
        replaceExisting,
        blockMinutes,
        maxMinutesPerDay,
        // Left off when nothing is switched off, so the default request is the
        // whole week and stays so when slots are added.
        allowedSlotIds:
          excluded.size === 0
            ? undefined
            : slots.filter((slot) => !excluded.has(slot.id)).map((slot) => slot.id),
        skipSubjectIds,
        subjectSlots,
        pins,
      };
    },
    [
      scope,
      currentClassId,
      scheduleKind,
      replaceExisting,
      blockMinutes,
      maxMinutesPerDay,
      excluded,
      slots,
      subjects,
      rules,
    ],
  );

  const [request, setRequest] = React.useState<GeneratorRequest | null>(null);

  function generate(seed: number) {
    const next = requestFor(seed);
    startTransition(async () => {
      const result = await previewTimetableAction(next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRequest(next);
      setDraft(result.draft);
    });
  }

  function apply() {
    if (!request) return;
    startApplying(async () => {
      const result = await applyTimetableAction(request);
      if (result.status === "success") {
        if (result.message) toast.success(result.message);
        close();
        router.refresh();
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  function close() {
    setOpen(false);
    // Dropped rather than kept: reopening should offer a fresh draw, not
    // yesterday's proposal against a grid that has since moved on.
    setDraft(null);
    setRequest(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SparklesIcon />
          {t.timetable.generateGrid}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t.timetable.generateGrid}</DialogTitle>
          <DialogDescription>
            {t.timetable.generateGridHint}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Options
            scope={scope}
            onScope={setScope}
            classCount={classCount}
            replaceExisting={replaceExisting}
            onReplaceExisting={setReplaceExisting}
            blockMinutes={blockMinutes}
            onBlockMinutes={setBlockMinutes}
            maxMinutesPerDay={maxMinutesPerDay}
            onMaxMinutesPerDay={setMaxMinutesPerDay}
            slots={slots}
            excluded={excluded}
            onExcluded={setExcluded}
            subjects={subjects}
            rules={rules}
            onRules={setRules}
            // Changing a rule invalidates the grid on screen: applying a draft
            // drawn under the old rules would not be what the switches say.
            onChanged={() => {
              setDraft(null);
              setRequest(null);
            }}
          />

          {draft ? (
            <DraftPreview
              draft={draft}
              // Any change to a rule drops the draft, so what is ticked now is
              // what this draft was drawn with.
              leftOut={subjects
                .filter((subject) => rules.get(subject.id)?.skip)
                .map((subject) => subject.label)}
            />
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={close}>
            {t.common.cancel}
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => generate(randomSeed())}
              disabled={pending || applying}
            >
              {pending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <DicesIcon />
              )}
              {draft ? t.timetable.reroll : t.timetable.generateDraw}
            </Button>

            {/* The only button that writes anything, and it only appears once
              there is something to write. */}
            {draft ? (
              <Button type="button" onClick={apply} disabled={applying || pending}>
                {applying ? <Loader2Icon className="animate-spin" /> : null}
                {t.timetable.applyGrid}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Options({
  scope,
  onScope,
  classCount,
  replaceExisting,
  onReplaceExisting,
  blockMinutes,
  onBlockMinutes,
  maxMinutesPerDay,
  onMaxMinutesPerDay,
  slots,
  excluded,
  onExcluded,
  subjects,
  rules,
  onRules,
  onChanged,
}: {
  scope: "CLASS" | "ALL";
  onScope: (scope: "CLASS" | "ALL") => void;
  classCount: number;
  replaceExisting: boolean;
  onReplaceExisting: (value: boolean) => void;
  blockMinutes: number;
  onBlockMinutes: (value: number) => void;
  maxMinutesPerDay: number;
  onMaxMinutesPerDay: (value: number) => void;
  slots: PickableSlot[];
  excluded: ReadonlySet<string>;
  onExcluded: (value: ReadonlySet<string>) => void;
  subjects: PickableSubject[];
  rules: ReadonlyMap<string, SubjectRule>;
  onRules: (value: ReadonlyMap<string, SubjectRule>) => void;
  onChanged: () => void;
}) {
  const t = useT();

  const change = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    onChanged();
  };

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="generator-scope">{t.timetable.generateScope}</Label>
          <Select
            value={scope}
            onValueChange={change<string>((value) =>
              onScope(value === "ALL" ? "ALL" : "CLASS"),
            )}
          >
            <SelectTrigger id="generator-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLASS">{t.timetable.scopeThisClass}</SelectItem>
              <SelectItem value="ALL">
                {interpolate(t.timetable.scopeAllClasses, {
                  count: classCount,
                })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="generator-length">{t.timetable.lessonLength}</Label>
          <Select
            value={String(blockMinutes)}
            onValueChange={change<string>((value) =>
              onBlockMinutes(Number(value)),
            )}
          >
            <SelectTrigger id="generator-length" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENERATOR_BLOCK_OPTIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {minutes === 0
                    ? t.timetable.lessonPerSlot
                    : formatDuration(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="generator-max">{t.timetable.maxPerDay}</Label>
          <Select
            value={String(maxMinutesPerDay)}
            onValueChange={change<string>((value) =>
              onMaxMinutesPerDay(Number(value)),
            )}
          >
            <SelectTrigger id="generator-max" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENERATOR_DAY_LIMIT_OPTIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {formatDuration(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SlotPicker
        slots={slots}
        excluded={excluded}
        onChange={change(onExcluded)}
      />

      <SubjectRules
        subjects={subjects}
        slots={slots}
        rules={rules}
        // Pins need a single class; the mode is offered only then.
        canPin={scope === "CLASS"}
        onChange={change(onRules)}
      />

      <ToggleRow
        id="generator-replace"
        label={t.timetable.replaceExisting}
        hint={
          replaceExisting
            ? t.timetable.replaceExistingHint
            : t.timetable.fillGapsHint
        }
        checked={replaceExisting}
        onCheckedChange={change(onReplaceExisting)}
      />

    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * The week's slots as toggles, one row per day. Each button is a real slot with
 * its own length, so a 1h Friday reads differently from a 1h30 Monday. The day
 * name toggles its whole row.
 *
 * Says nothing about what "on" means — the caller does. The run-wide picker
 * reads it as "may be filled", a subject's picker as "may hold this subject" or
 * "is fixed to this subject".
 */
function SlotToggles({
  slots,
  isOn,
  onSet,
  strikeWhenOff = true,
}: {
  slots: PickableSlot[];
  isOn: (id: string) => boolean;
  onSet: (ids: string[], on: boolean) => void;
  strikeWhenOff?: boolean;
}) {
  const t = useT();

  const days = React.useMemo(() => {
    const byDay = new Map<number, PickableSlot[]>();
    for (const slot of slots) {
      byDay.set(slot.dayOfWeek, [...(byDay.get(slot.dayOfWeek) ?? []), slot]);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, daySlots]) => ({
        day,
        slots: [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [slots]);

  return (
    <div className="grid gap-1">
      {days.map(({ day, slots: daySlots }) => {
        const ids = daySlots.map((slot) => slot.id);
        const allOn = ids.every(isOn);
        return (
          <div key={day} className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onSet(ids, !allOn)}
              className="text-muted-foreground hover:text-foreground w-16 text-start text-xs font-medium"
            >
              {
                t.timetable.daysShort[
                  String(day) as keyof typeof t.timetable.daysShort
                ]
              }
            </button>
            {daySlots.map((slot) => {
              const on = isOn(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSet([slot.id], !on)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] leading-tight transition-colors",
                    on
                      ? "border-primary/40 bg-primary/10"
                      : cn(
                          "text-muted-foreground/60 border-dashed",
                          strikeWhenOff && "line-through",
                        ),
                  )}
                  dir="ltr"
                >
                  {slot.startTime}
                  <span className="text-muted-foreground ms-1">
                    {formatDuration(slot.minutes)}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Which créneaux the run may use. Nothing here is a rule about the week — every
 * slot starts ticked, and unticking one only stops this run placing into it.
 */
function SlotPicker({
  slots,
  excluded,
  onChange,
}: {
  slots: PickableSlot[];
  excluded: ReadonlySet<string>;
  onChange: (value: ReadonlySet<string>) => void;
}) {
  const t = useT();
  if (slots.length === 0) return null;

  return (
    <div className="grid gap-1.5">
      <Label>{t.timetable.slotPickerTitle}</Label>
      <p className="text-muted-foreground text-xs">{t.timetable.slotPickerHint}</p>
      <SlotToggles
        slots={slots}
        isOn={(id) => !excluded.has(id)}
        onSet={(ids, on) => {
          const next = new Set(excluded);
          for (const id of ids) {
            if (on) next.delete(id);
            else next.add(id);
          }
          onChange(next);
        }}
      />
    </div>
  );
}

/**
 * Per-subject rules for this run: leave a subject out, keep it to some créneaux,
 * or fix it to particular ones and let the draw fill the rest around it.
 *
 * Held only in the dialog. A rule that outlived the run would be a setting
 * nobody remembers turning on, and a re-roll should start from what is on
 * screen, not from last Tuesday's experiment.
 */
function SubjectRules({
  subjects,
  slots,
  rules,
  canPin,
  onChange,
}: {
  subjects: PickableSubject[];
  slots: PickableSlot[];
  rules: ReadonlyMap<string, SubjectRule>;
  /** Fixing needs a single class — see `GeneratorOptions.pins`. */
  canPin: boolean;
  onChange: (value: ReadonlyMap<string, SubjectRule>) => void;
}) {
  const t = useT();
  if (subjects.length === 0 || slots.length === 0) return null;

  const update = (id: string, patch: Partial<SubjectRule>) => {
    const next = new Map(rules);
    next.set(id, { ...(rules.get(id) ?? NO_RULE), ...patch });
    onChange(next);
  };

  return (
    <div className="grid gap-1.5">
      <Label>{t.timetable.subjectRulesTitle}</Label>
      <p className="text-muted-foreground text-xs">{t.timetable.subjectRulesHint}</p>

      <div className="grid gap-2">
        {subjects.map((subject) => {
          const rule = rules.get(subject.id) ?? NO_RULE;
          const restricted = rule.mode !== "ANY" && !rule.skip;
          return (
            <div key={subject.id} className="grid gap-1.5 rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={!rule.skip}
                    onCheckedChange={(value) => update(subject.id, { skip: value !== true })}
                  />
                  {subject.colorHex ? (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: subject.colorHex }}
                    />
                  ) : null}
                  <span className={cn("truncate", rule.skip && "text-muted-foreground line-through")}>
                    {subject.label}
                  </span>
                </label>

                <Select
                  value={rule.mode}
                  disabled={rule.skip}
                  onValueChange={(value) =>
                    update(subject.id, {
                      mode: value as SubjectMode,
                      // A different meaning for the same ticks would be a
                      // trap: "only here" turned into "fixed here" silently.
                      slotIds: new Set(),
                    })
                  }
                >
                  <SelectTrigger className="w-44" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">{t.timetable.modeAny}</SelectItem>
                    <SelectItem value="ONLY">{t.timetable.modeOnly}</SelectItem>
                    <SelectItem value="FIXED" disabled={!canPin}>
                      {t.timetable.modeFixed}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {restricted ? (
                <div className="grid gap-1.5">
                  <p className="text-muted-foreground text-xs">
                    {rule.mode === "FIXED"
                      ? t.timetable.modeFixedHint
                      : t.timetable.modeOnlyHint}
                  </p>
                  <SlotToggles
                    slots={slots}
                    strikeWhenOff={false}
                    isOn={(id) => rule.slotIds.has(id)}
                    onSet={(ids, on) => {
                      const next = new Set(rule.slotIds);
                      for (const id of ids) {
                        if (on) next.add(id);
                        else next.delete(id);
                      }
                      update(subject.id, { slotIds: next });
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!canPin ? (
        <p className="text-muted-foreground text-xs">{t.timetable.pinNeedsOneClass}</p>
      ) : null}
    </div>
  );
}

/**
 * The proposed week, as a grid per class.
 *
 * Drawn from the draft's own slots and placements rather than re-fetched: the
 * whole point of a preview is that nothing has been written yet, so there is
 * nothing on the server to read back.
 *
 * What did *not* fit comes first. A grid that looks complete but is two hours
 * of physics short is worse than one that says so, and the reader has to see
 * the gap before they decide to keep the week.
 */
function DraftPreview({
  draft,
  leftOut,
}: {
  draft: TimetableDraft;
  /** Subjects the user chose not to place, so the gap is not a surprise. */
  leftOut: string[];
}) {
  const t = useT();

  const complete = draft.shortfalls.length === 0;
  const noTeacher = draft.skipped.filter((row) => row.reason === "NO_TEACHER");
  const noHours = draft.skipped.filter((row) => row.reason === "NO_HOURS");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={complete ? "default" : "outline"}>
          {interpolate(t.timetable.minutesPlaced, {
            placed: formatDuration(draft.placedMinutes),
            requested: formatDuration(draft.requestedMinutes),
          })}
        </Badge>
        {draft.overshootMinutes > 0 ? (
          <Badge variant="secondary">
            {interpolate(t.timetable.overshoot, {
              duration: formatDuration(draft.overshootMinutes),
            })}
          </Badge>
        ) : null}
        {draft.classes.length > 1 ? (
          <Badge variant="secondary">
            {interpolate(t.timetable.classesCovered, {
              count: draft.classes.length,
            })}
          </Badge>
        ) : null}
      </div>

      {/* Said before the shortfall list, because it is the *reason* for it.
        A half-empty week in an understaffed school is arithmetic, not a
        scheduling failure, and somebody sent hunting for the second will not
        find it. */}
      {draft.capacity.understaffed ? (
        <Notice
          icon={<UsersIcon className="size-4" />}
          tone="warning"
          title={t.timetable.understaffed}
        >
          <p>
            {interpolate(t.timetable.understaffedHint, {
              demand: Math.round(draft.capacity.demandMinutes / 60),
              available: Math.round(draft.capacity.availableMinutes / 60),
              missing: Math.round(
                (draft.capacity.demandMinutes - draft.capacity.availableMinutes) /
                  60,
              ),
            })}
          </p>
        </Notice>
      ) : null}

      {draft.shortfalls.length > 0 ? (
        <Notice
          icon={<AlertTriangleIcon className="size-4" />}
          tone="warning"
          title={t.timetable.shortfalls}
        >
          <ul className="grid gap-0.5">
            {draft.shortfalls.map((row) => (
              <li key={`${row.schoolClassId}:${row.subjectId}`}>
                {row.className} · {row.subjectName} —{" "}
                {interpolate(t.timetable.minutesMissing, {
                  duration: formatDuration(row.missing),
                })}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {leftOut.length > 0 ? (
        <Notice
          icon={<UserXIcon className="size-4" />}
          tone="muted"
          title={t.timetable.leftOutByYou}
        >
          <p>{leftOut.join(", ")}</p>
        </Notice>
      ) : null}

      {noHours.length > 0 ? (
        <Notice
          icon={<AlertTriangleIcon className="size-4" />}
          tone="warning"
          title={t.timetable.noWeeklyHours}
        >
          <p>{subjectList(noHours)}</p>
        </Notice>
      ) : null}

      {/* The affectations, above the grid: agreeing to this draft agrees to
        these teachers taking these classes all year, which is a bigger
        decision than any single cell of the week below. */}
      {draft.assignments.length > 0 ? (
        <Notice
          icon={<UserCheckIcon className="size-4" />}
          tone="muted"
          title={interpolate(t.timetable.teachersAssigned, {
            count: draft.assignments.length,
          })}
        >
          <ul className="grid gap-0.5">
            {draft.assignments.map((row) => (
              <li key={`${row.schoolClassId}:${row.subjectId}`}>
                {row.className} · {row.subjectName} → {row.teacherName}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {noTeacher.length > 0 ? (
        <Notice
          icon={<UserXIcon className="size-4" />}
          tone="muted"
          title={t.timetable.noTeacherAssigned}
        >
          <p>{subjectList(noTeacher)}</p>
        </Notice>
      ) : null}

      {draft.classes.map((schoolClass) => (
        <ClassGrid key={schoolClass.id} draft={draft} schoolClass={schoolClass} />
      ))}
    </div>
  );
}

function subjectList(rows: { className: string; subjectName: string }[]): string {
  return rows.map((row) => `${row.className} · ${row.subjectName}`).join(", ");
}

function Notice({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "warning" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs",
        tone === "warning"
          ? "border-warning/40 bg-warning/5"
          : "bg-muted/40",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        {icon}
        {title}
      </div>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * One class's proposed week.
 *
 * Columns are the distinct periods and rows the days, the same way round as the
 * real grid on the page behind the dialog — a preview laid out differently from
 * the thing it previews is a preview nobody can check.
 */
function ClassGrid({
  draft,
  schoolClass,
}: {
  draft: TimetableDraft;
  schoolClass: { id: string; code: string; label: string };
}) {
  const t = useT();

  const { columns, days, cells } = React.useMemo(() => {
    const slotById = new Map(draft.slots.map((slot) => [slot.id, slot]));

    const columnKeys = new Map<string, { startTime: string; endTime: string }>();
    const dayNumbers = new Set<number>();
    for (const slot of draft.slots) {
      columnKeys.set(`${slot.startTime}-${slot.endTime}`, {
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      dayNumbers.add(slot.dayOfWeek);
    }

    /** `day:columnKey` → what the draft put there. */
    const filled = new Map<
      string,
      { short: string; colorHex: string | null; teacherName: string | null }
    >();

    for (const placement of draft.placements) {
      if (placement.schoolClassId !== schoolClass.id) continue;
      for (const slotId of placement.timeSlotIds) {
        const slot = slotById.get(slotId);
        if (!slot) continue;
        filled.set(`${slot.dayOfWeek}:${slot.startTime}-${slot.endTime}`, {
          short: placement.subjectShort,
          colorHex: placement.colorHex,
          teacherName: placement.teacherName,
        });
      }
    }

    return {
      columns: [...columnKeys.entries()]
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      days: [...dayNumbers].sort((a, b) => a - b),
      cells: filled,
    };
  }, [draft, schoolClass.id]);

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">{schoolClass.label}</p>

      {/* Its own scroller: a ten-period day must not push the dialog sideways. */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-muted-foreground p-1.5 text-start font-medium">
                {t.timetable.day}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-muted-foreground p-1.5 font-medium whitespace-nowrap"
                  dir="ltr"
                >
                  {column.startTime}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className="border-t">
                <th className="text-muted-foreground p-1.5 text-start font-medium whitespace-nowrap">
                  {
                    t.timetable.daysShort[
                      String(day) as keyof typeof t.timetable.daysShort
                    ]
                  }
                </th>
                {columns.map((column) => {
                  const cell = cells.get(`${day}:${column.key}`);
                  return (
                    <td key={column.key} className="border-s p-0.5">
                      {cell ? (
                        <div
                          className="rounded px-1 py-1 text-center leading-tight"
                          style={
                            cell.colorHex
                              ? {
                                  backgroundColor: `${cell.colorHex}22`,
                                  borderInlineStart: `2px solid ${cell.colorHex}`,
                                }
                              : undefined
                          }
                        >
                          <span className="block font-medium">{cell.short}</span>
                          {cell.teacherName ? (
                            <span className="text-muted-foreground block truncate text-[10px]">
                              {cell.teacherName}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-muted-foreground/40 py-1 text-center">
                          ·
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
