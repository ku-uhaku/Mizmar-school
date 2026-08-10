"use client";

import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormGrid } from "@/components/form/form-page";
import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
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
import { interpolate } from "@/lib/i18n/format";
import { LESSON_LENGTHS_MINUTES, TEACHING_DAYS } from "@/modules/timetable/enums";
import { slotsForBell } from "@/modules/setup/bell";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/**
 * When the periods ring.
 *
 * The preview is drawn by the same `layPeriodBlock` the server writes with, so
 * what the school sees here is exactly the grid it gets — no second
 * implementation to drift.
 */
export function BellStep({
  setup,
  errors,
}: {
  setup: SetupState;
  errors: Record<string, string>;
}) {
  const t = useT();
  const bell = setup.bell;

  const preview = React.useMemo(() => {
    const days = bell.teachingDays;
    if (days.length === 0) return [];
    try {
      return slotsForBell({
        teachingDays: days,
        dayStartsAt: bell.dayStartsAt,
        afternoonStartsAt: bell.afternoonStartsAt,
        periodMinutes: Number(bell.periodMinutes) || 60,
        morningPeriods: Number(bell.morningPeriods) || 0,
        afternoonPeriods: Number(bell.afternoonPeriods) || 0,
        periodsBeforeBreak: Number(bell.periodsBeforeBreak) || 0,
        breakMinutes: Number(bell.breakMinutes) || 0,
        saturdayMorningOnly: bell.saturdayMorningOnly,
        withRamadan: bell.withRamadan,
        ramadanStartsAt: bell.ramadanStartsAt,
        ramadanPeriods: Number(bell.ramadanPeriods) || 0,
      });
    } catch {
      // A half-typed time is not an error worth showing — the schema catches it
      // on submit, and until then the preview simply has nothing to draw.
      return [];
    }
  }, [bell]);

  const monday = preview.filter(
    (slot) => slot.dayOfWeek === bell.teachingDays[0] && slot.scheduleKind === "STANDARD",
  );

  function toggleDay(day: number, on: boolean) {
    bell.patch({
      teachingDays: on
        ? [...new Set([...bell.teachingDays, day])].sort((a, b) => a - b)
        : bell.teachingDays.filter((item) => item !== day),
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>{t.setup.bell.teachingDays}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border px-4 py-3">
          {TEACHING_DAYS.map((day) => (
            <label key={day} className="flex items-center gap-2 text-sm font-normal">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={bell.teachingDays.includes(day)}
                onChange={(event) => toggleDay(day, event.target.checked)}
              />
              {t.configOptions.days[String(day) as "1"]}
              {bell.teachingDays.includes(day) ? (
                <input type="hidden" name="teachingDay" value={day} />
              ) : null}
            </label>
          ))}
        </div>
      </div>

      <FormGrid cols={4}>
        <FormField name="dayStartsAt" label={t.setup.bell.dayStartsAt} error={errors.dayStartsAt}>
          <Input
            {...controlProps("dayStartsAt", errors.dayStartsAt)}
            type="time"
            value={bell.dayStartsAt}
            onChange={(event) => bell.patch({ dayStartsAt: event.target.value })}
          />
        </FormField>

        <FormField name="periodMinutes" label={t.setup.bell.periodMinutes} error={errors.periodMinutes}>
          <Select
            value={bell.periodMinutes}
            onValueChange={(value) => bell.patch({ periodMinutes: value })}
          >
            <SelectTrigger id="periodMinutes" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LESSON_LENGTHS_MINUTES.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {interpolate(t.setup.bell.minutes, { count: minutes })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="periodMinutes" value={bell.periodMinutes} />
        </FormField>

        <FormField name="morningPeriods" label={t.setup.bell.morningPeriods} error={errors.morningPeriods}>
          <Input
            {...controlProps("morningPeriods", errors.morningPeriods)}
            type="number"
            min={0}
            max={12}
            value={bell.morningPeriods}
            onChange={(event) => bell.patch({ morningPeriods: event.target.value })}
          />
        </FormField>

        <FormField
          name="periodsBeforeBreak"
          label={t.setup.bell.periodsBeforeBreak}
          hint={t.setup.bell.periodsBeforeBreakHint}
          error={errors.periodsBeforeBreak}
        >
          <Input
            {...controlProps("periodsBeforeBreak", errors.periodsBeforeBreak, t.setup.bell.periodsBeforeBreakHint)}
            type="number"
            min={0}
            max={12}
            value={bell.periodsBeforeBreak}
            onChange={(event) => bell.patch({ periodsBeforeBreak: event.target.value })}
          />
        </FormField>

        <FormField
          name="afternoonStartsAt"
          label={t.setup.bell.afternoonStartsAt}
          error={errors.afternoonStartsAt}
        >
          <Input
            {...controlProps("afternoonStartsAt", errors.afternoonStartsAt)}
            type="time"
            value={bell.afternoonStartsAt}
            onChange={(event) => bell.patch({ afternoonStartsAt: event.target.value })}
          />
        </FormField>

        <FormField
          name="afternoonPeriods"
          label={t.setup.bell.afternoonPeriods}
          error={errors.afternoonPeriods}
        >
          <Input
            {...controlProps("afternoonPeriods", errors.afternoonPeriods)}
            type="number"
            min={0}
            max={12}
            value={bell.afternoonPeriods}
            onChange={(event) => bell.patch({ afternoonPeriods: event.target.value })}
          />
        </FormField>

        <FormField name="breakMinutes" label={t.setup.bell.breakMinutes} error={errors.breakMinutes}>
          <Input
            {...controlProps("breakMinutes", errors.breakMinutes)}
            type="number"
            min={0}
            max={120}
            value={bell.breakMinutes}
            onChange={(event) => bell.patch({ breakMinutes: event.target.value })}
          />
        </FormField>
      </FormGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <Label htmlFor="saturdayMorningOnly" className="font-normal">
            {t.setup.bell.saturdayMorningOnly}
          </Label>
          <Switch
            id="saturdayMorningOnly"
            checked={bell.saturdayMorningOnly}
            onCheckedChange={(value) => bell.patch({ saturdayMorningOnly: value === true })}
          />
          {bell.saturdayMorningOnly ? (
            <input type="hidden" name="saturdayMorningOnly" value="on" />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="withRamadan" className="font-normal">
              {t.setup.bell.withRamadan}
            </Label>
            <p className="text-muted-foreground text-xs">{t.setup.bell.withRamadanHint}</p>
          </div>
          <Switch
            id="withRamadan"
            checked={bell.withRamadan}
            onCheckedChange={(value) => bell.patch({ withRamadan: value === true })}
          />
          {bell.withRamadan ? <input type="hidden" name="withRamadan" value="on" /> : null}
        </div>
      </div>

      {bell.withRamadan ? (
        <FormGrid cols={4}>
          <FormField name="ramadanStartsAt" label={t.setup.bell.ramadanStartsAt}>
            <Input
              {...controlProps("ramadanStartsAt")}
              type="time"
              value={bell.ramadanStartsAt}
              onChange={(event) => bell.patch({ ramadanStartsAt: event.target.value })}
            />
          </FormField>
          <FormField name="ramadanPeriods" label={t.setup.bell.ramadanPeriods}>
            <Input
              {...controlProps("ramadanPeriods")}
              type="number"
              min={0}
              max={12}
              value={bell.ramadanPeriods}
              onChange={(event) => bell.patch({ ramadanPeriods: event.target.value })}
            />
          </FormField>
        </FormGrid>
      ) : null}

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t.setup.bell.preview}</h3>
        <div className="flex flex-wrap gap-2">
          {monday.map((slot) => (
            <Badge key={`${slot.startTime}-${slot.position}`} variant={slot.isBreak ? "outline" : "secondary"}>
              {slot.isBreak
                ? `${t.setup.bell.break} ${slot.startTime}`
                : `${slot.startTime}–${slot.endTime}`}
            </Badge>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {interpolate(t.setup.bell.slotCount, { count: preview.length })}
        </p>
      </section>
    </div>
  );
}
