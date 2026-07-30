import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  GraduationCapIcon,
  SchoolIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ColumnChart } from "@/components/charts/column-chart";
import { Meter } from "@/components/charts/meter";
import { SplitBar } from "@/components/charts/split-bar";
import { StatTile } from "@/components/charts/stat-tile";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/shell/page-header";
import { PreviewCard } from "@/components/shell/preview-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { displayName, requireAuth } from "@/lib/dal";
import {
  CAPACITY,
  ENROLMENT_BY_MONTH,
  PREVIEW_KPIS,
  RECENT_ACTIVITY,
  STUDENTS_BY_LEVEL,
  STUDENTS_BY_SCHOOL,
  UPCOMING,
} from "@/lib/dashboard-preview";
import { db } from "@/lib/db";
import { SCHOOL_LEVELS } from "@/lib/enums";
import {
  formatDate,
  formatNumber,
  interpolate,
  intlLocale,
} from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Two halves, and the split is deliberate.
 *
 * The lower band — the KPI tiles, the working context, the school list — is
 * **live**: real counts, scoped to what this user is allowed to see. The upper
 * band is **placeholder**, badged as such, standing in until the academic
 * tables exist. Keeping the two visibly apart is what stops a demo number being
 * mistaken for a real one.
 */
export default async function DashboardPage() {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  const organizationId = context.organization.id;
  const visibleSchoolIds = context.schools.map((school) => school.id);

  // Counts are scoped to what this user can actually see, so a school director
  // does not learn the size of the rest of the organisation.
  const [activeSchools, userCount, activeUserCount, roleCount, yearCount] =
    await Promise.all([
      db.school.count({
        where: { id: { in: visibleSchoolIds }, isActive: true },
      }),
      context.canOrg(PERMISSIONS.USER_VIEW)
        ? db.user.count({ where: { organizationId } })
        : db.user.count({
            where: { memberships: { some: { schoolId: { in: visibleSchoolIds } } } },
          }),
      context.canOrg(PERMISSIONS.USER_VIEW)
        ? db.user.count({ where: { organizationId, isActive: true } })
        : db.user.count({
            where: {
              isActive: true,
              memberships: { some: { schoolId: { in: visibleSchoolIds } } },
            },
          }),
      db.role.count({ where: { organizationId } }),
      db.schoolYear.count({ where: { schoolId: { in: visibleSchoolIds } } }),
    ]);

  const badge = {
    badgeLabel: t.dashboard.preview,
    badgeHint: t.dashboard.previewNote,
  };

  // Month labels for the trend, ending on the current month.
  const monthFormatter = new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
  });
  const now = new Date();
  const enrolmentPoints = ENROLMENT_BY_MONTH.map((value, index) => {
    const monthsBack = ENROLMENT_BY_MONTH.length - 1 - index;
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    return { label: monthFormatter.format(date), value };
  });

  const levelColumns = SCHOOL_LEVELS.filter(
    (level) => level in STUDENTS_BY_LEVEL,
  ).map((level) => ({
    label: t.school.levels[level as keyof typeof t.school.levels],
    value: STUDENTS_BY_LEVEL[level],
  }));

  // Real school names, placeholder numbers — hence the badge on the card.
  const schoolSegments = context.schools.slice(0, 3).map((school, index) => ({
    label: school.name,
    value: STUDENTS_BY_SCHOOL[index] ?? 0,
  }));

  function relativeLabel(minutesAgo: number): string {
    if (minutesAgo < 60) {
      return interpolate(t.dashboard.minutesAgo, { count: minutesAgo });
    }
    if (minutesAgo < 60 * 24) {
      return interpolate(t.dashboard.hoursAgo, {
        count: Math.round(minutesAgo / 60),
      });
    }
    return interpolate(t.dashboard.daysAgo, {
      count: Math.round(minutesAgo / (60 * 24)),
    });
  }

  return (
    <>
      <PageHeader
        title={t.dashboard.title}
        description={interpolate(t.dashboard.welcome, {
          name: displayName(context.user),
        })}
      >
        {context.can(PERMISSIONS.USER_CREATE) ? (
          <Button asChild>
            <Link href="/users/new">
              <UserPlusIcon />
              {t.user.newUser}
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {/* ---- Placeholder band ------------------------------------------ */}
      <SectionHeading label={t.dashboard.overview} badge={t.dashboard.preview} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t.dashboard.students}
          value={PREVIEW_KPIS.students.value}
          icon={<GraduationCapIcon className="size-4" />}
          locale={locale}
          trend={PREVIEW_KPIS.students.trend}
          delta={{
            value: PREVIEW_KPIS.students.delta,
            period: t.dashboard.vsLastMonth,
          }}
        />
        <StatTile
          label={t.dashboard.teachers}
          value={PREVIEW_KPIS.teachers.value}
          icon={<UsersIcon className="size-4" />}
          locale={locale}
          trend={PREVIEW_KPIS.teachers.trend}
          delta={{
            value: PREVIEW_KPIS.teachers.delta,
            period: t.dashboard.vsLastMonth,
          }}
        />
        <StatTile
          label={t.dashboard.attendance}
          value={PREVIEW_KPIS.attendance.value}
          suffix="%"
          icon={<CalendarClockIcon className="size-4" />}
          locale={locale}
          trend={PREVIEW_KPIS.attendance.trend}
          delta={{
            value: PREVIEW_KPIS.attendance.delta,
            period: t.dashboard.vsLastMonth,
          }}
        />
        <StatTile
          label={t.dashboard.feesCollected}
          value={PREVIEW_KPIS.feesCollected.value}
          suffix="%"
          icon={<WalletIcon className="size-4" />}
          locale={locale}
          trend={PREVIEW_KPIS.feesCollected.trend}
          delta={{
            value: PREVIEW_KPIS.feesCollected.delta,
            period: t.dashboard.vsLastMonth,
          }}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <PreviewCard
          title={t.dashboard.enrolmentTrend}
          description={t.dashboard.enrolmentTrendHint}
          className="lg:col-span-2"
          {...badge}
        >
          <TrendChart
            points={enrolmentPoints}
            unitLabel={t.dashboard.students}
            tableCaption={t.dashboard.viewData}
            periodLabel={t.dashboard.month}
          />
        </PreviewCard>

        <PreviewCard
          title={t.dashboard.studentsBySchool}
          description={t.dashboard.studentsBySchoolHint}
          {...badge}
        >
          {schoolSegments.length > 0 ? (
            <div className="space-y-6">
              <SplitBar segments={schoolSegments} />
              <Meter
                value={Math.round((CAPACITY.enrolled / CAPACITY.capacity) * 100)}
                label={t.dashboard.capacity}
                caption={interpolate(t.dashboard.capacityCaption, {
                  enrolled: formatNumber(CAPACITY.enrolled, locale),
                  capacity: formatNumber(CAPACITY.capacity, locale),
                })}
              />
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t.dashboard.noSchools}
            </p>
          )}
        </PreviewCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <PreviewCard
          title={t.dashboard.studentsByLevel}
          description={t.dashboard.studentsByLevelHint}
          className="lg:col-span-2"
          {...badge}
        >
          <ColumnChart
            columns={levelColumns}
            unitLabel={t.dashboard.students}
            tableCaption={t.dashboard.viewData}
            categoryLabel={t.dashboard.level}
          />
        </PreviewCard>

        <PreviewCard title={t.dashboard.upcoming} {...badge}>
          <ul className="divide-y">
            {UPCOMING.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate text-sm">
                  {t.dashboard.deadlines[item.key]}
                </span>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {interpolate(t.dashboard.inDays, { count: item.inDays })}
                </Badge>
              </li>
            ))}
          </ul>
        </PreviewCard>
      </div>

      <div className="mt-4">
        <PreviewCard title={t.dashboard.recentActivity} {...badge}>
          <ul className="divide-y">
            {RECENT_ACTIVITY.map((entry) => {
              const initials = entry.actor
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <li
                  key={`${entry.key}-${entry.minutesAgo}`}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{entry.actor}</span>{" "}
                    <span className="text-muted-foreground">
                      {t.dashboard.activity[entry.key]}
                    </span>
                  </p>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {relativeLabel(entry.minutesAgo)}
                  </span>
                </li>
              );
            })}
          </ul>
        </PreviewCard>
      </div>

      {/* ---- Live band -------------------------------------------------- */}
      <div className="mt-8">
        <SectionHeading label={t.nav.administration} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t.dashboard.schools}
          value={context.schools.length}
          detail={`${formatNumber(activeSchools, locale)} ${t.dashboard.activeSchools}`}
          icon={<SchoolIcon className="size-4" />}
          locale={locale}
          href={context.can(PERMISSIONS.SCHOOL_VIEW) ? "/schools" : null}
        />
        <StatTile
          label={t.dashboard.users}
          value={userCount}
          detail={`${formatNumber(activeUserCount, locale)} ${t.dashboard.activeUsers}`}
          icon={<UsersIcon className="size-4" />}
          locale={locale}
          href={context.can(PERMISSIONS.USER_VIEW) ? "/users" : null}
        />
        <StatTile
          label={t.dashboard.schoolYears}
          value={yearCount}
          detail={context.currentSchool?.name ?? t.context.noSchoolSelected}
          icon={<CalendarRangeIcon className="size-4" />}
          locale={locale}
          href={context.can(PERMISSIONS.SCHOOL_YEAR_VIEW) ? "/school-years" : null}
        />
        <StatTile
          label={t.dashboard.roles}
          value={roleCount}
          detail={t.dashboard.rolesDetail}
          icon={<ShieldCheckIcon className="size-4" />}
          locale={locale}
          href={context.canOrg(PERMISSIONS.ROLE_VIEW) ? "/roles" : null}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Working context */}
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base">
              {t.dashboard.currentContext}
            </CardTitle>
            <CardDescription>{t.context.workingContext}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t.context.school}</p>
              <p className="font-medium">
                {context.currentSchool?.name ?? t.context.noSchoolSelected}
              </p>
              {context.currentSchool ? (
                <p className="text-muted-foreground text-xs">
                  {context.currentSchool.code}
                  {context.currentSchool.city
                    ? ` · ${context.currentSchool.city}`
                    : ""}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">
                {t.context.schoolYear}
              </p>
              <p className="font-medium">
                {context.currentSchoolYear?.name ?? t.context.noYearSelected}
              </p>
              {context.currentSchoolYear ? (
                <p className="text-muted-foreground text-xs">
                  {formatDate(context.currentSchoolYear.startDate, locale)} —{" "}
                  {formatDate(context.currentSchoolYear.endDate, locale)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5 border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {t.dashboard.yourPermissions}
              </p>
              {context.isSuperAdmin ? (
                <p className="text-sm font-medium text-pretty">
                  {t.dashboard.superAdminNote}
                </p>
              ) : (
                <p className="font-medium">
                  {interpolate(t.dashboard.permissionCount, {
                    count: context.permissions.size,
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schools the user can reach */}
        <Card className="gap-4 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {t.dashboard.recentSchools}
              </CardTitle>
              <CardDescription>{t.school.subtitle}</CardDescription>
            </div>
            {context.can(PERMISSIONS.SCHOOL_VIEW) ? (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/schools">
                  {t.nav.schools}
                  <ArrowRightIcon className="rtl-flip" />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {context.schools.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t.dashboard.noSchools}
              </p>
            ) : (
              <ul className="divide-y">
                {context.schools.slice(0, 6).map((school) => (
                  <li
                    key={school.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {school.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {school.code}
                        {school.city ? ` · ${school.city}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {
                          t.school.levels[
                            school.level as keyof typeof t.school.levels
                          ]
                        }
                      </Badge>
                      {school.id === context.currentSchool?.id ? (
                        <Badge>{t.common.current}</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Rule-and-label divider that separates the placeholder band from the live one. */
function SectionHeading({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
        {label}
      </h2>
      {badge ? (
        <Badge
          variant="outline"
          className="text-muted-foreground shrink-0 font-normal"
        >
          {badge}
        </Badge>
      ) : null}
      <Separator className="flex-1" />
    </div>
  );
}
