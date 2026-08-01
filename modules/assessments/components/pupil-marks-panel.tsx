"use client";

import { GraduationCapIcon } from "lucide-react";
import * as React from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { passMarkOf } from "@/lib/school-settings";
import { cn } from "@/lib/utils";
import { isPassing } from "@/modules/assessments/enums";
import type {
  PupilMarks,
  PupilSubjectMarks,
} from "@/modules/assessments/queries";

/**
 * Les notes: what this pupil has scored, by subject.
 *
 * Grouped by subject rather than listed by date because that is how a mark is
 * read — "how is she doing in maths" is the question, and a chronological list
 * of nine subjects interleaved cannot answer it. Each subject carries its own
 * weighted average and the coefficient it counts for, so the overall figure at
 * the top is something a parent can follow rather than a number to be trusted.
 *
 * Not a bulletin. Everything here is computed on read and nothing is frozen —
 * see the note on `loadPupilMarks`. A published report card has to be a
 * snapshot, and that is a different thing.
 *
 * A subject table is deliberately not a DataTable: it is four rows a parent
 * reads top to bottom, and a search box over four rows is furniture.
 */
export function PupilMarksPanel({ marks }: { marks: PupilMarks }) {
  const { t, locale } = useI18n();
  const settings = useSettings();
  const passMark = passMarkOf(settings);

  if (marks.subjects.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<GraduationCapIcon className="size-5" />}
            title={t.assessment.noMarksYet}
            description={t.assessment.noMarksHint}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t.assessment.overallAverage}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              marks.overall !== null &&
                (marks.overall >= passMark
                  ? "text-success"
                  : "text-destructive"),
            )}
          >
            {marks.overall === null
              ? "—"
              : `${formatNumber(marks.overall, locale)}`}
            <span className="text-muted-foreground text-lg font-normal">
              /{marks.outOf}
            </span>
          </p>
        </div>

        <div className="text-muted-foreground text-end text-xs">
          <p>
            {interpolate(t.assessment.marksCounted, {
              count: marks.markedCount,
            })}
          </p>
          <p>
            {interpolate(t.assessment.passMarkIs, {
              mark: formatNumber(passMark, locale),
              max: marks.outOf,
            })}
          </p>
        </div>
      </div>

      {marks.subjects.map((subject) => (
        <SubjectCard
          key={subject.subjectId}
          subject={subject}
          outOf={marks.outOf}
          passMark={passMark}
          passBps={settings.passMarkBps}
        />
      ))}
    </div>
  );
}

function SubjectCard({
  subject,
  outOf,
  passMark,
  passBps,
}: {
  subject: PupilSubjectMarks;
  outOf: number;
  passMark: number;
  passBps: number;
}) {
  const { t, locale } = useI18n();

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">{subject.subjectName}</h3>
          <Badge variant="secondary">
            {interpolate(t.assessment.coefficientShort, {
              value: subject.coefficient,
            })}
          </Badge>
        </div>
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            subject.average !== null &&
              (subject.average >= passMark
                ? "text-success"
                : "text-destructive"),
          )}
        >
          {subject.average === null
            ? "—"
            : formatNumber(subject.average, locale)}
          <span className="text-muted-foreground text-sm font-normal">
            /{outOf}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t.assessment.assessment}</TableHead>
              <TableHead>{t.assessment.term}</TableHead>
              <TableHead className="text-end">
                {t.assessment.coefficient}
              </TableHead>
              <TableHead className="text-end">{t.assessment.score}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subject.marks.map((mark) => {
              const failing =
                mark.score !== null &&
                !mark.isAbsent &&
                !isPassing(mark.score, mark.maxScore, passBps);

              return (
                <TableRow
                  key={mark.id}
                  // A paper whose kind never moves the average is dimmed rather
                  // than hidden: the family was shown it, so the file must be
                  // able to explain why it is not in the figure above.
                  className={cn(!mark.counts && "text-muted-foreground")}
                >
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {mark.title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {mark.typeName}
                        {mark.scheduledOn
                          ? ` · ${formatDate(mark.scheduledOn, locale)}`
                          : ""}
                        {!mark.counts ? ` · ${t.assessment.notCounted}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{mark.termName}</span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {mark.coefficient}
                  </TableCell>
                  <TableCell className="text-end">
                    {mark.isAbsent ? (
                      <Badge variant="outline">
                        {mark.isExcused
                          ? t.assessment.excused
                          : t.assessment.absent}
                      </Badge>
                    ) : mark.score === null ? (
                      <span className="text-muted-foreground text-sm">
                        {t.assessment.pending}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          failing && "text-destructive",
                        )}
                      >
                        {formatNumber(mark.score, locale)}
                        <span className="text-muted-foreground font-normal">
                          /{mark.maxScore}
                        </span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
