"use client";

import * as React from "react";
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
import { EntryDetailsDialog } from "@/modules/timetable/components/entry-details-dialog";
import type {
  DetailSubjectChoice,
  EntryDetailView,
  TeacherLesson,
  TeacherWeek as TeacherWeekData,
} from "@/modules/timetable/queries";

/**
 * The week a teacher actually works, beside the week they are *available* for.
 *
 * The two answer different questions and a staffroom needs both on one screen:
 * the availability grid is the constraint — when may this teacher be booked —
 * and this is the result — when have they been. Reading one without the other
 * is how somebody frees a Tuesday morning that already has a lesson in it.
 *
 * A lesson is still moved on the class grid next door, where the class, the room
 * and the clash check all are; editing that from here would need every one of
 * those rules a second time. What *can* be done here is say what is taught
 * inside a lesson and when — "Grammaire 08:00–08:30" — by clicking its cell,
 * which adds lines under the subject and leaves the lesson as it is.
 */
export function TeacherWeek({
  week,
  teacherId,
  teacherName,
  scheduleKind,
  weekNumber,
  days,
  subjects,
  canManage,
}: {
  week: TeacherWeekData;
  teacherId: string;
  teacherName: string;
  scheduleKind: string;
  /** Carried into the printed sheet, so it names the week on screen. */
  weekNumber?: number;
  /** ISO day number → its name, from the dictionary. */
  days: Record<string, string>;
  /** What a line of detail may name — see `listDetailSubjects`. */
  subjects: DetailSubjectChoice[];
  canManage: boolean;
}) {
  const t = useT();

  /** The lesson whose details are being edited, when the dialog is open. */
  const [editing, setEditing] = React.useState<{
    lesson: TeacherLesson;
    startTime: string;
    endTime: string;
    details: EntryDetailView[];
  } | null>(null);

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
          <Button asChild variant="outline" size="sm">
            {/* Carries the bell schedule and the week through, so printing the
              Ramadan grid does not silently hand back the standard one. */}
            <Link
              href={`/print/teacher/${teacherId}/timetable?schedule=${scheduleKind}${
                weekNumber ? `&week=${weekNumber}` : ""
              }&details=1`}
            >
              <PrinterIcon />
              {t.timetable.printWithDetails}
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
                    const layout = row.layout[column.key];

                    // Drawn by the period that started the run — its `colSpan`
                    // already covers this column.
                    if (layout?.covered) return null;

                    // What is under any period of the run belongs to the cell,
                    // and the session ends where its last period does.
                    const runKeys = layout?.keys ?? [column.key];
                    const details = runKeys
                      .flatMap((key) => row.cells[key]?.details ?? [])
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    const endTime =
                      week.columns.find(
                        (candidate) =>
                          candidate.key === runKeys[runKeys.length - 1],
                      )?.endTime ?? column.endTime;

                    return (
                      <td
                        key={column.key}
                        colSpan={layout?.span ?? 1}
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
                          canManage ? (
                            <button
                              type="button"
                              title={t.timetable.detailEditTip}
                              onClick={() =>
                                setEditing({
                                  lesson,
                                  startTime: column.startTime,
                                  endTime,
                                  details,
                                })
                              }
                              className="hover:bg-foreground/5 -mx-2 -my-1.5 block w-[calc(100%+1rem)] cursor-pointer px-2 py-1.5"
                            >
                              <LessonBody lesson={lesson} details={details} />
                            </button>
                          ) : (
                            <LessonBody lesson={lesson} details={details} />
                          )
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

      {editing ? (
        <EntryDetailsDialog
          key={editing.lesson.timetableEntryId}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          entryId={editing.lesson.timetableEntryId}
          subjectId={editing.lesson.subjectId}
          subjectName={editing.lesson.subjectName}
          slot={{ startTime: editing.startTime, endTime: editing.endTime }}
          subjects={subjects}
          details={editing.details}
        />
      ) : null}
    </Card>
  );
}

/**
 * The lesson as the cell draws it: the subject it is, the class it is for, and
 * under them whatever is taught inside it and when. The subject line is never
 * replaced by a detail — the hour is still Arabe, the details say what of it.
 */
function LessonBody({
  lesson,
  details,
}: {
  lesson: TeacherLesson;
  /** From every period of the session, not only its first. */
  details: EntryDetailView[];
}) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-xs font-medium">
        {lesson.subjectShort}
      </span>
      <span className="text-muted-foreground block truncate text-[11px]">
        {[lesson.classCode, lesson.groupLabel, lesson.roomCode]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {details.map((detail) => (
        <span
          key={detail.id}
          className="text-foreground/80 block truncate text-[10px] leading-tight"
        >
          {/* LTR on the times even in Arabic — a clock reading, not a phrase. */}
          <span dir="ltr" className="text-muted-foreground me-1">
            {detail.startTime}–{detail.endTime}
          </span>
          {detail.subjectShort}
        </span>
      ))}
    </span>
  );
}
