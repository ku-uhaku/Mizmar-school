"use client";

import * as React from "react";
import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import { saveEventAction } from "@/modules/events/actions";
import { EVENT_KINDS } from "@/modules/events/enums";
import { clusterByGroup } from "@/components/form/option-groups";
import type { AudienceChoice, EventRow } from "@/modules/events/queries";

/**
 * Creating or editing an announcement.
 *
 * Saving never publishes. A new event is always a draft, and an edit leaves the
 * status where it was — putting something in front of every family in the school
 * is a separate press behind a separate permission, so it cannot happen by
 * pressing Save on a form somebody was still filling in.
 *
 * ── All day is the first question, not the last ──────────────────────────────
 * It decides whether the two date fields ask for a time at all. Most school
 * announcements have no clock time — "la sortie est le 12 mars" — and a form
 * that demanded 00:00 anyway would have every event advertising midnight.
 */
export function EventDialog({
  open,
  onOpenChange,
  event,
  levels,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null when creating. */
  event: EventRow | null;
  levels: AudienceChoice[];
  classes: AudienceChoice[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/*
          Keyed on the row, so opening the dialog on a different event mounts a
          fresh form rather than re-seeding the one already there. The state
          below is initialised from `event` exactly once, which is the whole
          reason this is a key and not an effect — syncing it in `useEffect`
          works, but it re-renders the form a second time on every open and the
          React Compiler is right to refuse it.
        */}
        <EventForm
          key={event?.id ?? "new"}
          event={event}
          levels={levels}
          classes={classes}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event,
  levels,
  classes,
  onSaved,
}: {
  event: EventRow | null;
  levels: AudienceChoice[];
  classes: AudienceChoice[];
  onSaved: () => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveEventAction, IDLE);
  useActionFeedback(state, { onSuccess: onSaved });

  const errors = state.fieldErrors ?? {};

  const [isAllDay, setIsAllDay] = React.useState(event?.isAllDay ?? true);
  const [isSchoolWide, setIsSchoolWide] = React.useState(
    event?.isSchoolWide ?? true,
  );
  const [levelIds, setLevelIds] = React.useState<Set<string>>(
    () => new Set(event?.audience.levelIds ?? []),
  );
  const [classIds, setClassIds] = React.useState<Set<string>>(
    () => new Set(event?.audience.classIds ?? []),
  );

  /** `datetime-local` and `date` want different slices of an ISO string. */
  const dateValue = (iso: string | null): string => {
    if (!iso) return "";
    return isAllDay ? iso.slice(0, 10) : iso.slice(0, 16);
  };

  function toggle(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    checked: boolean,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {event ? t.event.editEvent : t.event.newEvent}
        </DialogTitle>
        <DialogDescription>{t.event.subtitle}</DialogDescription>
      </DialogHeader>

      <form action={formAction} className="grid gap-4">
        {event ? <input type="hidden" name="id" value={event.id} /> : null}

        <FormField name="title" label={t.event.eventTitle} error={errors.title}>
          <Input
            {...controlProps("title", errors.title)}
            defaultValue={valueOf(state, "title", event?.title)}
            maxLength={160}
            autoFocus
          />
        </FormField>

        <FormField
          name="titleAr"
          label={t.event.titleAr}
          error={errors.titleAr}
        >
          <Input
            {...controlProps("titleAr", errors.titleAr)}
            defaultValue={valueOf(state, "titleAr", event?.titleAr)}
            dir="rtl"
            maxLength={160}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="kind" label={t.event.kind} error={errors.kind}>
            <Select
              name="kind"
              defaultValue={valueOf(state, "kind", event?.kind) || "OTHER"}
            >
              <SelectTrigger id="kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t.eventOptions.kinds[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            name="location"
            label={t.event.location}
            hint={t.event.locationHint}
            error={errors.location}
          >
            <Input
              {...controlProps("location", errors.location)}
              defaultValue={valueOf(state, "location", event?.location)}
              maxLength={200}
            />
          </FormField>
        </div>

        <label
          htmlFor="isAllDay"
          className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
        >
          <Checkbox
            id="isAllDay"
            checked={isAllDay}
            onCheckedChange={(value) => setIsAllDay(value === true)}
          />
          <span className="min-w-0">
            <span className="block font-medium">{t.event.allDay}</span>
            <span className="text-muted-foreground block text-xs">
              {t.event.allDayHint}
            </span>
          </span>
          {isAllDay ? <input type="hidden" name="isAllDay" value="on" /> : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="startsAt"
            label={t.event.startsAt}
            error={errors.startsAt}
          >
            <Input
              {...controlProps("startsAt", errors.startsAt)}
              // The control changes with the flag, so the key forces a fresh
              // input rather than a date value left in a datetime box.
              key={isAllDay ? "start-date" : "start-datetime"}
              type={isAllDay ? "date" : "datetime-local"}
              defaultValue={dateValue(event?.startsAt ?? null)}
            />
          </FormField>

          <FormField
            name="endsAt"
            label={t.event.endsAt}
            hint={t.event.endsAtHint}
            error={errors.endsAt}
          >
            <Input
              {...controlProps("endsAt", errors.endsAt)}
              key={isAllDay ? "end-date" : "end-datetime"}
              type={isAllDay ? "date" : "datetime-local"}
              defaultValue={dateValue(event?.endsAt ?? null)}
            />
          </FormField>
        </div>

        <FormField
          name="description"
          label={t.event.description}
          hint={t.event.descriptionHint}
          error={errors.description}
        >
          <Textarea
            {...controlProps("description", errors.description)}
            defaultValue={valueOf(state, "description", event?.description)}
            rows={4}
            maxLength={2000}
          />
        </FormField>

        {/* ── Who it reaches ────────────────────────────────────────────── */}
        <div className="grid gap-2">
          <Label>{t.event.audience}</Label>

          <label
            htmlFor="isSchoolWide"
            className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
          >
            <Checkbox
              id="isSchoolWide"
              checked={isSchoolWide}
              onCheckedChange={(value) => setIsSchoolWide(value === true)}
            />
            <span className="min-w-0">
              <span className="block font-medium">{t.event.schoolWide}</span>
              <span className="text-muted-foreground block text-xs">
                {t.event.schoolWideHint}
              </span>
            </span>
            {isSchoolWide ? (
              <input type="hidden" name="isSchoolWide" value="on" />
            ) : null}
          </label>

          {!isSchoolWide ? (
            <div className="grid gap-3 rounded-lg border p-3">
              <AudienceGroup
                label={t.event.levels}
                fieldName="levelIds"
                options={levels}
                ticked={levelIds}
                onToggle={(id, checked) => toggle(setLevelIds, id, checked)}
              />
              <AudienceGroup
                label={t.event.classes}
                fieldName="classIds"
                options={classes}
                ticked={classIds}
                onToggle={(id, checked) => toggle(setClassIds, id, checked)}
              />
              {errors.levelIds ? (
                <p className="text-destructive text-xs">{errors.levelIds}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <SubmitButton>{t.common.save}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

/**
 * One block of tickable targets.
 *
 * Radix's Checkbox is not a native input, so each ticked row carries a hidden
 * field — the same trick `AssignmentTab` and `PermissionMatrix` use. The whole
 * desired set is submitted rather than a diff, and the server re-derives every
 * id against the school before writing.
 */
function AudienceGroup({
  label,
  fieldName,
  options,
  ticked,
  onToggle,
}: {
  label: string;
  fieldName: string;
  options: AudienceChoice[];
  ticked: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="grid gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {/* The niveaux arrive headed by their cycle; the classes carry no group
        and fall into one nameless cluster, which renders as a plain grid. */}
      {clusterByGroup(options).map((cluster, index) => (
        <div key={cluster.heading ?? index} className="grid gap-2">
          {cluster.heading ? (
            <span className="text-muted-foreground px-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
              {cluster.heading}
            </span>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cluster.options.map((option) => {
              const checked = ticked.has(option.id);
              const id = `${fieldName}-${option.id}`;
              return (
                <label
                  key={option.id}
                  htmlFor={id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) =>
                      onToggle(option.id, value === true)
                    }
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                  {checked ? (
                    <input type="hidden" name={fieldName} value={option.id} />
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
