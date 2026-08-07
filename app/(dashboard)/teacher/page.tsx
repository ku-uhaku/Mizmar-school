import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  MessageSquareTextIcon,
  NotebookPenIcon,
  UsersIcon,
} from "lucide-react";

import { StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import {
  SectionLinks,
  type SectionLink,
} from "@/components/shell/section-links";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listAssessments } from "@/modules/assessments/queries";
import { StatusBadge } from "@/modules/assessments/components/assessments-manager";
import {
  listMyLessons,
  listMyTeaching,
  teacherSummary,
} from "@/modules/classroom/queries";
import { toDateInputValue } from "@/lib/utils";
import { SectionHeading } from "@/components/shell/section-heading";

export const metadata: Metadata = { title: "Espace enseignant" };

/**
 * The teacher's own workspace.
 *
 * It answers the question they actually have at 8am — "which of today's
 * registers have I not taken, and what is waiting to be marked" — before it
 * shows them anything else. Everything on it is confined to their own teaching
 * assignments by `queries.ts`, so a colleague's class never appears here.
 */
export default async function TeacherPage() {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.CLASSROOM_WORKSPACE)) {
    return <ForbiddenState />;
  }

  const today = new Date();

  const [summary, teaching, lessons, papers] = await Promise.all([
    teacherSummary(context, today),
    listMyTeaching(context),
    listMyLessons(context, today),
    /*
      The contrôles the office has published for this teacher's classes.

      Set by the head of studies, not here, so they appear nowhere else in the
      workspace — and a paper a teacher cannot find is a paper that does not get
      marked. Read through the assessments module's own query, which scopes it
      to the school and year; `teacherId` is what makes it *theirs*.
    */
    context.can(PERMISSIONS.ASSESSMENT_VIEW)
      ? listAssessments(context, {
          teacherId: context.user.id,
          statuses: ["PUBLISHED", "SUBMITTED"],
        })
      : [],
  ]);

  const links: SectionLink[] = [];
  if (context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW)) {
    links.push({
      href: "/teacher/attendance",
      label: t.classroom.attendance,
      description: t.classroom.attendanceHint,
      icon: <CalendarCheckIcon className="size-4" />,
      badge:
        summary.registersLeftToday > 0
          ? String(summary.registersLeftToday)
          : undefined,
      badgeTone: summary.registersLeftToday > 0 ? "warn" : undefined,
    });
  }
  links.push({
    href: "/teacher/timetable",
    label: t.classroom.myTimetable,
    description: t.classroom.myTimetableHint,
    icon: <CalendarClockIcon className="size-4" />,
  });
  links.push({
    href: "/teacher/devoirs",
    label: t.classroom.devoirs,
    description: t.classroom.devoirsHint,
    icon: <NotebookPenIcon className="size-4" />,
  });
  if (context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW)) {
    links.push({
      href: "/teacher/remarks",
      label: t.classroom.remarks,
      description: t.classroom.remarksHint,
      icon: <MessageSquareTextIcon className="size-4" />,
    });
  }

  const dateParam = toDateInputValue(today);

  return (
    <>
      <PageHeader
        title={t.classroom.title}
        description={t.classroom.subtitle}
      />

      {teaching.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<UsersIcon className="size-5" />}
              title={t.classroom.noClasses}
              description={t.classroom.noClassesHint}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {/* The main dashboard's bands, in its order. */}
          <section className="grid gap-3">
            <SectionHeading label={t.bands.overview} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label={t.classroom.pupilsTaught}
                value={summary.pupilCount}
                detail={interpolate(t.classroom.classesCount, {
                  count: summary.classCount,
                })}
                icon={<UsersIcon className="size-4" />}
                locale={locale}
              />
              <StatTile
                label={t.classroom.lessonsToday}
                value={summary.lessonsToday}
                detail={t.classroom.today}
                icon={<CalendarCheckIcon className="size-4" />}
                locale={locale}
              />
              <StatTile
                label={t.classroom.registersLeft}
                value={summary.registersLeftToday}
                detail={t.classroom.attendanceHint}
                icon={<CheckCircle2Icon className="size-4" />}
                locale={locale}
                href={
                  context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW)
                    ? "/teacher/attendance"
                    : null
                }
              />
              <StatTile
                label={t.classroom.papersToMark}
                value={summary.papersToMark}
                detail={t.assessment.awaitingMarksHint}
                icon={<ClipboardCheckIcon className="size-4" />}
                locale={locale}
              />
            </div>
          </section>

          <section className="grid gap-3">
            <SectionHeading label={t.bands.goTo} />
            <SectionLinks links={links} />
          </section>

          <section className="grid gap-3">
            <SectionHeading label={t.bands.insights} />
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Today, in order, with the registers still to take called out. */}
              <Card className="gap-4 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t.classroom.today}
                  </CardTitle>
                  <CardDescription>
                    {t.classroom.attendanceHint}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lessons.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                      {t.classroom.noLessonsToday}
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {lessons.map((lesson) => (
                        <li
                          key={lesson.timetableEntryId}
                          className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <span
                            aria-hidden
                            className="h-8 w-1 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                lesson.subjectColorHex ?? undefined,
                            }}
                          />
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {lesson.startTime}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {lesson.subjectName}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {lesson.classCode}
                              {lesson.groupLabel
                                ? ` · ${lesson.groupLabel}`
                                : ""}
                              {lesson.roomCode ? ` · ${lesson.roomCode}` : ""}
                            </span>
                          </span>

                          {lesson.isMarked ? (
                            <Badge
                              variant="outline"
                              className="text-success border-success/40 shrink-0"
                            >
                              {t.classroom.registerTaken}
                            </Badge>
                          ) : context.can(
                              PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW,
                            ) ? (
                            <Button asChild size="sm" className="shrink-0">
                              <Link
                                href={`/teacher/attendance?class=${lesson.schoolClassId}&subject=${lesson.subjectId}&slot=${lesson.timeSlotId}&date=${dateParam}`}
                              >
                                {t.classroom.takeRegister}
                              </Link>
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/*
              Everything of this teacher's that is still open: the contrôles the
              office published for their classes, and the devoirs they set
              themselves. Both are marked the same way and both are theirs, so
              they are one list rather than two — the kind badge says which is
              which.

              Hidden entirely when there are none: an empty card headed "to
              mark" is a reproach, and the stat tile above already says zero.
            */}
              {papers.length > 0 ? (
                <Card className="gap-4 lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t.classroom.papersToMark}
                    </CardTitle>
                    <CardDescription>
                      {t.classroom.papersToMarkHint}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {papers.map((paper) => {
                        const accounted = paper.markedCount + paper.absentCount;
                        return (
                          <li
                            key={paper.id}
                            className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                          >
                            <span
                              aria-hidden
                              className="h-8 w-1 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  paper.subjectColorHex ??
                                  paper.typeColorHex ??
                                  undefined,
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {paper.title}
                              </span>
                              <span className="text-muted-foreground block truncate text-xs">
                                {paper.classCode} · {paper.subjectName}
                                {paper.scheduledOn
                                  ? ` · ${formatDate(paper.scheduledOn, locale)}`
                                  : ""}
                              </span>
                            </span>
                            <Badge variant="secondary" className="shrink-0">
                              {paper.typeCode}
                            </Badge>
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                              {interpolate(t.assessment.markedOf, {
                                marked: accounted,
                                total: paper.rosterCount,
                              })}
                            </span>
                            <StatusBadge status={paper.status} />
                            <Button asChild size="sm" className="shrink-0">
                              <Link href={`/assessments/${paper.id}`}>
                                {t.classroom.openMarkSheet}
                              </Link>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="gap-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t.classroom.myClasses}
                  </CardTitle>
                  <CardDescription>{t.classroom.myClassesHint}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {teaching.map((slot) => (
                      <li
                        key={slot.assignmentId}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {slot.classCode}
                            {slot.groupLabel ? ` · ${slot.groupLabel}` : ""}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {slot.subjectName}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="shrink-0 tabular-nums"
                        >
                          {slot.rosterCount}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
