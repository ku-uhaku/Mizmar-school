"use client";

import Link from "next/link";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TeacherWeek as TeacherWeekData } from "@/modules/timetable/queries";

/**
 * A teacher's own week.
 *
 * Days down the side and periods across the top, which is the shape a Moroccan
 * emploi du temps is printed in — a teacher reading their own is looking for
 * "where am I at 10 on Tuesday", and that is a row-then-column lookup.
 *
 * A free period is drawn as an empty cell rather than left out, because the gap
 * *is* the information: it is when they can be found, and when a colleague can
 * ask them to cover. A period the school does not run that day is greyed
 * instead, so an empty Saturday afternoon does not read as availability.
 */
export function TeacherWeek({ week }: { week: TeacherWeekData }) {
  const t = useT();

  if (week.columns.length === 0 || week.lessonCount === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title={t.classroom.noLessonsThisWeek}
            description={t.classroom.noLessonsThisWeekHint}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-muted-foreground bg-muted/40 sticky start-0 z-10 px-3 py-2 text-start text-xs font-medium">
                {t.classroom.lesson}
              </th>
              {week.columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "min-w-28 px-2 py-2 text-center text-xs font-medium",
                    column.isBreak && "text-muted-foreground",
                  )}
                >
                  <span className="tabular-nums" dir="ltr">
                    {column.startTime}
                  </span>
                  <span
                    className="text-muted-foreground block text-[10px] tabular-nums"
                    dir="ltr"
                  >
                    {column.endTime}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {week.rows.map((row) => (
              <tr key={row.dayOfWeek} className="border-b last:border-b-0">
                <th className="text-muted-foreground bg-muted/40 sticky start-0 z-10 px-3 py-2 text-start text-xs font-medium whitespace-nowrap">
                  {
                    t.timetable.days[
                      String(row.dayOfWeek) as keyof typeof t.timetable.days
                    ]
                  }
                </th>

                {week.columns.map((column) => {
                  const lesson = row.cells[column.key];

                  if (!lesson) {
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "border-s p-1 align-top",
                          column.isBreak && "bg-muted/30",
                        )}
                      />
                    );
                  }

                  return (
                    <td key={column.key} className="border-s p-1 align-top">
                      <Link
                        href={`/classes/${lesson.schoolClassId}`}
                        className="hover:ring-primary/40 block rounded-md p-1.5 transition-shadow hover:ring-2"
                        style={{
                          // A tint rather than a fill: the subject colour has to
                          // sit behind text that stays readable in both themes.
                          backgroundColor: lesson.colorHex
                            ? `color-mix(in oklch, ${lesson.colorHex} 16%, transparent)`
                            : undefined,
                        }}
                      >
                        <span className="block truncate text-xs font-medium">
                          {lesson.classCode}
                          {lesson.groupLabel ? ` · ${lesson.groupLabel}` : ""}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {lesson.subjectShort}
                          {lesson.roomCode ? ` · ${lesson.roomCode}` : ""}
                        </span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
