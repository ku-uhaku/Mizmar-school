"use client";

import Link from "next/link";
import { ClipboardCheckIcon, MessageSquareTextIcon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { AssessmentRow } from "@/modules/assessments/queries";
import type {
  ClassroomActivity,
  ClassroomActivityMark,
} from "@/modules/classroom/queries";

/**
 * What the teaching staff has recorded, as the office reads it.
 *
 * Everything a teacher types goes somewhere only they look — the register into
 * their own appel screen, the remark into their carnet, the marks into their
 * mark sheet — and none of it reached this desk without opening each class in
 * turn. These three lists are that: the day's absences with the reason the
 * teacher gave, the latest remarks, and the papers handed in and waiting to be
 * accepted.
 *
 * Each block disappears when it is empty rather than showing a "nothing yet"
 * panel, so the card is a list of things to act on and never a wall of blanks.
 */
export function TeacherActivity({
  classroom,
  awaitingValidation,
}: {
  classroom: ClassroomActivity;
  awaitingValidation: AssessmentRow[];
}) {
  const { t, locale } = useI18n();

  const hasMarks = classroom.marks.length > 0;
  const hasRemarks = classroom.remarks.length > 0;
  const hasPapers = awaitingValidation.length > 0;
  if (!hasMarks && !hasRemarks && !hasPapers) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hasMarks ? (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base">
              {t.schoolLife.absencesToday}
            </CardTitle>
            <CardDescription>
              {interpolate(t.schoolLife.absencesTodayHint, {
                registers: classroom.registersTaken,
              })}
            </CardDescription>
            <div className="ms-auto flex shrink-0 gap-1.5">
              {classroom.unjustifiedToday > 0 ? (
                <Badge
                  variant="outline"
                  className="text-warning border-warning/40 tabular-nums"
                >
                  {interpolate(t.classroom.unjustifiedCount, {
                    count: classroom.unjustifiedToday,
                  })}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {classroom.marks.map((mark) => (
                <MarkLine key={mark.id} mark={mark} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {hasPapers ? (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base">
              {t.schoolLife.awaitingValidation}
            </CardTitle>
            <CardDescription>
              {t.schoolLife.awaitingValidationHint}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {awaitingValidation.map((paper) => (
                <li
                  key={paper.id}
                  className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <ClipboardCheckIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {paper.title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {paper.classCode} · {paper.subjectName}
                      {paper.teacherName ? ` · ${paper.teacherName}` : ""}
                    </span>
                  </span>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/assessments/${paper.id}`}>
                      {t.assessment.acceptMarks}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {hasRemarks ? (
        <Card className="gap-4 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t.schoolLife.latestRemarks}
            </CardTitle>
            <CardDescription>{t.schoolLife.latestRemarksHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {classroom.remarks.map((remark) => (
                <li
                  key={remark.id}
                  className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <MessageSquareTextIcon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      remark.tone === "CONCERN"
                        ? "text-destructive"
                        : remark.tone === "POSITIVE"
                          ? "text-success"
                          : "text-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-pretty">
                      {remark.body}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      <Link
                        href={`/students/${remark.studentId}`}
                        className="hover:underline"
                      >
                        {remark.studentName}
                      </Link>
                      {` · ${remark.classCode}`}
                      {remark.authorName ? ` · ${remark.authorName}` : ""}
                      {` · ${formatDate(remark.occurredOn, locale)}`}
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="secondary">
                      {
                        t.classroomOptions.remarkKinds[
                          remark.kind as keyof typeof t.classroomOptions.remarkKinds
                        ]
                      }
                    </Badge>
                    {remark.isVisibleToFamily ? (
                      <Badge variant="outline">{t.classroom.shared}</Badge>
                    ) : (
                      <Badge variant="outline">
                        {t.classroom.internalOnly}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** One pupil missing from one lesson, and the note the teacher left. */
function MarkLine({ mark }: { mark: ClassroomActivityMark }) {
  const { t } = useI18n();

  return (
    <li className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="text-muted-foreground w-10 shrink-0 pt-0.5 text-xs tabular-nums">
        {mark.startTime ?? t.classroom.wholeDay}
      </span>
      <span className="min-w-0 flex-1">
        <Link
          href={`/students/${mark.studentId}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {mark.studentName}
        </Link>
        <span className="text-muted-foreground block truncate text-xs">
          {mark.classCode}
          {mark.subjectName ? ` · ${mark.subjectName}` : ""}
          {mark.recordedByName ? ` · ${mark.recordedByName}` : ""}
        </span>
        {/* The teacher's own words. The reason they typed is the whole point of
            surfacing this here — a count of absences is on the tile above. */}
        {mark.reason ? (
          <span className="mt-0.5 block text-xs text-pretty italic">
            “{mark.reason}”
          </span>
        ) : null}
      </span>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            mark.status === "LATE"
              ? "text-warning border-warning/40"
              : "text-destructive border-destructive/40",
          )}
        >
          {
            t.classroomOptions.attendanceStatuses[
              mark.status as keyof typeof t.classroomOptions.attendanceStatuses
            ]
          }
          {mark.status === "LATE" && mark.minutesLate
            ? ` · ${interpolate(t.classroom.minutesLateShort, {
                count: mark.minutesLate,
              })}`
            : ""}
        </Badge>
        {mark.isJustified ? (
          <Badge variant="outline" className="text-success border-success/40">
            {t.classroom.justified}
          </Badge>
        ) : null}
      </div>
    </li>
  );
}
