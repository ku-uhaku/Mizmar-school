"use client";

import { PrinterIcon } from "lucide-react";
import Link from "next/link";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { interpolate } from "@/lib/i18n/format";
import type { TeacherWeek as TeacherWeekData } from "@/modules/timetable/queries";

/**
 * The week a teacher actually works, beside the week they are *available* for.
 *
 * The two answer different questions and a staffroom needs both on one screen:
 * the availability grid is the constraint — when may this teacher be booked —
 * and this is the result — when have they been. Reading one without the other
 * is how somebody frees a Tuesday morning that already has a lesson in it.
 *
 * Read-only by design. A lesson is moved on the class grid next door, where the
 * class, the room and the clash check all are; editing from here would need
 * every one of those rules a second time.
 */
export function TeacherWeek({
  week,
  teacherId,
  teacherName,
  scheduleKind,
  weekNumber,
  days,
}: {
  week: TeacherWeekData;
  teacherId: string;
  teacherName: string;
  scheduleKind: string;
  /** Carried into the printed sheet, so it names the week on screen. */
  weekNumber?: number;
  /** ISO day number → its name, from the dictionary. */
  days: Record<string, string>;
}) {
  const t = useT();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t.timetable.teacherWeekTitle}</CardTitle>
        <CardDescription>
          {interpolate(t.timetable.teacherWeekSummary, {
            lessons: week.lessonCount,
            classes: week.classCount,
          })}
        </CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            {/* Carries the bell schedule and the week through, so printing the
              Ramadan grid does not silently hand back the standard one. */}
            <Link
              href={`/print/teacher/${teacherId}/timetable?schedule=${scheduleKind}${
                weekNumber ? `&week=${weekNumber}` : ""
              }`}
            >
              <PrinterIcon />
              {t.print.timetable}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="overflow-x-auto p-0">
        {week.lessonCount === 0 ? (
          <p className="text-muted-foreground px-6 py-8 text-center text-sm">
            {interpolate(t.timetable.teacherWeekEmpty, { name: teacherName })}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-muted-foreground w-24 px-3 py-2 text-start text-xs font-medium">
                  {t.timetable.day}
                </th>
                {week.columns.map((column) => (
                  <th
                    key={column.key}
                    className="text-muted-foreground px-2 py-2 text-center text-xs font-medium"
                  >
                    {/* LTR on the times even in Arabic: "08:00" is a clock
                      reading, not a phrase, and the bidi algorithm would flip
                      the two halves of the range around the dash. */}
                    <span dir="ltr">
                      {column.startTime}–{column.endTime}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {week.rows.map((row) => (
                <tr key={row.dayOfWeek} className="border-t">
                  <th
                    scope="row"
                    className="px-3 py-2 text-start text-xs font-medium"
                  >
                    {days[String(row.dayOfWeek)] ?? row.dayOfWeek}
                  </th>
                  {week.columns.map((column) => {
                    const lesson = row.cells[column.key] ?? null;

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "border-s px-2 py-1.5 text-center align-middle",
                          // A free period is the thing a teacher scans for, so
                          // it is left plainly empty rather than filled.
                          column.isBreak && "bg-muted/40",
                        )}
                        style={
                          lesson?.colorHex
                            ? {
                                backgroundColor: `${lesson.colorHex}22`,
                                borderInlineStart: `2px solid ${lesson.colorHex}`,
                              }
                            : undefined
                        }
                      >
                        {lesson ? (
                          <span className="block min-w-0">
                            <span className="block truncate text-xs font-medium">
                              {lesson.subjectShort}
                            </span>
                            <span className="text-muted-foreground block truncate text-[11px]">
                              {[
                                lesson.classCode,
                                lesson.groupLabel,
                                lesson.roomCode,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
