"use client";

import {
  BanknoteArrowUpIcon,
  CalendarCheckIcon,
  CalendarOffIcon,
  ContactIcon,
  FileWarningIcon,
  UsersIcon,
} from "lucide-react";

import Link from "next/link";

import { ColumnChart } from "@/components/charts/column-chart";
import { SectionHeading } from "@/components/shell/section-heading";
import { StatTile } from "@/components/charts/stat-tile";
import { EmptyState } from "@/components/shell/empty-state";
import {
  SectionLinks,
  type SectionLink,
} from "@/components/shell/section-links";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDate,
  formatMonth,
  formatMoney,
  interpolate,
} from "@/lib/i18n/format";
import { JOB_ROLES } from "@/modules/hr/enums";
import type { HrSummary, LeaveRow, StaffRow } from "@/modules/hr/queries";

/**
 * The RH section, seen whole.
 *
 * It leads with the two gaps that cost a school money — people employed without
 * a live contract, and a register nobody has marked — because those are what
 * somebody has to act on today. The wage bill is shown only to a reader who may
 * open the payroll; without that permission the tile is simply absent rather
 * than blanked, since a redacted figure still says the figure exists.
 */
export function HrDashboard({
  summary,
  staff,
  pendingLeave,
  period,
  permissions,
}: {
  summary: HrSummary;
  staff: StaffRow[];
  /** Requests still awaiting a decision — the only ones anybody must act on. */
  pendingLeave: LeaveRow[];
  period: { year: number; month: number };
  permissions: { canPayroll: boolean; canAttendance: boolean };
}) {
  const t = useT();
  const { currencyCode: currency } = useSettings();
  const locale = useLocale();

  // The month is in the URL because the server sums the wage bill over it —
  // see the page. It had no control at all, so a bursar could land on
  // September only by editing the query string by hand.
  const monthHref = (delta: number) => {
    const date = new Date(period.year, period.month - 1 + delta, 1);
    return `/hr?year=${date.getFullYear()}&month=${date.getMonth() + 1}`;
  };

  // Only roles the school actually employs — an empty column reads as a gap
  // rather than as a job nobody happens to hold.
  const byRole = JOB_ROLES.map((role) => ({
    label: t.hrOptions.jobRoles[role],
    value: staff.filter(
      (person) => person.jobRole === role && person.status === "ACTIVE",
    ).length,
  })).filter((column) => column.value > 0);

  const links: SectionLink[] = [
    {
      href: "/hr/staff",
      label: t.nav.hrStaff,
      description: t.hr.staffHint,
      icon: <ContactIcon className="size-4" />,
      badge: String(summary.headcount),
    },
  ];

  if (permissions.canAttendance) {
    links.push({
      href: "/hr/attendance",
      label: t.nav.hrAttendance,
      description: t.hr.attendanceHint,
      icon: <CalendarCheckIcon className="size-4" />,
      badge:
        summary.unmarkedToday > 0
          ? interpolate(t.hr.unmarkedCount, { count: summary.unmarkedToday })
          : t.hr.registerComplete,
      badgeTone: summary.unmarkedToday > 0 ? "warn" : undefined,
    });
  }

  if (permissions.canPayroll) {
    links.push({
      href: "/hr/payroll",
      label: t.nav.hrPayroll,
      description: t.hr.payrollHint,
      icon: <BanknoteArrowUpIcon className="size-4" />,
      badge:
        summary.unpaidThisMonth > 0
          ? interpolate(t.hr.unpaidCount, { count: summary.unpaidThisMonth })
          : undefined,
      badgeTone: summary.unpaidThisMonth > 0 ? "warn" : undefined,
    });
  }

  links.push({
    href: "/hr/leave",
    label: t.nav.hrLeave,
    description: t.hr.leaveHint,
    icon: <CalendarOffIcon className="size-4" />,
    badge: summary.pendingLeave > 0 ? String(summary.pendingLeave) : undefined,
  });

  return (
    <div className="grid gap-5">
      {/* Three bands, the same three the main dashboard is built from and in the
        same order: what the numbers say, where to go, then what the year looks
        like. The headings are what make that order legible — without them the
        page is one undifferentiated run of cards. */}
      <section className="grid gap-3">
        <SectionHeading label={t.bands.overview} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t.hr.headcount}
            value={summary.headcount}
            detail={interpolate(t.hr.onLeaveCount, {
              count: summary.onLeaveCount,
            })}
            icon={<UsersIcon className="size-4" />}
            locale={locale}
            href="/hr/staff"
          />
          <StatTile
            label={t.hr.unmarkedToday}
            value={summary.unmarkedToday}
            detail={t.hr.unmarkedTodayHint}
            icon={<CalendarCheckIcon className="size-4" />}
            locale={locale}
            href={permissions.canAttendance ? "/hr/attendance" : null}
          />
          <StatTile
            label={t.hr.withoutContract}
            value={summary.withoutContract}
            detail={t.hr.withoutContractHint}
            icon={<FileWarningIcon className="size-4" />}
            locale={locale}
            href="/hr/staff"
          />
          {permissions.canPayroll && summary.monthlyPayrollCentimes !== null ? (
            <StatTile
              label={t.hr.monthlyPayroll}
              // The tile formats counts, and a wage bill is money — the figure is
              // passed already in dirhams so it is not read as a headcount.
              value={Math.round(summary.monthlyPayrollCentimes / 100)}
              suffix={` ${currency}`}
              detail={interpolate(t.hr.unpaidCount, {
                count: summary.unpaidThisMonth,
              })}
              icon={<BanknoteArrowUpIcon className="size-4" />}
              locale={locale}
              href="/hr/payroll"
            />
          ) : (
            <StatTile
              label={t.hr.pendingLeave}
              value={summary.pendingLeave}
              detail={t.hr.pendingLeaveHint}
              icon={<CalendarOffIcon className="size-4" />}
              locale={locale}
              href="/hr/leave"
            />
          )}
        </div>
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.goTo} />
        <SectionLinks links={links} />
      </section>

      <section className="grid gap-3">
        <SectionHeading label={t.bands.insights} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-4 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t.hr.byRole}</CardTitle>
              <CardDescription>{t.hr.byRoleHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {byRole.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {t.hr.noStaff}
                </p>
              ) : (
                <ColumnChart
                  columns={byRole}
                  unitLabel={t.hr.staff}
                  tableCaption={t.dashboard.viewData}
                  categoryLabel={t.hr.jobRole}
                />
              )}
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">{t.hr.pendingLeave}</CardTitle>
              <CardDescription>{t.hr.pendingLeaveHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLeave.length === 0 ? (
                <EmptyState title={t.hr.noPendingLeave} />
              ) : (
                <ul className="divide-y">
                  {pendingLeave.slice(0, 6).map((request) => (
                    <li
                      key={request.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {request.staffName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {formatDate(request.startsOn, locale)} —{" "}
                          {formatDate(request.endsOn, locale)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {t.hrOptions.leaveKinds[
                          request.kind as keyof typeof t.hrOptions.leaveKinds
                        ] ?? request.kind}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <Button size="sm" variant="outline" asChild>
          <Link href={monthHref(-1)}>{t.common.previous}</Link>
        </Button>
        <span className="font-medium">
          {formatMonth(period.year, period.month, locale)}
        </span>
        <Button size="sm" variant="outline" asChild>
          <Link href={monthHref(1)}>{t.common.next}</Link>
        </Button>
        <span>
          ·{" "}
          {summary.unpaidCentimes !== null
            ? `${formatMoney(summary.unpaidCentimes, locale, currency)} ${t.hr.unpaidThisMonth}`
            : t.hr.ledgerNote}
        </span>
      </div>
    </div>
  );
}
