import type { Metadata } from "next";
import Link from "next/link";
import { ClockIcon, PrinterIcon } from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ClassPicker } from "@/modules/timetable/components/class-picker";
import { GenerateTimeSlotsButton } from "@/modules/timetable/components/generate-time-slots-button";
import { GenerateWeeksButton } from "@/modules/timetable/components/generate-weeks-button";
import { ProgrammeGaps } from "@/modules/timetable/components/programme-gaps";
import { TimetableGenerator } from "@/modules/timetable/components/timetable-generator";
import { TimetableGrid } from "@/modules/timetable/components/timetable-grid";
import { WeekPicker } from "@/modules/timetable/components/week-picker";
import {
  listTimetableClasses,
  loadClassTimetable,
  loadProgrammeCoverage,
  loadTimetableChoices,
  loadWeekContext,
  loadWeekOverlay,
} from "@/modules/timetable/queries";
import { holidaysByWeekday } from "@/modules/timetable/holidays";

export const metadata: Metadata = { title: "Emploi du temps" };

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; schedule?: string; week?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TIMETABLE_VIEW)) {
    return <ForbiddenState />;
  }

  const { classId, schedule, week } = await searchParams;
  const classes = await listTimetableClasses(context);

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={t.timetable.title} description={t.timetable.subtitle} />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={t.timetable.noClasses}
              description={t.timetable.noClassesHint}
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/configuration/classes/classes">
                    {t.configuration.title}
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </>
    );
  }

  // A class id from the query is only ever a *hint*: `loadClassTimetable` scopes
  // it to the school and year in context, so one from elsewhere falls back here
  // rather than drawing another school's week.
  const selected =
    classes.find((schoolClass) => schoolClass.id === classId) ?? classes[0];
  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";

  // The week first: the grid is drawn for one week, and which lessons are in
  // force depends on it — see the window on TimetableEntry.
  const weekContext = await loadWeekContext(context, week);
  const weekNumber = weekContext.current?.index ?? null;

  const [grid, choices, coverage] = await Promise.all([
    loadClassTimetable(context, selected.id, scheduleKind, weekNumber),
    loadTimetableChoices(context, selected.id),
    // What the programme still owes this class. Read here rather than kept from
    // the generator's own report: the hours to place by hand are what somebody
    // needs *after* the dialog has closed. See `loadProgrammeCoverage`.
    loadProgrammeCoverage(context, selected.id, scheduleKind),
  ]);

  const holidays = holidaysByWeekday(weekContext);
  // The week's own changes, loaded after it is resolved — the overlay is keyed
  // on the Monday, and that is only known once `loadWeekContext` has clamped it.
  const overlay = await loadWeekOverlay(
    context,
    selected.id,
    weekContext.current?.start ?? null,
  );

  return (
    <>
      <PageHeader title={t.timetable.title} description={t.timetable.subtitle}>
        <Button asChild variant="outline" size="sm">
          {/* Carries the bell schedule through, so printing the Ramadan grid
            does not silently hand back the standard one. */}
          <Link
            href={`/print/class/${selected.id}/timetable?schedule=${scheduleKind}${
              weekContext.current ? `&week=${weekContext.current.index}` : ""
            }`}
          >
            <PrinterIcon />
            {t.print.timetable}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/classes/${selected.id}`}>{t.timetable.openClass}</Link>
        </Button>
        {/* Beside the generator, because it is the constraint the generator
          plans around: somebody who dislikes a drawn week fixes the horaires
          here and draws again. */}
        <Button asChild variant="outline" size="sm">
          <Link href={`/timetable/availability?schedule=${scheduleKind}`}>
            <ClockIcon />
            {t.timetable.teacherHours}
          </Link>
        </Button>
        {/* The weeks are the spine the grid hangs on, so the button that lays
          them out belongs here rather than three screens away. */}
        {context.can(PERMISSIONS.TIMETABLE_MANAGE) ? (
          <>
            <GenerateTimeSlotsButton />
            <GenerateWeeksButton />
            {/* Beside the grid it fills in, and carrying the bell schedule the
              page is showing — generating the standard week from the Ramadan
              view would write into the wrong set of slots. */}
            <TimetableGenerator
              classCount={classes.length}
              currentClassId={selected.id}
              scheduleKind={scheduleKind}
              // 30 when the grid has not loaded: the dialog only needs it to
              // convert hours into periods, and the request is re-derived
              // server-side against the real bell schedule anyway.
              periodMinutes={grid?.periodMinutes ?? 30}
            />
          </>
        ) : null}
      </PageHeader>

      <ClassPicker
        classes={classes}
        classId={selected.id}
        scheduleKind={scheduleKind}
      />

      <WeekPicker context={weekContext} />

      {/* Above the grid, because it is a list of things to do *to* the grid —
        and it disappears on its own as they are done. */}
      {grid ? <ProgrammeGaps coverage={coverage} t={t} /> : null}

      {grid && choices ? (
        <TimetableGrid
          grid={grid}
          schoolClassId={selected.id}
          choices={choices}
          canManage={context.can(PERMISSIONS.TIMETABLE_MANAGE)}
          holidaysByDay={holidays}
          overlay={overlay}
          weekStart={weekContext.current?.start ?? null}
          weekNumber={weekContext.current?.index ?? null}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={t.timetable.noSlots}
              description={t.timetable.noSlotsHint}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
