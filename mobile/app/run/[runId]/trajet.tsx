import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRunItinerary } from "../../../src/api/hooks";
import { interpolate, label, useT } from "../../../src/i18n";
import {
  Body,
  Caption,
  Card,
  Empty,
  ErrorNote,
  Heading,
  Loading,
  Stat,
  Title,
} from "../../../src/ui/components";
import { spacing, useTheme } from "../../../src/ui/theme";

/**
 * Le trajet.
 *
 * The stops in the order the bus meets them, drawn as a line down the page so
 * "where am I next" is answered by position rather than by reading times. The
 * server has already reversed the list for the journey home, so nothing here
 * knows which way round the day is.
 *
 * Readable before the départ, unlike the register: it names no child, and it is
 * exactly what a driver covering an unfamiliar line reads before setting off.
 */
export default function TrajetScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { runId } = useLocalSearchParams<{ runId: string }>();

  const itinerary = useRunItinerary(runId);
  const data = itinerary.data;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.trajet.title }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {itinerary.isPending ? <Loading /> : null}
        {itinerary.isError ? (
          <ErrorNote message={t.trajet.loadError} />
        ) : null}

        {data ? (
          <>
            <View style={{ gap: 2 }}>
              <Title>{data.routeName}</Title>
              <Caption>
                {data.routeCode} · {label(t.labels.direction, data.direction)}
              </Caption>
            </View>

            <Card>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <Stat value={data.stops.length} label={t.trajet.stops} />
                <Stat value={data.totalRiders} label={t.trajet.expectedStudents} />
              </View>
            </Card>

            {data.stops.length === 0 ? (
              <Empty message={t.trajet.noStops} />
            ) : (
              <Card>
                {data.stops.map((stop, index) => {
                  const isLast = index === data.stops.length - 1;
                  return (
                    <View
                      key={stop.id}
                      style={{ flexDirection: "row", gap: spacing.md }}
                    >
                      {/* The line down the page: a dot per stop, joined by a
                          rule that stops at the last one. */}
                      <View style={{ alignItems: "center", width: 20 }}>
                        <View
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: 6,
                            marginTop: 5,
                            backgroundColor:
                              stop.riderCount > 0 ? theme.primary : theme.border,
                          }}
                        />
                        {!isLast ? (
                          <View
                            style={{
                              flex: 1,
                              width: StyleSheet.hairlineWidth * 2,
                              backgroundColor: theme.border,
                              marginVertical: 2,
                            }}
                          />
                        ) : null}
                      </View>

                      <View
                        style={{
                          flex: 1,
                          paddingBottom: isLast ? 0 : spacing.lg,
                          gap: 2,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: spacing.sm,
                          }}
                        >
                          <Heading>{stop.name}</Heading>
                          {stop.time ? (
                            <Text
                              style={{
                                color: theme.text,
                                fontSize: 14,
                                fontWeight: "700",
                              }}
                            >
                              {stop.time}
                            </Text>
                          ) : null}
                        </View>

                        {/* What to look for at the kerb — the reason the column
                            exists on RouteStop at all. */}
                        {stop.landmark ? (
                          <Body muted>{stop.landmark}</Body>
                        ) : null}

                        <Caption>
                          {stop.neighbourhoodName
                            ? `${stop.neighbourhoodName} · `
                            : ""}
                          {stop.riderCount === 0
                            ? t.trajet.noStudentsAtStop
                            : interpolate(t.trajet.studentsAtStop, {
                                count: stop.riderCount,
                              })}
                        </Caption>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
