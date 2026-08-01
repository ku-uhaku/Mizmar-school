import type { Metadata } from "next";

import { PrintDocument } from "@/components/print/print-document";
import { ForbiddenState } from "@/components/shell/states";
import { displayName, requireAuth } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { letterheadFrom } from "@/lib/letterhead";
import { PERMISSIONS } from "@/lib/permissions";
import { PrintableWeekTable } from "@/modules/timetable/components/printable-week";
import type { PrintableWeek } from "@/modules/timetable/components/printable-week";
import { loadTeacherTimetable } from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Mon emploi du temps" };

/**
 * The signed-in teacher's own week, on paper.
 *
 * Their *own*, and no route parameter to make it otherwise: the on-screen page
 * this is printed from reads `context.user.id` for the same reason, and a
 * `[teacherId]` segment here would be a way to read a colleague's week that the
 * app deliberately does not offer.
 *
 * Cells name the class rather than the teacher — the one fact the reader
 * already knows is whose sheet it is.
 */
export default async function TeacherTimetablePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ schedule?: string }>;
}) {
  const { schedule } = await searchParams;
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
    return <ForbiddenState />;
  }

  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";
  const week = await loadTeacherTimetable(
    context,
    context.user.id,
    scheduleKind,
  );

  const printable: PrintableWeek = {
    columns: week.columns,
    rows: week.rows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      cells: week.columns.map((column) => {
        const lesson = row.cells[column.key] ?? null;

        return {
          lines: lesson
            ? [
                lesson.subjectName,
                [lesson.classCode, lesson.groupLabel, lesson.roomCode]
                  .filter(Boolean)
                  .join(" · "),
              ].filter(Boolean)
            : [],
          // A teacher's week is drawn period by period — a double lesson is two
          // identical cells, and merging them is the class grid's business.
          span: 1,
          covered: false,
          isBreak: column.isBreak,
        };
      }),
    })),
  };

  return (
    <PrintDocument
      letterhead={letterheadFrom(context)}
      title={t.print.teacherTimetable}
      subtitle={`${displayName(context.user)} · ${
        context.currentSchoolYear?.name ?? ""
      }`}
      backHref="/teacher/timetable"
      orientation="landscape"
      locale={locale}
      t={t}
    >
      <PrintableWeekTable week={printable} t={t} />
    </PrintDocument>
  );
}
