"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarOffIcon,
} from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, interpolate } from "@/lib/i18n/format";
import type { HolidayRow, WeekContext } from "@/modules/timetable/queries";

/**
 * Which week of the year the grid is showing, and how to get to another one.
 *
 * ── Bounded by the school year, on purpose ───────────────────────────────────
 * The arrows stop at the first and last week the year actually has. A school
 * year runs September to July and the application is used in August too, so an
 * unbounded "next week" walks straight out of the calendar and draws a grid for
 * a week that does not exist. `weeks.ts` clamps it; this only renders what it
 * is given.
 *
 * Weeks fully covered by a holiday are labelled with it rather than hidden: a
 * secretary looking for "the week of 10 February" needs to find it and be told
 * it is the mi-année break, not to have it silently missing from the list.
 */
export function WeekPicker({ context }: { context: WeekContext }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { weeks, current, holidays } = context;

  /** The holiday covering a week, if one swallows it whole. */
  const holidayFor = React.useCallback(
    (start: string, end: string): HolidayRow | null =>
      holidays.find(
        (holiday) => holiday.startDate <= start && holiday.endDate >= end,
      ) ?? null,
    [holidays],
  );

  if (!current || weeks.length === 0) return null;

  const position = weeks.findIndex((week) => week.index === current.index);
  const previous = position > 0 ? weeks[position - 1] : null;
  const next = position < weeks.length - 1 ? weeks[position + 1] : null;

  function goTo(index: number) {
    // Every other filter on the screen — the class, the bell schedule — is a
    // query param too, so the week is merged in rather than replacing them.
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", String(index));
    router.push(`?${params.toString()}`);
  }

  const currentHoliday = holidayFor(current.start, current.end);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        // Start of the year: there is no earlier week to show.
        disabled={!previous}
        onClick={() => previous && goTo(previous.index)}
        aria-label={t.timetable.previousWeek}
      >
        {/* Logical, not directional: the "previous" arrow points the other way
          in Arabic, and the icon has to follow the reading direction. */}
        <ChevronLeftIcon className="rtl:rotate-180" />
      </Button>

      <Select
        value={String(current.index)}
        onValueChange={(value) => goTo(Number(value))}
      >
        <SelectTrigger className="w-auto min-w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {weeks.map((week) => {
            const holiday = holidayFor(week.start, week.end);
            return (
              <SelectItem key={week.index} value={String(week.index)}>
                {interpolate(t.timetable.weekNumber, { number: week.index })}
                {" · "}
                {formatDate(week.start, locale)}
                {holiday ? ` · ${holiday.name}` : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon-sm"
        disabled={!next}
        onClick={() => next && goTo(next.index)}
        aria-label={t.timetable.nextWeek}
      >
        <ChevronRightIcon className="rtl:rotate-180" />
      </Button>

      <span className="text-muted-foreground text-xs">
        {formatDate(current.start, locale)} – {formatDate(current.end, locale)}
      </span>

      {currentHoliday ? (
        <Badge variant="secondary" className="gap-1">
          <CalendarOffIcon className="size-3" />
          {currentHoliday.name}
        </Badge>
      ) : null}
    </div>
  );
}
