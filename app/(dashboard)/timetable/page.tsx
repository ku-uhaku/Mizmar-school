import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ClassPicker } from "@/modules/timetable/components/class-picker";
import { TimetableGrid } from "@/modules/timetable/components/timetable-grid";
import {
  listTimetableClasses,
  loadClassTimetable,
  loadTimetableChoices,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Emploi du temps" };

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; schedule?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TIMETABLE_VIEW)) {
    return <ForbiddenState />;
  }

  const { classId, schedule } = await searchParams;
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

  const [grid, choices] = await Promise.all([
    loadClassTimetable(context, selected.id, scheduleKind),
    loadTimetableChoices(context, selected.id),
  ]);

  return (
    <>
      <PageHeader title={t.timetable.title} description={t.timetable.subtitle}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/classes/${selected.id}`}>{t.timetable.openClass}</Link>
        </Button>
      </PageHeader>

      <ClassPicker
        classes={classes}
        classId={selected.id}
        scheduleKind={scheduleKind}
      />

      {grid && choices ? (
        <TimetableGrid
          grid={grid}
          schoolClassId={selected.id}
          choices={choices}
          canManage={context.can(PERMISSIONS.TIMETABLE_MANAGE)}
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
