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
import { WeekAxis } from "@/modules/timetable/components/week-axis";
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
          <WeekAxis
            corner={t.timetable.day}
            rowHeightClass="h-16"
            days={week.rows.map((row) => {
              const daySlots = week.slots
                .filter((slot) => slot.dayOfWeek === row.dayOfWeek)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              return {
                key: row.dayOfWeek,
                label: (
                  <span className="text-xs">
                    {days[String(row.dayOfWeek)] ?? row.dayOfWeek}
                  </span>
                ),
                items: daySlots.flatMap((slot) => {
                  const key = `${slot.startTime}-${slot.endTime}`;
                  const lesson = row.cells[key] ?? null;
                  const layout = row.layout[key];

                  // Drawn by the period that started the run, which is already
                  // as wide as the whole session.
                  if (layout?.covered) return [];

                  // What is under any period of the run belongs to the block,
                  // and the session ends where its last period does.
                  const runKeys = layout?.keys ?? [key];
                  const details = runKeys
                    .flatMap((runKey) => row.cells[runKey]?.details ?? [])
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const endTime = runKeys[runKeys.length - 1].split("-")[1] ?? slot.endTime;

                  const box = (children: React.ReactNode, className?: string) => [
                    {
                      key: slot.id,
                      startTime: slot.startTime,
                      endTime,
                      children: (
                        <div
                          className={cn(
                            "flex h-full items-center justify-center rounded-md px-1.5 text-center",
                            className,
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
                          {children}
                        </div>
                      ),
                    },
                  ];

                  if (slot.isBreak && !lesson) {
                    return box(
                      <span
                        className={cn(
                          "text-muted-foreground text-[10px]",
                          slot.minutes < 40 && "[writing-mode:vertical-rl]",
                        )}
                      >
                        {t.timetable.breakLabel}
                      </span>,
                      "bg-muted/50",
                    );
                  }

                  // A free period is the thing a teacher scans for, so it is left
                  // plainly empty — outlined, to read as free rather than closed.
                  if (!lesson) return box(null, "border border-dashed");

                  return box(
                    canManage ? (
                      <button
                        type="button"
                        title={t.timetable.detailEditTip}
                        onClick={() =>
                          setEditing({
                            lesson,
                            startTime: slot.startTime,
                            endTime,
                            details,
                          })
                        }
                        className="hover:bg-foreground/5 block h-full w-full min-w-0 cursor-pointer rounded-md"
                      >
                        <LessonBody lesson={lesson} details={details} />
                      </button>
                    ) : (
                      <LessonBody lesson={lesson} details={details} />
                    ),
                  );
                }),
              };
            })}
          />
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
