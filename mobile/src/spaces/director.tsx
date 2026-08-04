import { View } from "react-native";

import { useDirectorDashboard } from "../api/hooks";
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
import { money } from "../ui/format";
import { spacing, useTheme } from "../ui/theme";

/**
 * The director's figures.
 *
 * The same numbers as the web dashboard and scoped the same way — a directrice
 * d'école sees her school, a manager with org reach sees the group — because
 * both come from `loadSchoolLifeStats` rather than from anything computed here.
 */
export function DirectorSpace() {
  const theme = useTheme();
  const dashboard = useDirectorDashboard();

  if (dashboard.isPending) return <Loading />;

  if (dashboard.isError) {
    return <ErrorNote message="Impossible de charger le tableau de bord." />;
  }

  const { stats } = dashboard.data;
  const collected =
    stats.enrolment.billedCentimes - stats.enrolment.discountedCentimes;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Heading>Effectifs</Heading>
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
          <Stat value={stats.students.enrolled} label="Élèves inscrits" tone="success" />
          <Stat
            value={stats.students.preRegistered}
            label="Préinscrits"
            tone={stats.students.preRegistered > 0 ? "warning" : "default"}
          />
          <Stat value={stats.families} label="Familles" />
          <Stat
            value={stats.enrolment.unplaced}
            label="Sans classe"
            tone={stats.enrolment.unplaced > 0 ? "danger" : "success"}
          />
        </View>
      </Card>

      <Card>
        <Heading>Scolarité facturée</Heading>
        <Row label="Facturé" value={money(stats.enrolment.billedCentimes)} />
        <Row
          label="Remises accordées"
          value={money(stats.enrolment.discountedCentimes)}
          tone="warning"
        />
        <Divider />
        <Row label="Net attendu" value={money(collected)} tone="success" />
      </Card>

      <Card>
        <Heading>Par niveau</Heading>
        {stats.byLevel.length === 0 ? (
          <Empty message="Aucun niveau ouvert cette année." />
        ) : (
          stats.byLevel
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((level) => {
              const share =
                stats.students.enrolled > 0
                  ? level.value / stats.students.enrolled
                  : 0;

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
