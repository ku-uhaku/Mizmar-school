import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMarkRider, useMoveRun, useRunRegister } from "../../src/api/hooks";
import { interpolate, label, useFormat, useT } from "../../src/i18n";
import {
  Badge,
  Body,
  Button,
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
import { radius, spacing, useTheme } from "../../src/ui/theme";

/**
 * One voyage, from the kerb.
 *
 * The screen has three states and shows exactly one of them, because that is
 * how the morning actually goes:
 *
 *   1. **Before the départ** — no names at all, just the one button. The server
 *      withholds the register until the run is under way (see
 *      `loadRunRegister`), so there is nothing here to mark from the yard, and
 *      pressing "démarrer" is what declares which voyage is being made.
 *   2. **En route** — the sheet, in the order the bus meets them, three taps
 *      per child. Each mark is posted on its own: a bus marks a child as it
 *      reaches them, and a payload carrying the whole register would let the
 *      last write undo the absence flagged three stops back.
 *   3. **Au terminus** — clôturer, with a warning if anybody is still
 *      unaccounted for. Warned, not blocked: a voyage that happened has to be
 *      closeable, and a driver whose phone lost signal at a stop must not be
 *      stranded on this screen.
 *
 * Outside the run's hour none of it is offered — the server refuses the départ
 * and the marks anyway, so the screen says why rather than presenting a button
 * that is going to fail.
 */
export default function RunScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const fmt = useFormat();
  const { runId } = useLocalSearchParams<{ runId: string }>();

  const register = useRunRegister(runId);
  const move = useMoveRun(runId);
  const mark = useMarkRider(runId);

  /** Which child is being written, so only their row shows as busy. */
  const [marking, setMarking] = useState<string | null>(null);

  const run = register.data?.run ?? null;
  const entries = register.data?.entries ?? [];
  const unmarked = entries.filter((entry) => entry.status === null).length;

  const isOpen = run?.window === "OPEN";
  const canStart = run?.status === "PLANNED" && isOpen;
  const canFinish = run?.status === "EN_ROUTE" && isOpen;
  const canMark = run?.status === "EN_ROUTE" && isOpen;

  function start() {
    move.mutate("EN_ROUTE", {
      onError: () =>
        Alert.alert(t.run.departRefusedTitle, t.run.departRefusedBody),
    });
  }

  function finish() {
    const close = () =>
      move.mutate("ARRIVED", {
        onError: () =>
          Alert.alert(t.run.closeRefusedTitle, t.run.closeRefusedBody),
      });

    if (unmarked === 0) {
      close();
      return;
    }

    Alert.alert(
      t.run.finishConfirmTitle,
      interpolate(t.run.finishConfirmBody, { count: unmarked }),
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.run.finishConfirmAction, style: "destructive", onPress: close },
      ],
    );
  }

  function markRider(subscriptionId: string, status: string) {
    setMarking(subscriptionId);
    mark.mutate(
      { subscriptionId, status },
      {
        onError: () =>
          Alert.alert(t.run.markRefusedTitle, t.run.markSaveFailed),
        onSettled: () => setMarking(null),
      },
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: run?.routeCode ?? "Circuit" }}
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
          <ErrorNote message={t.run.loadError} />
        ) : null}

        {run ? (
          <>
            <View style={{ gap: 2 }}>
              <Title>{run.routeName}</Title>
              <Caption>
                {run.plannedDepartureTime} ·{" "}
                {label(t.labels.direction, run.direction)} ·{" "}
                {fmt.longDate(new Date())}
              </Caption>
            </View>

            {/* Readable at any hour, including before the départ — the trajet
                names no child, and it is what somebody covering an unfamiliar
                line reads before setting off. */}
            <Button
              label={t.run.viewRoute}
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: "/run/[runId]/trajet",
                  params: { runId },
                })
              }
            />

            {/* ── Avant le départ ───────────────────────────────────────── */}
            {run.status === "PLANNED" ? (
              <Card>
                <Heading>{t.run.notStartedTitle}</Heading>
                <Caption>
                  {isOpen
                    ? t.run.notStartedOpen
                    : run.window === "UPCOMING"
                      ? interpolate(t.run.notStartedUpcoming, {
                          time: run.plannedDepartureTime,
                        })
                      : t.run.notStartedPast}
                </Caption>
                {isOpen ? (
                  <>
                    <Divider />
                    <Button
                      label={t.run.startRun}
                      onPress={start}
                      busy={move.isPending}
                    />
                  </>
                ) : null}
              </Card>
            ) : null}

            {run.status === "CANCELLED" ? (
              <Card>
                <Heading>{t.run.cancelledTitle}</Heading>
                <Caption>{run.cancelReason ?? t.run.noReasonGiven}</Caption>
              </Card>
            ) : null}

            {/* ── En route, et après ────────────────────────────────────── */}
            {run.status === "EN_ROUTE" || run.status === "ARRIVED" ? (
              <>
                <Card>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.md,
                    }}
                  >
                    <Stat value={entries.length} label={t.run.expectedStudents} />
                    <Stat
                      value={unmarked}
                      label={t.run.unmarked}
                      tone={unmarked > 0 ? "warning" : "success"}
                    />
                  </View>

                  {run.startedAt ? (
                    <Caption>
                      {interpolate(t.run.departedAt, { time: fmt.clock(run.startedAt) })}
                      {run.arrivedAt
                        ? interpolate(t.run.arrivedAt, { time: fmt.clock(run.arrivedAt) })
                        : ""}
                    </Caption>
                  ) : null}

                  {run.status === "ARRIVED" && isOpen ? (
                    <Caption>{t.run.closedStillEditable}</Caption>
                  ) : null}
                  {!isOpen ? (
                    <Caption>{t.run.pastEditFromOffice}</Caption>
                  ) : null}
                </Card>

                <Heading>{t.run.routeSheet}</Heading>

                {entries.length === 0 ? (
                  <Empty message={t.run.noSubscribers} />
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
                        {/* Opens the child: their stop, and who to ring when
                            they are not standing at it. */}
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/run/[runId]/rider/[subscriptionId]",
                              params: {
                                runId,
                                subscriptionId: entry.subscriptionId,
                              },
                            })
                          }
                          style={({ pressed }) => ({
                            flexShrink: 1,
                            gap: 2,
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Heading>
                            {index + 1}. {entry.studentName}
                          </Heading>
                          <Body muted>
                            {entry.stopName}
                            {entry.pickupTime ? ` · ${entry.pickupTime}` : ""}
                            {entry.className ? ` · ${entry.className}` : ""}
                          </Body>
                        </Pressable>

                        <Badge
                          tone={
                            entry.status === null
                              ? "default"
                              : entry.status === "PRESENT"
                                ? "success"
                                : entry.status === "ABSENT"
                                  ? "danger"
                                  : "warning"
                          }
                        >
                          {entry.status === null
                            ? t.run.notMarked
                            : label(t.labels.attendance, entry.status)}
                        </Badge>
                      </View>

                      {canMark ? (
                        <>
                          <Divider />
                          <View
                            style={{ flexDirection: "row", gap: spacing.sm }}
                          >
                            {(["PRESENT", "LATE", "ABSENT"] as const).map(
                              (status) => (
                                <MarkButton
                                  key={status}
                                  label={label(t.labels.attendance, status)}
                                  selected={entry.status === status}
                                  busy={marking === entry.subscriptionId}
                                  onPress={() =>
                                    markRider(entry.subscriptionId, status)
                                  }
                                />
                              ),
                            )}
                          </View>
                        </>
                      ) : null}

                      {entry.reason ? (
                        <>
                          <Divider />
                          <Caption>{entry.reason}</Caption>
                        </>
                      ) : null}
                    </Card>
                  ))
                )}

                {canFinish ? (
                  <Button
                    label={t.run.finishRun}
                    onPress={finish}
                    busy={move.isPending}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/**
 * One of the three marks, as a segment.
 *
 * Deliberately not `Button`: these sit three to a row under every name and are
 * pressed forty times a morning, so they are sized for a thumb on a moving bus
 * and show which one is set rather than which one is primary.
 */
function MarkButton({
  label: text,
  selected,
  busy,
  onPress,
}: {
  label: string;
  selected: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primary : "transparent",
        opacity: busy ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.primaryText : theme.text,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
