import Link from "next/link";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BusIcon,
  CalendarRangeIcon,
  HeartHandshakeIcon,
  SchoolIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { SectionHeading } from "@/components/shell/section-heading";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { displayName, requireAuth } from "@/lib/dal";
import { DashboardCharts } from "@/modules/dashboard/components/dashboard-charts";
import {
  loadDashboardCharts,
  loadDashboardStats,
  loadSectionHeadlines,
} from "@/modules/dashboard/queries";
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * The way into the app, in three bands.
 *
 * The first is the four working sections — vie scolaire, caisse, logistique,
 * RH — each with its headline figure and whatever inside it is waiting on
 * somebody. A section the reader may not open is simply absent, exactly as it
 * is from the sidebar. The second charts the year. The third is the
 * administration of the organisation itself, which is read far less often and
 * so sits below, in the smaller figures that say so.
 *
 * The bands are ordered by how often they are read and weighted to match:
 * every band wears the same rule-and-label heading, and the spacing between
 * them is set once on the wrapper rather than by whichever band came first.
 *
 * Every figure is live and scoped inside its owning module, so a school
 * director does not learn the size of the rest of the organisation.
 */
export default async function DashboardPage() {
  const context = await requireAuth();
  const t = await getDictionary();
  const locale = await getLocale();

  const [{ activeSchools, users, roleCount, yearCount }, headlines] =
    await Promise.all([
      loadDashboardStats(context),
      loadSectionHeadlines(context),
    ]);

  // The charts read the same permission-scoped module queries the counts do, so
  // a reader who may not open a section is not charted one either.
  const charts = await loadDashboardCharts(context);

  /** A warning label, or undefined when there is nothing to warn about. */
  const attention = (count: number, template: string) =>
    count > 0 ? interpolate(template, { count }) : undefined;

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

      {/* One rhythm for the whole page: the bands are separated here and
        nowhere else, so no band carries a margin that only makes sense beside
        whichever band happens to follow it today. */}
      <div className="space-y-8">
        {/* ---- The working sections ------------------------------------- */}
        <section className="space-y-3">
          <SectionHeading label={t.dashboard.sections} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {headlines.vieScolaire ? (
              <SectionCard
                href="/school-life"
                title={t.nav.vieScolaire}
                description={t.dashboard.vieScolaireHint}
                icon={<HeartHandshakeIcon className="size-4" />}
                value={headlines.vieScolaire.value}
                valueLabel={t.dashboard.students}
                detail={interpolate(t.dashboard.enrolledCount, {
                  count: headlines.vieScolaire.detail,
                })}
                attention={attention(
                  headlines.vieScolaire.attention,
                  t.dashboard.toPlaceCount,
                )}
              />
            ) : null}

            {headlines.finance ? (
              <SectionCard
                href="/caisse"
                title={t.nav.finance}
                description={t.dashboard.financeHint}
                icon={<WalletIcon className="size-4" />}
                value={headlines.finance.value}
                suffix={` ${context.settings.currencyCode}`}
                valueLabel={t.treasury.collectedToday}
                detail={interpolate(t.treasury.openRegisterCount, {
                  count: headlines.finance.detail,
                })}
                attention={attention(
                  headlines.finance.attention,
                  t.treasury.bouncedCount,
                )}
              />
            ) : null}

            {headlines.logistique ? (
              <SectionCard
                href="/transport"
                title={t.nav.logistique}
                description={t.dashboard.logistiqueHint}
                icon={<BusIcon className="size-4" />}
                value={headlines.logistique.value}
                valueLabel={t.transport.ridersTotal}
                detail={interpolate(t.dashboard.linesCount, {
                  count: headlines.logistique.detail,
                })}
                attention={attention(
                  headlines.logistique.attention,
                  t.transport.paperworkCount,
                )}
              />
            ) : null}

            {headlines.rh ? (
              <SectionCard
                href="/hr"
                title={t.nav.rh}
                description={t.dashboard.rhHint}
                icon={<BriefcaseIcon className="size-4" />}
                value={headlines.rh.value}
                valueLabel={t.hr.headcount}
                detail={interpolate(t.dashboard.leaveRequestCount, {
                  count: headlines.rh.detail,
                })}
                attention={attention(
                  headlines.rh.attention,
                  t.hr.unmarkedCount,
                )}
              />
            ) : null}
          </div>
        </section>

        {/* ---- The year, charted ---------------------------------------- */}
        {/* Heads and spaces itself, and collapses to nothing when the reader is
          charted nothing — so an empty band leaves no empty heading behind. */}
        <DashboardCharts charts={charts} />

        {/* ---- Administration -------------------------------------------- */}
        <section className="space-y-3">
          <SectionHeading label={t.nav.administration} />

          {/* Both rows inside the band step at the same gap they use between
            their own cards, so the band reads as one grid rather than two. */}
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                compact
                label={t.dashboard.schools}
                value={context.schools.length}
                detail={`${formatNumber(activeSchools, locale)} ${t.dashboard.activeSchools}`}
                icon={<SchoolIcon className="size-4" />}
                locale={locale}
                href={context.can(PERMISSIONS.SCHOOL_VIEW) ? "/schools" : null}
              />
              {/* Omitted rather than zeroed for a reader without the code —
                see the note on `loadDashboardStats`. */}
              {users ? (
                <StatTile
                  compact
                  label={t.dashboard.users}
                  value={users.total}
                  detail={`${formatNumber(users.active, locale)} ${t.dashboard.activeUsers}`}
                  icon={<UsersIcon className="size-4" />}
                  locale={locale}
                  href={context.can(PERMISSIONS.USER_VIEW) ? "/users" : null}
                />
              ) : null}
              {yearCount !== null ? (
                <StatTile
                  compact
                  label={t.dashboard.schoolYears}
                  value={yearCount}
                  detail={
                    context.currentSchool?.name ?? t.context.noSchoolSelected
                  }
                  icon={<CalendarRangeIcon className="size-4" />}
                  locale={locale}
                  href={
                    context.can(PERMISSIONS.SCHOOL_YEAR_VIEW)
                      ? "/school-years"
                      : null
                  }
                />
              ) : null}
              {roleCount !== null ? (
                <StatTile
                  compact
                  label={t.dashboard.roles}
                  value={roleCount}
                  detail={t.dashboard.rolesDetail}
                  icon={<ShieldCheckIcon className="size-4" />}
                  locale={locale}
                  href={context.canOrg(PERMISSIONS.ROLE_VIEW) ? "/roles" : null}
                />
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
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
                    <p className="text-muted-foreground text-xs">
                      {t.context.school}
                    </p>
                    <p className="font-medium">
                      {context.currentSchool?.name ??
                        t.context.noSchoolSelected}
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
                      {context.currentSchoolYear?.name ??
                        t.context.noYearSelected}
                    </p>
                    {context.currentSchoolYear ? (
                      <p className="text-muted-foreground text-xs">
                        {formatDate(
                          context.currentSchoolYear.startDate,
                          locale,
                        )}{" "}
                        —{" "}
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
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                    >
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
          </div>
        </section>
      </div>
    </>
  );
}
