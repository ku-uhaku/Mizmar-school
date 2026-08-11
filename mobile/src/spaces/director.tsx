import { View } from "react-native";

import { useDirectorDashboard } from "../api/hooks";
import { useFormat, useT } from "../i18n";
import {
  Body,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Heading,
  Loading,
  Row,
  Stat,
} from "../ui/components";
import { spacing, useTheme } from "../ui/theme";

/**
 * The director's figures.
 *
 * The same numbers as the web dashboard and scoped the same way — a directrice
 * d'école sees her school, a manager with org reach sees the group — because
 * both come from `loadSchoolLifeStats` rather than from anything computed here.
 *
 * Every block the server may withhold is drawn only when it arrives. The route
 * returns null for a figure this reader has not earned, and a card that filled
 * the gap with a zero would be inventing an answer.
 */
export function DirectorSpace() {
  const theme = useTheme();
  const t = useT();
  const fmt = useFormat();
  const dashboard = useDirectorDashboard();

  if (dashboard.isPending) return <Loading />;

  if (dashboard.isError) {
    return <ErrorNote message={t.directorSpace.loadError} />;
  }

  const { stats } = dashboard.data;
  const { standing, enrolment, billing } = stats;
  const enrolled = standing?.enrolled ?? 0;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Heading>{t.directorSpace.enrolment}</Heading>
        <Caption>
          {[dashboard.data.schoolName, dashboard.data.schoolYearName]
            .filter(Boolean)
            .join(" · ")}
        </Caption>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.md,
            marginTop: spacing.sm,
          }}
        >
          {/* Each figure is dropped rather than zeroed when the server withheld
              it — a "0" here would be a claim about the school. */}
          {standing ? (
            <>
              <Stat value={standing.enrolled} label={t.directorSpace.enrolled} tone="success" />
              <Stat
                value={standing.preRegistered}
                label={t.directorSpace.preRegistered}
                tone={standing.preRegistered > 0 ? "warning" : "default"}
              />
            </>
          ) : null}
          {stats.families === null ? null : (
            <Stat value={stats.families} label={t.directorSpace.families} />
          )}
          {enrolment ? (
            <Stat
              value={enrolment.unplaced}
              label={t.directorSpace.unplaced}
              tone={enrolment.unplaced > 0 ? "danger" : "success"}
            />
          ) : null}
        </View>
      </Card>

      {billing ? (
        <Card>
          <Heading>{t.directorSpace.billing}</Heading>
          <Row label={t.directorSpace.billed} value={fmt.money(billing.billedCentimes)} />
          <Row
            label={t.directorSpace.discountsGranted}
            value={fmt.money(billing.discountedCentimes)}
            tone="warning"
          />
          <Divider />
          <Row
            label={t.directorSpace.netExpected}
            value={fmt.money(billing.billedCentimes - billing.discountedCentimes)}
            tone="success"
          />
        </Card>
      ) : null}

      <Card>
        <Heading>{t.directorSpace.byLevel}</Heading>
        {stats.byLevel.length === 0 ? (
          <Empty message={t.directorSpace.noLevelsOpen} />
        ) : (
          stats.byLevel
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((level) => {
              const share = enrolled > 0 ? level.value / enrolled : 0;

              return (
                <View key={level.levelCode} style={{ gap: 4, paddingVertical: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Body>{level.label}</Body>
                    <Body muted>{level.value}</Body>
                  </View>

                  {/* A bar rather than a chart library: one dimension, one
                      colour, and nothing to install. */}
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(share * 100)}%`,
                        height: "100%",
                        backgroundColor: theme.primary,
                      }}
                    />
                  </View>
                </View>
              );
            })
        )}
      </Card>
    </View>
  );
}
