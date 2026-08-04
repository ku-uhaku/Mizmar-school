import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRunRegister } from "../../src/api/hooks";
import {
  Badge,
  Body,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Heading,
  Loading,
  Stat,
  Title,
} from "../../src/ui/components";
import {
  ATTENDANCE_LABELS,
  DIRECTION_LABELS,
  label,
  longDate,
} from "../../src/ui/format";
import { spacing, useTheme } from "../../src/ui/theme";

/**
 * The register for one run.
 *
 * Ordered as the server sends it — by pick-up time, the order the bus meets
 * them — and it shows who has *not* been accounted for as prominently as who
 * has, because that is the question at the kerb before pulling away.
 */
export default function RunScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const register = useRunRegister(runId);

  const entries = register.data?.entries ?? [];
  const unmarked = entries.filter((entry) => entry.status === null).length;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: register.data?.run.routeCode ?? "Circuit",
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {register.isPending ? <Loading /> : null}
        {register.isError ? (
          <ErrorNote message="Impossible de charger la feuille de route." />
        ) : null}

        {register.data ? (
          <>
            <View style={{ gap: 2 }}>
              <Title>{register.data.run.routeName}</Title>
              <Caption>
                {register.data.run.plannedDepartureTime} ·{" "}
                {label(DIRECTION_LABELS, register.data.run.direction)} ·{" "}
                {longDate(new Date())}
              </Caption>
            </View>

            <Card>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                <Stat value={entries.length} label="Élèves attendus" />
                <Stat
                  value={unmarked}
                  label="Non pointés"
                  tone={unmarked > 0 ? "warning" : "success"}
                />
              </View>
              <Caption>
                Le pointage se fait depuis le poste de l&apos;école — cet écran
                est la feuille de route.
              </Caption>
            </Card>

            <Heading>Feuille de route</Heading>

            {entries.length === 0 ? (
              <Empty message="Aucun élève abonné sur ce circuit." />
            ) : (
              entries.map((entry, index) => (
                <Card key={entry.subscriptionId}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flexShrink: 1, gap: 2 }}>
                      <Heading>
                        {index + 1}. {entry.studentName}
                      </Heading>
                      <Body muted>
                        {entry.stopName}
                        {entry.pickupTime ? ` · ${entry.pickupTime}` : ""}
                        {entry.className ? ` · ${entry.className}` : ""}
                      </Body>
                    </View>

                    <Badge
                      tone={
                        entry.status === null
                          ? "default"
                          : entry.status === "PRESENT"
                            ? "success"
                            : "warning"
                      }
                    >
                      {entry.status === null
                        ? "Non pointé"
                        : label(ATTENDANCE_LABELS, entry.status)}
                    </Badge>
                  </View>

                  {entry.reason ? (
                    <>
                      <Divider />
                      <Caption>{entry.reason}</Caption>
                    </>
                  ) : null}
                </Card>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
