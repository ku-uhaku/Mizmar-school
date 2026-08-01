import type { Metadata } from "next";
import Link from "next/link";
import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ScheduleKindTabs } from "@/modules/classroom/components/schedule-kind-tabs";
import { TeacherWeek } from "@/modules/classroom/components/teacher-week";
import { loadTeacherTimetable } from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Mon emploi du temps" };

/**
 * The signed-in teacher's own week.
 *
 * Read from `TimetableEntry` where they are the teacher — so it needs no
 * permission beyond the workspace itself: a teacher is always allowed to see
 * where they are expected to be, and this shows nobody else's grid.
 */
export default async function TeacherTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ schedule?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
    return <ForbiddenState />;
  }

  const { schedule } = await searchParams;
  // Moroccan schools switch to a compressed day for Ramadan; the grid is
  // stored twice rather than rewritten, so the choice is just which one to read.
  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";

  const week = await loadTeacherTimetable(
    context,
    context.user.id,
    scheduleKind,
  );

  return (
    <>
      <PageHeader
        title={t.classroom.myTimetable}
        description={t.classroom.myTimetableHint}
        backHref="/teacher"
        backLabel={t.classroom.title}
      >
        <Button asChild variant="outline" size="sm">
          <Link href={`/print/teacher/timetable?schedule=${scheduleKind}`}>
            <PrinterIcon />
            {t.print.download}
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label={t.classroom.lessonsPerWeek}
            value={week.lessonCount}
            detail={t.classroom.myTimetableHint}
            locale={locale}
          />
          <StatTile
            label={t.classroom.myClasses}
            value={week.classCount}
            detail={t.classroom.myClassesHint}
            locale={locale}
            href="/teacher"
          />
          <StatTile
            label={t.classroom.freePeriods}
            // Every cell of the grid that runs a period and holds no lesson.
            value={week.rows.reduce(
              (total, row) =>
                total +
                week.columns.filter(
                  (column) => !column.isBreak && row.cells[column.key] === null,
                ).length,
              0,
            )}
            detail={t.classroom.freePeriodsHint}
            locale={locale}
          />
        </div>

        <ScheduleKindTabs scheduleKind={scheduleKind} />

        <TeacherWeek week={week} />
      </div>
    </>
  );
}
