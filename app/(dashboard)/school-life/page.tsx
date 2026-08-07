import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircleIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  ClockIcon,
  GraduationCapIcon,
  HomeIcon,
  LayersIcon,
  WalletIcon,
} from "lucide-react";

import { ColumnChart } from "@/components/charts/column-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { RadialGauge } from "@/components/charts/radial-gauge";
import { Meter } from "@/components/charts/meter";
import { StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import {
  SectionLinks,
  type SectionLink,
} from "@/components/shell/section-links";
import { ForbiddenState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { formatMoney, formatNumber, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { centimesToDirhams } from "@/modules/treasury/enums";
import { TeacherActivity } from "@/modules/school-life/components/teacher-activity";
import { loadSchoolLifeStats } from "@/modules/school-life/queries";
import { SectionHeading } from "@/components/shell/section-heading";

export const metadata: Metadata = { title: "Vie scolaire" };

/** How many class meters the fill card lists before deferring to /classes. */
const CLASS_METER_LIMIT = 8;

/**
 * The year seen whole.
 *
 * Every figure here is live and scoped to what this user may see — there is no
 * placeholder band, unlike the main dashboard, because every table it counts
 * now exists. The page owns no queries of its own; it composes each module's.
 *
 * `schoolLife.view` gets you the screen, not its contents: `loadSchoolLifeStats`
 * returns null for anything the reader has not separately earned, and this page
 * omits those tiles rather than drawing a zero. A "0 families" on an overview is
 * a claim about the school, and it would be a claim the reader was not entitled
 * to make.
 */
export default async function SchoolLifePage() {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  if (!context.can(PERMISSIONS.SCHOOL_LIFE_VIEW)) {
    return <ForbiddenState />;
  }

  const description = context.currentSchoolYear
    ? interpolate(t.schoolLife.subtitle, {
        school: context.currentSchool?.name ?? "—",
        year: context.currentSchoolYear.name,
      })
    : t.schoolLife.noYear;

  /*
    Without a year in context every year-scoped read matches nothing, so the
    enrolments, the classes and the levels all come back zero while the pupil
    and dossier counts — which are school-scoped — come back real. A screen
    mixing the two reads as "214 pupils, 0 enrolled", which is not what has
    happened. Better to say plainly that no year is selected.
  */
  if (!context.currentSchoolYear) {
    return (
      <>
        <PageHeader title={t.schoolLife.title} />
        <EmptyState title={t.schoolLife.noYear} />
      </>
    );
  }

  const stats = await loadSchoolLifeStats(context);

  const levelColumns = stats.byLevel.filter((entry) => entry.value > 0);

  /*
    Places filled across the school, as one ratio.

    Only classes that declare a capacity are counted, on both sides of the
    fraction: a class with no capacity set has no places to fill, and counting
    its pupils into the numerator alone would push the gauge past 100% for a
    school that simply had not finished its configuration.
  */
  const capped = stats.classFill.filter(
    (schoolClass) => (schoolClass.capacity ?? 0) > 0,
  );
  const occupancy = {
    taken: capped.reduce((total, entry) => total + entry.enrolled, 0),
    capacity: capped.reduce((total, entry) => total + (entry.capacity ?? 0), 0),
  };
  const occupancyPercent =
    occupancy.capacity === 0
      ? 0
      : Math.round((occupancy.taken / occupancy.capacity) * 100);

  /*
    The fullest classes first, then capped.

    `loadClassFill` orders by year of study so the class list reads 1AP through
    2BAC. Slicing that order gave a card headed "how full the classes are" that
    always showed the eight youngest classes and never the eight that were
    actually filling up — the only ones the card exists to surface. Classes with
    no capacity sort last: they have no ratio to be high or low.
  */
  const fullestClasses = stats.classFill
    .slice()
    .sort((a, b) => {
      const fill = (entry: (typeof stats.classFill)[number]) =>
        entry.capacity ? entry.enrolled / entry.capacity : -1;
      return fill(b) - fill(a);
    })
    .slice(0, CLASS_METER_LIMIT);

  // Only the screens this reader may actually open — a card leading to a
  // forbidden page is worse than no card.
  const links: SectionLink[] = [];
  if (context.can(PERMISSIONS.FAMILY_VIEW)) {
    links.push({
      href: "/families",
      label: t.family.title,
      description: t.schoolLife.familiesHint,
      icon: <HomeIcon className="size-4" />,
      badge: stats.families === null ? undefined : String(stats.families),
    });
  }
  if (context.can(PERMISSIONS.STUDENT_VIEW)) {
    links.push({
      href: "/students",
      label: t.student.title,
      description: t.schoolLife.studentsHint,
      icon: <GraduationCapIcon className="size-4" />,
      badge: stats.standing ? String(stats.standing.total) : undefined,
    });
  }
  if (context.can(PERMISSIONS.CLASS_VIEW)) {
    const unplaced = stats.enrolment?.unplaced ?? 0;
    links.push({
      href: "/classes",
      label: t.schoolClass.title,
      description: t.schoolLife.classesHint,
      icon: <LayersIcon className="size-4" />,
      badge:
        unplaced > 0
          ? interpolate(t.schoolLife.unplacedCount, { count: unplaced })
          : String(stats.classFill.length),
      badgeTone: unplaced > 0 ? "warn" : undefined,
    });
  }
  if (context.can(PERMISSIONS.ASSESSMENT_VIEW)) {
    links.push({
      href: "/assessments",
      label: t.assessment.title,
      description: t.schoolLife.assessmentsHint,
      icon: <ClipboardCheckIcon className="size-4" />,
    });
  }
  if (context.can(PERMISSIONS.TIMETABLE_VIEW)) {
    links.push({
      href: "/timetable",
      label: t.timetable.title,
      description: t.schoolLife.timetableHint,
      icon: <CalendarClockIcon className="size-4" />,
    });
  }
  /*
    The register and the carnet have no whole-school screen of their own — they
    are taken and written in the espace enseignant, and read on a pupil's file.
    Pointing office staff at the pupil list is honest about that: it is where
    the assiduité and the notes actually are.
  */
  if (
    context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW) &&
    context.can(PERMISSIONS.STUDENT_VIEW)
  ) {
    links.push({
      href: "/students",
      label: t.classroom.attendance,
      description: t.schoolLife.attendanceHint,
      icon: <CalendarCheckIcon className="size-4" />,
    });
  }

  const hasPipeline =
    (stats.standing?.preRegistered ?? 0) > 0 ||
    (stats.enrolment?.pending ?? 0) > 0 ||
    (stats.enrolment?.unplaced ?? 0) > 0;

  return (
    <>
      <PageHeader title={t.schoolLife.title} description={description}>
        {context.can(PERMISSIONS.STUDENT_VIEW) ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/students">{t.schoolLife.openStudents}</Link>
          </Button>
        ) : null}
      </PageHeader>

      {/* Four bands, the main dashboard's three plus the day's own — see the
        note on that fourth one below. The spacing is on the wrapper, so the
        rhythm is set once rather than by whichever band came first. */}
      <section className="grid gap-3">
        <SectionHeading label={t.bands.overview} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.standing ? (
            <StatTile
              label={t.schoolLife.students}
              value={stats.standing.total}
              detail={interpolate(t.schoolLife.studentsDetail, {
                count: formatNumber(stats.standing.enrolled, locale),
              })}
              icon={<GraduationCapIcon className="size-4" />}
              locale={locale}
              href="/students"
            />
          ) : null}
          {stats.families === null ? null : (
            <StatTile
              label={t.schoolLife.families}
              value={stats.families}
              detail={t.schoolLife.familiesDetail}
              icon={<HomeIcon className="size-4" />}
              locale={locale}
              href="/families"
            />
          )}
          {stats.enrolment ? (
            <StatTile
              label={t.schoolLife.unplaced}
              value={stats.enrolment.unplaced}
              detail={t.schoolLife.unplacedDetail}
              icon={<AlertCircleIcon className="size-4" />}
              locale={locale}
              href={context.can(PERMISSIONS.CLASS_VIEW) ? "/classes" : null}
            />
          ) : null}
          {stats.billing ? (
            <StatTile
              label={t.schoolLife.billed}
              // The figure is money and has to say so; `detail` carries the
              // reductions it is already net of.
              value={Math.round(
                centimesToDirhams(stats.billing.billedCentimes),
              )}
              suffix={context.settings.currencyCode}
              detail={`${t.schoolLife.discounted}: ${formatMoney(
                stats.billing.discountedCentimes,
                locale,
                context.settings.currencyCode,
              )}`}
              icon={<WalletIcon className="size-4" />}
              locale={locale}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.goTo} />
        <SectionLinks links={links} />
      </section>

      {/* Above the year's shape on purpose: the figures below describe the
          year, while this is the day — the absences a teacher marked an hour
          ago and the marks somebody is waiting to have accepted. */}
      <section className="grid gap-3">
        <SectionHeading label={t.bands.pending} />
        <TeacherActivity
          classroom={stats.classroom}
          awaitingValidation={stats.awaitingValidation}
        />
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.insights} />
        <div className="grid gap-4 lg:grid-cols-3">
          {/* The ring and the gauge lead: they are the shape of the year, and the
          columns underneath are its detail. The three single-column cards come
          first so the full-width one closes the row rather than leaving a hole
          in it. */}
          {stats.standing ? (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle className="text-base">
                  {t.schoolLife.standing}
                </CardTitle>
                <CardDescription>{t.schoolLife.standingHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart
                  slices={[
                    {
                      label: t.schoolLife.standingEnrolled,
                      value: stats.standing.enrolled,
                    },
                    {
                      label: t.schoolLife.standingPreRegistered,
                      value: stats.standing.preRegistered,
                    },
                    {
                      label: t.schoolLife.standingLeft,
                      value: stats.standing.left,
                    },
                  ]}
                  total={stats.standing.total}
                  totalLabel={t.schoolLife.pupilsTotal}
                  tableCaption={t.schoolLife.standing}
                  categoryLabel={t.schoolLife.standingColumn}
                />
              </CardContent>
            </Card>
          ) : null}

          {context.can(PERMISSIONS.CLASS_VIEW) ? (
            <>
              <Card className="gap-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t.schoolLife.occupancy}
                  </CardTitle>
                  <CardDescription>
                    {t.schoolLife.occupancyHint}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <RadialGauge
                    value={occupancyPercent}
                    label={t.schoolLife.occupancy}
                    caption={interpolate(t.schoolLife.occupancyCaption, {
                      taken: formatNumber(occupancy.taken, locale),
                      total: formatNumber(occupancy.capacity, locale),
                    })}
                  />
                </CardContent>
              </Card>

              <Card className="gap-4">
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {t.schoolLife.classFill}
                    </CardTitle>
                    <CardDescription>
                      {t.schoolLife.classFillHint}
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                  >
                    <Link href="/classes">{t.nav.classes}</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {fullestClasses.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                      {t.schoolLife.noClasses}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {fullestClasses.map((schoolClass) => (
                        <Meter
                          key={schoolClass.id}
                          // A class with no cap has nothing to be a percentage of;
                          // showing it as full would be a lie, so it reads as 0.
                          value={
                            schoolClass.capacity
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (schoolClass.enrolled /
                                      schoolClass.capacity) *
                                      100,
                                  ),
                                )
                              : 0
                          }
                          label={schoolClass.code}
                          caption={
                            schoolClass.capacity
                              ? interpolate(t.schoolClass.fill, {
                                  enrolled: schoolClass.enrolled,
                                  capacity: schoolClass.capacity,
                                })
                              : `${formatNumber(schoolClass.enrolled, locale)} · ${
                                  t.schoolClass.noCapacity
                                }`
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}

          {context.can(PERMISSIONS.ENROLMENT_VIEW) ? (
            <Card className="gap-4 lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">
                  {t.schoolLife.byLevel}
                </CardTitle>
                <CardDescription>{t.schoolLife.byLevelHint}</CardDescription>
              </CardHeader>
              <CardContent>
                {levelColumns.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    {t.schoolLife.noLevels}
                  </p>
                ) : (
                  <ColumnChart
                    columns={levelColumns}
                    unitLabel={t.schoolLife.students}
                    tableCaption={t.schoolLife.byLevel}
                    categoryLabel={t.enrolment.level}
                  />
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {stats.standing || stats.enrolment ? (
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">
                {t.schoolLife.pipeline}
              </CardTitle>
              <CardDescription>{t.schoolLife.pipelineHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasPipeline ? (
                <EmptyState title={t.schoolLife.allDone} />
              ) : (
                <ul className="divide-y">
                  {stats.standing ? (
                    <PipelineRow
                      icon={<GraduationCapIcon className="size-4" />}
                      label={t.studentOptions.statuses.PRE_REGISTERED}
                      detail={t.student.notEnrolled}
                      count={stats.standing.preRegistered}
                      href="/students"
                      locale={locale}
                    />
                  ) : null}
                  {stats.enrolment ? (
                    <>
                      <PipelineRow
                        icon={<ClockIcon className="size-4" />}
                        label={t.schoolLife.pending}
                        detail={t.schoolLife.pendingDetail}
                        count={stats.enrolment.pending}
                        href={
                          context.can(PERMISSIONS.STUDENT_VIEW)
                            ? "/students"
                            : null
                        }
                        locale={locale}
                      />
                      <PipelineRow
                        icon={<AlertCircleIcon className="size-4" />}
                        label={t.schoolLife.unplaced}
                        detail={t.schoolLife.unplacedDetail}
                        count={stats.enrolment.unplaced}
                        href={
                          context.can(PERMISSIONS.CLASS_VIEW)
                            ? "/classes"
                            : null
                        }
                        locale={locale}
                      />
                    </>
                  ) : null}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </>
  );
}

function PipelineRow({
  icon,
  label,
  detail,
  count,
  href,
  locale,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  count: number;
  href: string | null;
  locale: Parameters<typeof formatNumber>[1];
}) {
  const body = (
    <>
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {detail}
        </span>
      </span>
      <span className="shrink-0 text-lg font-semibold tabular-nums">
        {formatNumber(count, locale)}
      </span>
    </>
  );

  return (
    <li className="first:pt-0 last:pb-0">
      {href ? (
        <Link
          href={href}
          className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 py-2.5">{body}</div>
      )}
    </li>
  );
}
