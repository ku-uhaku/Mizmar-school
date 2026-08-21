import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { PrintableWeekTable } from "@/modules/timetable/components/printable-week";
import type { PrintableWeek } from "@/modules/timetable/components/printable-week";
import { holidaysByWeekday } from "@/modules/timetable/holidays";
import {
  listTeacherOptions,
  loadTeacherTimetable,
  loadWeekContext,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Emploi du temps" };

/**
 * One teacher's week, on paper — the copy that goes in their pigeonhole.
 *
 * The class sheet's twin, and deliberately the same table: a staffroom that has
 * learnt to read one should not have to learn the other. What changes is what
 * each cell names. A class grid names the teacher, because the class is
 * already known; this one names the *class*, because the teacher is — see
 * `loadTeacherTimetable` for the same reasoning behind the query.
 *
 * Landscape, and carrying the bell schedule through, for the reasons given on
 * the class sheet.
 */
export default async function TeacherTimetablePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ teacherId: string }>;
  searchParams: Promise<{ schedule?: string; week?: string }>;
}) {
  const { teacherId } = await params;
  const { schedule, week } = await searchParams;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.TIMETABLE_VIEW)) {
    return <ForbiddenState />;
  }

  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";

  const [teachers, grid, weekContext] = await Promise.all([
    // The name comes from the same scoped list the picker offers, so a teacher
    // id from another school resolves to nothing rather than printing a sheet
    // headed with a name this school never employed.
    listTeacherOptions(context, scheduleKind),
    loadTeacherTimetable(context, teacherId, scheduleKind),
    loadWeekContext(context, week),
  ]);

  const teacher = teachers.find((option) => option.id === teacherId);
  if (!teacher) notFound();

  const holidays = holidaysByWeekday(weekContext);

  const printable: PrintableWeek = {
    columns: grid.columns,
    rows: grid.rows.map((row) => {
      const holiday = holidays[row.dayOfWeek];

      return {
        dayOfWeek: row.dayOfWeek,
        cells: grid.columns.map((column) => {
          const lesson = row.cells[column.key] ?? null;

          return {
            // A day off prints as the holiday's name rather than the lessons
            // that would have run — the same rule as the class sheet.
            lines: holiday
              ? [holiday]
              : lesson
                ? [
                    lesson.subjectName,
                    [lesson.classCode, lesson.groupLabel, lesson.roomCode]
                      .filter(Boolean)
                      .join(" · "),
                  ].filter(Boolean)
                : [],
            /*
              Never merged, unlike the class sheet. A class reads a double
              period as one lesson; a teacher reads their week to find out
              which periods they are booked for, and a cell spanning two hides
              that the second one is taken.
            */
            span: 1,
            covered: false,
            isBreak: Boolean(column.isBreak) || Boolean(holiday),
            colorHex: holiday ? null : (lesson?.colorHex ?? null),
          };
        }),
      };
    }),
  };

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.timetable}
      subtitle={`${teacher.label} · ${context.currentSchoolYear?.name ?? ""}`}
      reference={
        weekContext.current
          ? interpolate(t.timetable.weekNumber, {
              number: weekContext.current.index,
            })
          : undefined
      }
      backHref={`/timetable/availability?teacherId=${teacherId}&schedule=${scheduleKind}`}
      orientation="landscape"
      locale={locale}
      t={t}
    >
      <PrintableWeekTable week={printable} t={t} />
    </PrintDocument>
  );
}
