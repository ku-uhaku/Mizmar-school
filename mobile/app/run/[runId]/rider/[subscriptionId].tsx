import { Stack, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRunRider } from "../../../../src/api/hooks";
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
  Title,
} from "../../../../src/ui/components";
import { ATTENDANCE_LABELS, label } from "../../../../src/ui/format";
import { radius, spacing, useTheme } from "../../../../src/ui/theme";

/**
 * One child on the bus.
 *
 * Opened from the register when somebody is not at the kerb, which is the only
 * reason it exists — so the telephone is the point of the screen and everything
 * else is there to make sure the crew is ringing about the right child.
 *
 * It shows what the school holds about reaching the family and nothing else:
 * no fees, no address, no marks. `canPickUp` is included because it is the one
 * fact that decides whether an adult at the kerb may take the child.
 */
export default function RiderScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { runId, subscriptionId } = useLocalSearchParams<{
    runId: string;
    subscriptionId: string;
  }>();

  const rider = useRunRider(runId, subscriptionId);
  const data = rider.data;

  function call(phone: string, who: string) {
    const url = `tel:${phone.replace(/\s/g, "")}`;
    Linking.canOpenURL(url)
      .then((can) => {
        if (can) return Linking.openURL(url);
        Alert.alert("Appel impossible", `${who} : ${phone}`);
        return undefined;
      })
      .catch(() => Alert.alert("Appel impossible", `${who} : ${phone}`));
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: data?.studentName ?? "Élève" }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {rider.isPending ? <Loading /> : null}
        {rider.isError ? (
          <ErrorNote message="Impossible de charger cet élève." />
        ) : null}

        {data ? (
          <>
            <View style={{ gap: 4 }}>
              <Title>{data.studentName}</Title>
              <Caption>
                {[data.className, data.levelName, data.studentCode]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption>
            </View>

            <Card>
              <Heading>Son arrêt</Heading>
              <Divider />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: spacing.md,
                }}
              >
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <Body>{data.stopName}</Body>
                  {data.landmark ? <Caption>{data.landmark}</Caption> : null}
                </View>
                {data.time ? (
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {data.time}
                  </Text>
                ) : null}
              </View>

              <Divider />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Caption>Aujourd&apos;hui :</Caption>
                <Badge
                  tone={
                    data.status === null
                      ? "default"
                      : data.status === "PRESENT"
                        ? "success"
                        : data.status === "ABSENT"
                          ? "danger"
                          : "warning"
                  }
                >
                  {data.status === null
                    ? "Non pointé"
                    : data.status === "LATE" && data.minutesLate
                      ? `Retard ${data.minutesLate} min`
                      : label(ATTENDANCE_LABELS, data.status)}
                </Badge>
              </View>

              {data.reason ? <Caption>{data.reason}</Caption> : null}
            </Card>

            <Card>
              <Heading>Qui prévenir</Heading>
              <Caption>
                À appeler si l&apos;élève n&apos;est pas à son arrêt.
              </Caption>
              <Divider />

              {data.guardians.length === 0 ? (
                <Empty message="Aucun contact enregistré pour cette famille." />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {data.guardians.map((guardian, index) => (
                    <View key={`${guardian.name}-${index}`} style={{ gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: spacing.sm,
                        }}
                      >
                        <View style={{ flexShrink: 1, gap: 2 }}>
                          <Body>{guardian.name}</Body>
                          <Caption>
                            {guardian.relationship}
                            {guardian.isPrimaryContact
                              ? " · contact principal"
                              : ""}
                          </Caption>
                        </View>

                        {/* The one fact that decides whether an adult at the
                            kerb may take the child. */}
                        {!guardian.canPickUp ? (
                          <Badge tone="danger">Ne récupère pas</Badge>
                        ) : null}
                      </View>

                      {guardian.phone ? (
                        <Pressable
                          onPress={() => call(guardian.phone!, guardian.name)}
                          accessibilityRole="button"
                          accessibilityLabel={`Appeler ${guardian.name}`}
                          style={({ pressed }) => ({
                            alignItems: "center",
                            paddingVertical: 12,
                            borderRadius: radius.sm,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: theme.primary,
                            backgroundColor: `${theme.primary}1a`,
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Text
                            style={{
                              color: theme.primary,
                              fontSize: 15,
                              fontWeight: "700",
                            }}
                          >
                            Appeler {guardian.phone}
                          </Text>
                        </Pressable>
                      ) : (
                        <Caption>Aucun numéro enregistré.</Caption>
                      )}

                      {index < data.guardians.length - 1 ? <Divider /> : null}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
