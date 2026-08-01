import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { findClass } from "@/modules/classes/queries";
import { PrintableWeekTable } from "@/modules/timetable/components/printable-week";
import type { PrintableWeek } from "@/modules/timetable/components/printable-week";
import { holidaysByWeekday } from "@/modules/timetable/holidays";
import { loadClassTimetable, loadWeekContext } from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Emploi du temps" };

/**
 * A class's week, on paper — the copy that goes up on the classroom wall.
 *
 * Landscape, because six days of a dozen periods do not fit across A4 portrait
 * at a size anyone can read from a noticeboard.
 *
 * `schedule` picks the bell schedule, exactly as on the screen it is printed
 * from: a school running a Ramadan timetable needs to print that one too, and
 * having to switch the app back and forth to get the right sheet is how the
 * wrong week ends up on the wall.
 */
export default async function ClassTimetablePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ schedule?: string; week?: string }>;
}) {
  const { classId } = await params;
  const { schedule, week } = await searchParams;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.TIMETABLE_VIEW)) {
    return <ForbiddenState />;
  }

  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";

  const [schoolClass, grid, weekContext] = await Promise.all([
    findClass(context, classId),
    // Scoped to the school and year in context, so a class id from elsewhere
    // reads as absent rather than drawing another school's week.
    loadClassTimetable(context, classId, scheduleKind),
    loadWeekContext(context, week),
  ]);

  if (!schoolClass || !grid) notFound();

  const holidays = holidaysByWeekday(weekContext);

  const printable: PrintableWeek = {
    columns: grid.columns,
    rows: grid.rows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      cells: grid.columns.map((column) => {
        const cell = row.cells[column.key];
        const entry = cell?.entry ?? null;

        // A day off prints as the holiday's name rather than the lessons that
        // would have run: the sheet on the wall must not tell a class to turn
        // up for Maths on a jour férié.
        const holiday = holidays[row.dayOfWeek];

        return {
          lines: holiday
            ? [holiday]
            : entry
            ? [
                entry.subjectName,
                [entry.teacherName, entry.roomCode, entry.groupLabel]
                  .filter(Boolean)
                  .join(" · "),
              ].filter(Boolean)
            : [],
          span: entry?.span ?? 1,
          covered: cell?.covered ?? false,
          isBreak: (cell?.isBreak ?? false) || Boolean(holiday),
        };
      }),
    })),
  };

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.timetable}
      subtitle={`${schoolClass.code} · ${schoolClass.levelLabel} · ${
        context.currentSchoolYear?.name ?? ""
      }`}
      reference={
        weekContext.current
          ? interpolate(t.timetable.weekNumber, {
              number: weekContext.current.index,
            })
          : undefined
      }
      backHref={`/timetable?classId=${schoolClass.id}`}
      orientation="landscape"
      locale={locale}
      t={t}
    >
      <PrintableWeekTable week={printable} t={t} />
    </PrintDocument>
  );
}
