"use client";

import { ColumnChart } from "@/components/charts/column-chart";
import { Meter } from "@/components/charts/meter";
import { SplitBar } from "@/components/charts/split-bar";
import { TrendChart } from "@/components/charts/trend-chart";
import { useI18n } from "@/components/providers/i18n-provider";
import { useMoney } from "@/components/providers/settings-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeading } from "@/modules/dashboard/components/section-card";
import { formatMonth, interpolate } from "@/lib/i18n/format";
import { centimesToDirhams } from "@/modules/treasury/enums";
import type { DashboardCharts as ChartData } from "@/modules/dashboard/queries";

/**
 * The year, as four pictures.
 *
 * Each one answers a different *kind* of question, which is why they are four
 * forms and not four bar charts:
 *
 *   • levels        — magnitude across categories        → columns
 *   • collections   — change over time                   → a line
 *   • fees          — part against whole                 → one split bar
 *   • rate          — a single ratio against its limit   → a meter
 *
 * A card whose reader lacks the permission behind it is absent rather than
 * empty: the charts follow the same rule as the section cards above them, and
 * an axis drawn over nothing still asserts that the nothing is true.
 *
 * Amounts are charted in dirhams, not centimes. The axis is read by a human,
 * and "1 240 000" for twelve thousand dirhams is a number nobody can size.
 */
export function DashboardCharts({ charts }: { charts: ChartData }) {
  const { t, locale } = useI18n();
  const money = useMoney();

  const hasLevels = charts.enrolmentByLevel.length > 0;
  const hasTrend = charts.collectionsByMonth.some((point) => point.value > 0);
  const standing = charts.collection;
  const hasMoney = standing !== null && standing.chargedCentimes > 0;

  if (!hasLevels && !hasTrend && !hasMoney) return null;

  const rate = hasMoney
    ? Math.round((standing.paidCentimes / standing.chargedCentimes) * 100)
    : 0;

  // The two plots share a row, but a reader permitted only one of them would
  // get a card beside half a row of nothing. The survivor takes the width.
  const alone = hasLevels !== hasTrend ? "lg:col-span-2" : undefined;

  return (
    <section className="space-y-3">
      <SectionHeading label={t.dashboard.charts} />

      <div className="grid gap-4 lg:grid-cols-2">
        {hasLevels ? (
          <Card className={alone}>
            <CardHeader>
              <CardTitle>{t.dashboard.pupilsPerLevel}</CardTitle>
              <CardDescription>{t.dashboard.pupilsPerLevelHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <ColumnChart
                columns={charts.enrolmentByLevel}
                unitLabel={t.dashboard.pupilsUnit}
                categoryLabel={t.dashboard.levelLabel}
                tableCaption={t.dashboard.pupilsPerLevel}
              />
            </CardContent>
          </Card>
        ) : null}

        {hasTrend ? (
          <Card className={alone}>
            <CardHeader>
              <CardTitle>{t.dashboard.collectionTrend}</CardTitle>
              <CardDescription>
                {t.dashboard.collectionTrendHint}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                points={charts.collectionsByMonth.map((point) => {
                  // Labels arrive as `YYYY-MM` — the query cannot know the
                  // locale, so the month name is put on here.
                  const [year, month] = point.label.split("-").map(Number);
                  return {
                    label: formatMonth(year, month, locale),
                    value: centimesToDirhams(point.value),
                  };
                })}
                unitLabel={t.dashboard.collectionTrend}
                tableCaption={t.dashboard.collectionTrend}
                periodLabel={t.dashboard.monthLabel}
                // Money collected is a magnitude, so the axis starts at zero —
                // a cropped one would overstate a quiet month as a collapse.
                zeroBaseline
              />
            </CardContent>
          </Card>
        ) : null}

        {hasMoney ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t.dashboard.collectionSplit}</CardTitle>
              <CardDescription>{t.dashboard.collectionSplitHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              {/* Two segments, not three: overdue is a slice of outstanding,
                and a third would make the parts exceed the whole. It is said
                in words underneath instead. */}
              <SplitBar
                segments={[
                  {
                    label: t.dashboard.paidLabel,
                    value: centimesToDirhams(standing.paidCentimes),
                  },
                  {
                    label: t.dashboard.outstandingLabel,
                    value: centimesToDirhams(standing.outstandingCentimes),
                  },
                ]}
              />

              <div className="grid gap-2">
                <Meter
                  value={rate}
                  label={t.dashboard.collectionRate}
                  caption={`${money(standing.paidCentimes)} / ${money(
                    standing.chargedCentimes,
                  )}`}
                />
                {standing.overdueCentimes > 0 ? (
                  <p className="text-destructive text-xs">
                    {interpolate(t.dashboard.overdueNote, {
                      amount: money(standing.overdueCentimes),
                    })}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
