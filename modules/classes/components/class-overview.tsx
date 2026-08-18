"use client";

import {
  BookOpenIcon,
  CalendarClockIcon,
  GraduationCapIcon,
  LayersIcon,
  MinusIcon,
  ThumbsUpIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";

import { ColumnChart } from "@/components/charts/column-chart";
import { Meter } from "@/components/charts/meter";
import { RadialGauge } from "@/components/charts/radial-gauge";
import { SplitBar } from "@/components/charts/split-bar";
import { StatTile } from "@/components/charts/stat-tile";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatMonthShort,
  formatNumber,
  interpolate,
} from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type {
  ClassResults,
  ClassTermAverage,
} from "@/modules/bulletins/queries";
import type { ClassAttendance, RemarkRow } from "@/modules/classroom/queries";
import type { ClassOverview as ClassOverviewData } from "@/modules/classes/queries";
import type { TimetableGrid } from "@/modules/timetable/queries";

/**
 * The class's first tab: what is true of this class, and of the niveau it sits
 * at.
 *
 * ── Why the niveau is here ──────────────────────────────────────────────────
 * Hardly any question about a class is answerable by the class alone. "Is it
 * full?" means compared with its sister classes; "is it staffed?" means against
 * the programme its niveau declares, not against whatever assignments happen to
 * exist; "why is the week short?" means against the hours the niveau asks for.
 * All three were two screens away, so they were usually guessed.
 *
 * ── The gaps are the point ──────────────────────────────────────────────────
 * A subject with nobody against it is drawn as a gap rather than left blank, and
 * the staffing tile counts the programme rather than the assignments. Reporting
 * "12 teachers assigned" is a number that cannot be wrong and cannot be acted
 * on; "12 of 15 subjects covered" is the one a head of studies is looking for.
 */
export function ClassOverview({
  overview,
  results,
  termAverages,
  attendance,
  timetable,
  remarks,
  classCode,
}: {
  overview: ClassOverviewData;
  /**
   * The term's results, or null where the class has none — see
   * `loadClassResults`. A term nobody has computed shows a way in rather than a
   * provisional average nobody approved.
   */
  results: ClassResults | null;
  /**
   * The moyenne term by term. Empty for a reader who may not see marks, and for
   * a year whose first term has not been computed — a line needs two points.
   */
  termAverages: ClassTermAverage[];
  /**
   * The class's year of registers. Null for a reader without the attendance
   * code, and the panel is then not drawn at all.
   */
  attendance: ClassAttendance | null;
  /**
   * The week as drawn, read a second way: how the load falls across the days.
   * Null where the school has no bell schedule yet.
   */
  timetable: TimetableGrid | null;
  /** The carnet for this class, newest first. Empty is drawn as empty. */
  remarks: RemarkRow[];
  /** The class being looked at, for the sister table's own row. */
  classCode: string;
}) {
  const t = useT();
  const locale = useLocale();

  const fill =
    overview.capacity && overview.capacity > 0
      ? Math.round((overview.enrolled / overview.capacity) * 100)
      : null;

  const hours = (minutes: number): string =>
    formatNumber(Math.round((minutes / 60) * 10) / 10, locale);

  /**
   * The programme as a chart: hours a week per matière, heaviest first.
   *
   * A subject the school has declared without stating its hours is left out
   * rather than drawn at zero — a zero-height bar is a claim that it is taught
   * for no time, which is not what a blank column means.
   */
  const timetabled = overview.programme
    .filter((row) => (row.weeklyMinutes ?? 0) > 0)
    .sort((a, b) => (b.weeklyMinutes ?? 0) - (a.weeklyMinutes ?? 0))
    .map((row) => ({
      label: row.subjectShort,
      value: Math.round(((row.weeklyMinutes ?? 0) / 60) * 10) / 10,
    }));

  /**
   * The week's load, day by day.
   *
   * Empty days are kept, unlike the empty subjects above: a Wednesday with
   * nothing on it is not a missing figure, it is the answer to "why is the week
   * short", and dropping the column would hide exactly the day being looked for.
   *
   * A block spanning two periods was merged into one cell by the grid, so the
   * span is added rather than the cells counted — that is what makes this total
   * agree with the placed-periods tile above.
   */
  const loadByDay = (timetable?.rows ?? []).map((row) => ({
    label:
      t.timetable.daysShort[
        String(row.dayOfWeek) as keyof typeof t.timetable.daysShort
      ] ?? String(row.dayOfWeek),
    value: Object.values(row.cells).reduce(
      (total, cell) => total + (cell.entry?.span ?? 0),
      0,
    ),
  }));

  /*
    The register month by month, on the definition the headline figure uses:
    present or late, over what was actually marked.

    A month carrying fewer marks than the class has pupils is under one register
    per child. A single absence in it reads as a collapse, and the line plunges
    off a cliff that never happened — the same trap `attendanceRate` avoids by
    excluding what nobody marked, applied a second time to the month itself.
  */
  const attendanceTrend: TrendPoint[] = (attendance?.byMonth ?? [])
    .filter((month) => month.marked >= Math.max(overview.enrolled, 1))
    .map((month) => {
      const [year, monthNumber] = month.month.split("-").map(Number);
      return {
        label: formatMonthShort(year, monthNumber, locale),
        value: Math.round((month.here / month.marked) * 100),
      };
    });

  /** The moyenne term by term — see `loadClassTermAverages`. */
  const termTrend: TrendPoint[] = termAverages.map((term) => ({
    label: term.termName,
    value: term.average,
  }));

  /** What the programme asks for, in periods — the unit the grid is drawn in. */
  const programmePeriods =
    overview.periodMinutes > 0
      ? Math.round(overview.programmeMinutes / overview.periodMinutes)
      : 0;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label={t.schoolClass.tabRoster}
          value={overview.enrolled}
          detail={
            overview.capacity === null
              ? undefined
              : interpolate(t.schoolClass.fill, {
                  enrolled: overview.enrolled,
                  capacity: overview.capacity,
                })
          }
          icon={<UsersIcon className="size-4" />}
          locale={locale}
        />
        <StatTile
          label={t.schoolClass.overviewStaffed}
          value={overview.staffedCount}
          detail={interpolate(t.schoolClass.overviewOfSubjects, {
            count: overview.subjectCount,
          })}
          icon={<BookOpenIcon className="size-4" />}
          locale={locale}
        />
        <StatTile
          label={t.schoolClass.tabTimetable}
          value={overview.placedPeriods}
          detail={interpolate(t.schoolClass.overviewProgrammeHours, {
            hours: hours(overview.programmeMinutes),
          })}
          icon={<CalendarClockIcon className="size-4" />}
          locale={locale}
        />
        <StatTile
          label={t.schoolClass.overviewAverage}
          value={results?.average ?? 0}
          detail={
            results?.average == null
              ? t.schoolClass.overviewNoResults
              : interpolate(t.schoolClass.overviewOutOf, {
                  outOf: formatNumber(results.outOf, locale),
                  term: results.termName,
                })
          }
          icon={<GraduationCapIcon className="size-4" />}
          locale={locale}
        />
        <StatTile
          label={t.schoolClass.overviewGroups}
          value={overview.groupCount}
          detail={
            overview.averageAge === null
              ? undefined
              : interpolate(t.schoolClass.overviewAverageAge, {
                  age: formatNumber(overview.averageAge, locale),
                })
          }
          icon={<LayersIcon className="size-4" />}
          locale={locale}
        />
      </div>

      {/* The roll's own make-up, as a band rather than four more tiles: it is
        reference for whoever is seating pupils, not the point of the screen. */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{classCode}</CardTitle>
          <CardDescription>
            {overview.levelNameLabel} — {overview.cycleName}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label={t.studentOptions.genders.FEMALE} value={formatNumber(overview.girls, locale)} />
          <Figure label={t.studentOptions.genders.MALE} value={formatNumber(overview.boys, locale)} />
          <Figure
            label={t.schoolClass.overviewRepeating}
            value={formatNumber(overview.repeating, locale)}
          />
          <Figure
            label={t.schoolClass.overviewFill}
            value={fill === null ? "—" : `${formatNumber(fill, locale)} %`}
          />
        </CardContent>
      </Card>

      {/*
        The week and the roll, charted.

        Deliberately the two panels that do not wait on anybody: a class has a
        programme and a timetable from the day it is opened, so these draw in
        September — where the results below them cannot until a term has been
        computed. A dashboard whose every panel is empty until December is a
        dashboard nobody opens in September.
      */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="border-b">
            <CardTitle>{t.schoolClass.overviewHoursBySubject}</CardTitle>
            <CardDescription>
              {interpolate(t.schoolClass.overviewHoursHint, {
                hours: hours(overview.programmeMinutes),
                subjects: overview.subjectCount,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timetabled.length > 0 ? (
              // Short codes on the axis: eleven bilingual matière names under one
              // plot are a smear, not a label.
              <ColumnChart
                columns={timetabled}
                unitLabel={t.schoolClass.overviewWeeklyHours}
                categoryLabel={t.assessment.subject}
                tableCaption={t.schoolClass.overviewHoursBySubject}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {t.schoolClass.overviewNoProgramme}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>{t.schoolClass.overviewCoverage}</CardTitle>
            <CardDescription>{t.schoolClass.overviewCoverageHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {/*
              Two meters, not one figure each: both are "how much of what was
              promised is actually there", and a share is the only form in which
              11 of 11 and 28 of 36 can be read side by side.
            */}
            <Meter
              value={
                overview.subjectCount === 0
                  ? 0
                  : Math.round(
                      (overview.staffedCount / overview.subjectCount) * 100,
                    )
              }
              label={t.schoolClass.overviewStaffed}
              caption={interpolate(t.schoolClass.overviewStaffedCaption, {
                staffed: overview.staffedCount,
                subjects: overview.subjectCount,
              })}
            />
            <Meter
              value={
                programmePeriods === 0
                  ? 0
                  : Math.min(
                      100,
                      Math.round((overview.placedPeriods / programmePeriods) * 100),
                    )
              }
              label={t.schoolClass.tabTimetable}
              caption={interpolate(t.schoolClass.overviewCoverageCaption, {
                placed: overview.placedPeriods,
                needed: programmePeriods,
              })}
            />

            {/* The roll's make-up. Two categories, so the categorical slots do
              the identifying and the written shares carry the value. */}
            {overview.enrolled > 0 ? (
              <SplitBar
                segments={[
                  {
                    label: t.studentOptions.genders.FEMALE,
                    value: overview.girls,
                  },
                  { label: t.studentOptions.genders.MALE, value: overview.boys },
                ]}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/*
        The week as it was actually drawn, and the register taken against it.

        Both read the same week from opposite ends: the columns say how the load
        falls across the days, and the gauge says how much of it the class turned
        up for. Neither is answerable from the timetable tab, which shows the
        week a cell at a time and no rate at all.
      */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>{t.schoolClass.overviewLoadByDay}</CardTitle>
            <CardDescription>
              {interpolate(t.schoolClass.overviewLoadByDayHint, {
                placed: overview.placedPeriods,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadByDay.length > 0 ? (
              <ColumnChart
                columns={loadByDay}
                unitLabel={t.schoolClass.overviewPeriods}
                categoryLabel={t.schoolClass.overviewDay}
                tableCaption={t.schoolClass.overviewLoadByDay}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {t.schoolClass.overviewNoTimetable}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Drawn only for a reader who holds the attendance code — the panel is
          absent rather than empty, like the paper tabs. */}
        {attendance ? (
          <Card className="lg:col-span-3">
            <CardHeader className="border-b">
              <CardTitle>{t.schoolClass.overviewAttendance}</CardTitle>
              <CardDescription>
                {attendance.marked === 0
                  ? t.schoolClass.overviewNoAttendance
                  : interpolate(t.schoolClass.overviewAttendanceHint, {
                      marked: attendance.marked,
                      unjustified: attendance.unjustifiedAbsences,
                    })}
              </CardDescription>
            </CardHeader>
            {attendance.marked > 0 ? (
              <CardContent className="grid gap-6">
                <div className="flex flex-wrap items-center gap-6">
                  {/* The rate as one arc, because it is one measurement against
                    its limit — the unfilled arc is the remainder, not a second
                    category. The four counts beside it carry what the arc
                    cannot: a retard and an absence are not the same event. */}
                  <RadialGauge
                    value={attendance.attendanceRate ?? 0}
                    label={t.classroom.attendanceRate}
                    caption={interpolate(t.classroom.ofMarkedDays, {
                      count: attendance.marked,
                    })}
                  />
                  <div className="grid min-w-44 flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                    <Figure
                      label={t.classroomOptions.attendanceStatuses.PRESENT}
                      value={formatNumber(attendance.tally.present, locale)}
                    />
                    <Figure
                      label={t.classroomOptions.attendanceStatuses.LATE}
                      value={formatNumber(attendance.tally.late, locale)}
                    />
                    <Figure
                      label={t.classroomOptions.attendanceStatuses.ABSENT}
                      value={formatNumber(attendance.tally.absent, locale)}
                    />
                    <Figure
                      label={t.classroomOptions.attendanceStatuses.EXCUSED}
                      value={formatNumber(attendance.tally.excused, locale)}
                    />
                  </div>
                </div>

                {/* A shape over time, which no single percentage carries: the
                  question is not whether the class turns up but whether that
                  changed in February. One point is not a shape, so the line
                  waits for a second month. */}
                {attendanceTrend.length > 1 ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">
                      {t.schoolClass.overviewAttendanceByMonth}
                    </p>
                    <TrendChart
                      points={attendanceTrend}
                      unitLabel="%"
                      tableCaption={t.schoolClass.overviewAttendanceByMonth}
                      periodLabel={t.student.month}
                      zeroBaseline
                    />
                  </div>
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        ) : null}
      </div>

      {/*
        The term's results.

        The moyenne is a headline, not a chart — one number the reader came for,
        so it is written large and the spread sits beside it. What *is* charted
        is the two questions a single figure cannot answer: how the class is
        spread across the school's own appréciation scale, and which matières are
        carrying it.
      */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t.schoolClass.overviewResults}</CardTitle>
          <CardDescription>
            {results
              ? interpolate(t.schoolClass.overviewResultsHint, {
                  term: results.termName,
                  computed: results.computed,
                  published: results.published,
                })
              : t.schoolClass.overviewNoResults}
          </CardDescription>
        </CardHeader>

        {results && results.average !== null ? (
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="grid gap-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-semibold tabular-nums">
                  {formatNumber(results.average, locale)}
                </span>
                <span className="text-muted-foreground text-sm">
                  / {formatNumber(results.outOf, locale)}
                </span>
                <span className="text-muted-foreground ms-auto text-sm tabular-nums">
                  {/* The spread, not a second average: a class mean of 12 says
                    nothing about whether it runs from 11 to 13 or 4 to 19. */}
                  {results.lowest === null || results.highest === null
                    ? null
                    : interpolate(t.schoolClass.overviewSpread, {
                        lowest: formatNumber(results.lowest, locale),
                        highest: formatNumber(results.highest, locale),
                      })}
                </span>
              </div>

              {results.passRate === null ? null : (
                <Meter
                  value={results.passRate}
                  label={t.schoolClass.overviewPassRate}
                  caption={interpolate(t.schoolClass.overviewPassMark, {
                    mark: formatNumber(results.passMark, locale),
                    outOf: formatNumber(results.outOf, locale),
                  })}
                />
              )}

              {/* An ordered scale, painted in the school's own band colours —
                see the note on `SplitBar`. Empty rungs are kept: "nobody is
                below average" is exactly what an empty rung states. */}
              <SplitBar
                segments={results.bands.map((band) => ({
                  label: band.label,
                  value: band.count,
                  color: band.colorHex,
                }))}
              />
            </div>

            <div className="grid content-start gap-2">
              <p className="text-sm font-medium">
                {t.schoolClass.overviewBySubject}
              </p>
              {results.bySubject.length > 0 ? (
                <ColumnChart
                  // The short form on the axis — see `bySubject`. Eleven full
                  // bilingual names under one plot are a smear, not a label.
                  columns={results.bySubject.map((row) => ({
                    label: row.subjectShort,
                    value: row.average,
                  }))}
                  unitLabel={`/ ${formatNumber(results.outOf, locale)}`}
                  categoryLabel={t.assessment.subject}
                  tableCaption={t.schoolClass.overviewBySubject}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t.schoolClass.overviewNoSubjectAverages}
                </p>
              )}
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {t.schoolClass.overviewNoResultsHint}
            </p>
          </CardContent>
        )}
      </Card>

      {/*
        The moyenne term by term.

        The card above answers "where is the class now"; this one answers
        "which way is it going", and a column chart cannot be read that way. The
        axis is deliberately *not* zero-based: a class moving 11.8 → 12.6 is a
        flat line on a 0–20 scale, and the movement is the whole point. A cropped
        axis gets a bare line and no fill under it — the area would then overstate
        magnitude — which is the rule `TrendChart` already enforces.

        Two points at least: a single term is the figure in the tile above.
      */}
      {termTrend.length > 1 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t.schoolClass.overviewAverageByTerm}</CardTitle>
            <CardDescription>
              {t.schoolClass.overviewAverageByTermHint}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              points={termTrend}
              unitLabel={`/ ${formatNumber(termAverages[0].outOf, locale)}`}
              tableCaption={t.schoolClass.overviewAverageByTerm}
              periodLabel={t.assessment.term}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* The niveau's programme, with this class's holder beside each line. */}
        <Card className="lg:col-span-3">
          <CardHeader className="border-b">
            <CardTitle>{t.schoolClass.overviewProgramme}</CardTitle>
            <CardDescription>
              {interpolate(t.schoolClass.overviewProgrammeHint, {
                level: overview.levelLabel,
                hours: hours(overview.programmeMinutes),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.assessment.subject}</TableHead>
                  <TableHead className="text-end">
                    {t.schoolClass.overviewWeeklyHours}
                  </TableHead>
                  <TableHead className="text-end">{t.assessment.coefficient}</TableHead>
                  <TableHead>{t.schoolClass.teacher}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.programme.map((row) => (
                  <TableRow key={row.subjectId}>
                    <TableCell className="font-medium">{row.subjectLabel}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {row.weeklyMinutes === null
                        ? "—"
                        : hours(row.weeklyMinutes)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(row.coefficient, locale)}
                    </TableCell>
                    <TableCell>
                      {row.teacherName ?? (
                        // Named, not blank: an empty cell reads as "not loaded",
                        // and this is a post somebody has to fill.
                        <Badge variant="outline" className="text-muted-foreground">
                          {t.schoolClass.overviewUnstaffed}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {overview.programme.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {t.schoolClass.overviewNoProgramme}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* The niveau's other classes. This one is in the list and marked, not
          left out: the comparison is the whole reason the panel exists. The
          filière column matters where the niveau streams — only the classes
          sharing this one's follow the same programme, and only they are what a
          niveau-wide round of contrôles reaches. */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>{t.schoolClass.overviewSisters}</CardTitle>
            <CardDescription>
              {interpolate(t.schoolClass.overviewSistersHint, {
                level: overview.levelLabel,
                enrolled: overview.levelEnrolled,
                classes: overview.sisters.length,
              })}
            </CardDescription>
          </CardHeader>
          {/* The same rows as the table, drawn — because "is this class full?"
            means "fuller than its sisters?", and a column of figures is read one
            line at a time. One class is not a comparison, so the chart waits for
            a second. The table under it keeps the capacities and marks which row
            is this one; the bars carry the shape. */}
          {overview.sisters.length > 1 ? (
            <CardContent>
              <ColumnChart
                columns={overview.sisters.map((sister) => ({
                  label: sister.code,
                  value: sister.enrolled,
                }))}
                unitLabel={t.schoolClass.tabRoster}
                categoryLabel={t.schoolClass.classColumn}
                tableCaption={t.schoolClass.overviewSistersFill}
              />
            </CardContent>
          ) : null}
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.schoolClass.classColumn}</TableHead>
                  <TableHead className="text-end">{t.schoolClass.tabRoster}</TableHead>
                  <TableHead className="text-end">{t.schoolClass.capacity}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.sisters.map((sister) => (
                  <TableRow
                    key={sister.id}
                    className={cn(sister.isCurrent && "bg-muted/50")}
                  >
                    <TableCell
                      className={cn("font-medium", sister.isCurrent && "font-semibold")}
                    >
                      {sister.code}
                      {/* Marked only where it tells the reader something: on a
                        niveau with one filière every row shares the programme,
                        and a badge on all of them is noise. */}
                      {sister.sharesProgramme &&
                      overview.sisters.some((other) => !other.sharesProgramme) ? (
                        <Badge variant="secondary" className="ms-1.5">
                          {t.schoolClass.overviewSameProgramme}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(sister.enrolled, locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-end tabular-nums">
                      {sister.capacity === null
                        ? "—"
                        : formatNumber(sister.capacity, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/*
        Le carnet for this class.

        Tone is a *status*, not a category, so it wears the reserved tokens with
        an icon beside them — the same pair `PupilRemarksPanel` uses — rather
        than a slot of the categorical palette. Colour is never the only thing
        saying "concern": the icon and the word are there too.

        Capped upstream and newest first: this is a way in to the carnet, not a
        second copy of the review screen.
      */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t.schoolClass.overviewRemarks}</CardTitle>
          <CardDescription>
            {remarks.length === 0
              ? t.schoolClass.overviewNoRemarks
              : interpolate(t.schoolClass.overviewRemarksHint, {
                  count: remarks.length,
                  concerns: remarks.filter((one) => one.tone === "CONCERN").length,
                })}
          </CardDescription>
        </CardHeader>
        {remarks.length > 0 ? (
          <CardContent className="grid gap-3">
            {remarks.map((remark) => {
              const tone = TONE_STYLES[remark.tone] ?? TONE_STYLES.NEUTRAL;
              return (
                <div
                  key={remark.id}
                  className={cn("grid gap-1 rounded-md border p-3", tone.surface)}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={cn("flex items-center gap-1.5", tone.text)}>
                      {tone.icon}
                      {t.classroomOptions.remarkTones[
                        remark.tone as keyof typeof t.classroomOptions.remarkTones
                      ] ?? remark.tone}
                    </span>
                    <span className="font-medium">{remark.studentName}</span>
                    {remark.subjectName ? (
                      <Badge variant="secondary">{remark.subjectName}</Badge>
                    ) : null}
                    <span className="text-muted-foreground ms-auto text-xs">
                      {formatDate(remark.occurredOn, locale)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{remark.body}</p>
                </div>
              );
            })}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

/**
 * Tone decides the colour, and it is a reserved status rather than a series —
 * the same three the carnet already uses, icon included, so colour is never
 * carrying the meaning on its own. See `PupilRemarksPanel`.
 */
const TONE_STYLES: Record<
  string,
  { surface: string; text: string; icon: React.ReactNode }
> = {
  POSITIVE: {
    surface: "border-success/30 bg-success/5",
    text: "text-success",
    icon: <ThumbsUpIcon className="size-3.5" />,
  },
  CONCERN: {
    surface: "border-destructive/30 bg-destructive/5",
    text: "text-destructive",
    icon: <TriangleAlertIcon className="size-3.5" />,
  },
  NEUTRAL: {
    surface: "",
    text: "text-muted-foreground",
    icon: <MinusIcon className="size-3.5" />,
  },
};

/** One labelled figure of the roll band. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
