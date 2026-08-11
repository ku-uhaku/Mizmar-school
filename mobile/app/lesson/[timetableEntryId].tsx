import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useLessonRegister,
  useMarkPupil,
  useMarkRestPresent,
} from "../../src/api/hooks";
import { interpolate, label, useT } from "../../src/i18n";
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
  Title,
} from "../../src/ui/components";
import { radius, spacing, useTheme } from "../../src/ui/theme";

/** How late, in one tap. Covers the ordinary retard; the web takes any number. */
const LATE_PRESETS = [5, 10, 15, 30];

/**
 * L'appel, from the front of the class.
 *
 * ── The flow it is built around ─────────────────────────────────────────────
 * A teacher does not mark thirty children one by one. They look up, see who is
 * missing, tap those two or three, and declare the rest present. So the screen
 * leads with that: the absent ones are marked first, and "les autres sont là"
 * fills in everybody untouched. That button only writes the *unmarked* — a
 * retard already recorded survives it, which is what makes it safe to press at
 * any point rather than only at the start.
 *
 * The list can be narrowed to the ones still unpointed, which is what a teacher
 * scans for as the register nears the end. Each tap is posted on its own, so a
 * phone that locks mid-appel has already saved everything touched.
 */
export default function LessonScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const params = useLocalSearchParams<{
    schoolClassId: string;
    subjectId?: string;
    timeSlotId?: string;
    date: string;
  }>();

  // `||` rather than `??`: a whole-day register arrives with these as empty
  // strings, and the API refuses an empty id rather than reading it as absent.
  const ref = {
    schoolClassId: params.schoolClassId,
    subjectId: params.subjectId || null,
    timeSlotId: params.timeSlotId || null,
    date: params.date,
  };

  const register = useLessonRegister(ref);
  const mark = useMarkPupil(ref);
  const restPresent = useMarkRestPresent(ref);

  /** Which pupil is being written, so only their row shows as busy. */
  const [marking, setMarking] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  const data = register.data;
  const canMark = data?.canMark ?? false;
  const tally = data?.tally;
  const done = tally ? tally.total - tally.unmarked : 0;
  const progress = tally && tally.total > 0 ? done / tally.total : 0;

  const pupils = data
    ? pendingOnly
      ? data.pupils.filter((pupil) => pupil.status === null)
      : data.pupils
    : [];

  function markPupil(
    enrollmentId: string,
    status: string,
    minutesLate?: number,
  ) {
    setMarking(enrollmentId);
    mark.mutate(
      { enrollmentId, status, minutesLate: minutesLate ?? null },
      {
        onError: () =>
          Alert.alert(t.lesson.markRefusedTitle, t.lesson.markSaveFailed),
        onSettled: () => setMarking(null),
      },
    );
  }

  function finishRest() {
    const left = tally?.unmarked ?? 0;
    if (left === 0) return;

    Alert.alert(
      t.lesson.finishConfirmTitle,
      interpolate(t.lesson.finishConfirmBody, { count: left }),
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.lesson.finishConfirmAction,
          onPress: () =>
            restPresent.mutate(undefined, {
              onError: () =>
                Alert.alert(t.lesson.finishRefused, t.lesson.finishFailed),
            }),
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: data?.classCode ?? t.lesson.wholeDay }}
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
          <ErrorNote message={t.lesson.loadError} />
        ) : null}

        {data && tally ? (
          <>
            <View style={{ gap: 2 }}>
              <Title>
                {data.classCode}
                {data.groupLabel ? ` (${data.groupLabel})` : ""}
              </Title>
              <Caption>
                {data.subjectName ?? t.lesson.wholeDay}
                {data.slotLabel ? ` · ${data.slotLabel}` : ""}
              </Caption>
            </View>

            <Card>
              {/* The one number that matters mid-appel, said plainly rather
                  than left to be inferred from four separate tallies. */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}
              >
                <Heading>
                  {interpolate(t.lesson.marked, { done, total: tally.total })}
                </Heading>
                <Caption>
                  {tally.unmarked === 0
                    ? t.lesson.finished
                    : interpolate(t.lesson.remaining, { count: tally.unmarked })}
                </Caption>
              </View>

              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.border,
                  overflow: "hidden",
                  marginTop: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    height: "100%",
                    backgroundColor:
                      tally.unmarked === 0 ? theme.success : theme.primary,
                  }}
                />
              </View>

              <Divider />

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <Count label={t.lesson.present} value={tally.present} tone="success" />
                <Count
                  label={t.lesson.lates}
                  value={tally.late}
                  tone={tally.late > 0 ? "warning" : undefined}
                />
                <Count
                  label={t.lesson.absent}
                  value={tally.absent}
                  tone={tally.absent > 0 ? "danger" : undefined}
                />
                <Count label={t.lesson.excused} value={tally.excused} />
              </View>

              {canMark && tally.unmarked > 0 ? (
                <>
                  <Divider />
                  <Button
                    label={interpolate(t.lesson.othersPresent, { count: tally.unmarked })}
                    onPress={finishRest}
                    busy={restPresent.isPending}
                  />
                </>
              ) : null}

              {!canMark ? (
                <>
                  <Divider />
                  <Caption>{t.lesson.viewOnlyNote}</Caption>
                </>
              ) : null}
            </Card>

            {data.pupils.length > 0 ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Toggle
                  label={interpolate(t.lesson.allTab, { count: data.pupils.length })}
                  selected={!pendingOnly}
                  onPress={() => setPendingOnly(false)}
                />
                <Toggle
                  label={interpolate(t.lesson.toMarkTab, { count: tally.unmarked })}
                  selected={pendingOnly}
                  onPress={() => setPendingOnly(true)}
                />
              </View>
            ) : null}

            {data.pupils.length === 0 ? (
              <Empty message={t.lesson.noStudents} />
            ) : pupils.length === 0 ? (
              <Empty message={t.lesson.everyoneMarked} />
            ) : (
              pupils.map((pupil) => (
                <PupilRow
                  key={pupil.enrollmentId}
                  pupil={pupil}
                  canMark={canMark}
                  busy={marking === pupil.enrollmentId}
                  onMark={markPupil}
                />
              ))
            )}

            {canMark && tally.unmarked === 0 ? (
              <Button
                label={t.lesson.finish}
                variant="ghost"
                onPress={() => router.back()}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/** One pupil, and the three taps that decide their hour. */
function PupilRow({
  pupil,
  canMark,
  busy,
  onMark,
}: {
  pupil: {
    enrollmentId: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    status: string | null;
    minutesLate: number | null;
    isJustified: boolean;
    absencesThisYear: number;
    latesThisYear: number;
  };
  canMark: boolean;
  busy: boolean;
  onMark: (
    enrollmentId: string,
    status: string,
    minutesLate?: number,
  ) => void;
}) {
  const theme = useTheme();
  const t = useT();

  const history: string[] = [];
  if (pupil.absencesThisYear > 0) {
    history.push(interpolate(t.lesson.absencesShort, { count: pupil.absencesThisYear }));
  }
  if (pupil.latesThisYear > 0) {
    history.push(interpolate(t.lesson.latesShort, { count: pupil.latesThisYear }));
  }

  return (
    <Card>
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
            {pupil.lastName} {pupil.firstName}
          </Heading>
          {/* Their running totals, because a teacher deciding whether this
              retard matters needs to know it is the child's fourth — and they
              will not go and look it up. */}
          <Body muted>
            {history.length > 0 ? history.join(" · ") : pupil.studentCode}
          </Body>
        </View>

        <Badge
          tone={
            pupil.status === null
              ? "default"
              : pupil.status === "PRESENT"
                ? "success"
                : pupil.status === "ABSENT"
                  ? "danger"
                  : "warning"
          }
        >
          {pupil.status === null
            ? t.lesson.toMark
            : pupil.status === "LATE" && pupil.minutesLate
              ? interpolate(t.lesson.lateByMinutes, { count: pupil.minutesLate })
              : label(t.labels.attendance, pupil.status)}
        </Badge>
      </View>

      {canMark ? (
        <>
          <Divider />
          {/* Three, not four: présent, retard, absent is the whole appel.
              Excusé is the office's word for an absence it has accepted, so it
              sits below rather than competing for a thumb. */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["PRESENT", "LATE", "ABSENT"] as const).map((status) => (
              <MarkButton
                key={status}
                label={label(t.labels.attendance, status)}
                selected={pupil.status === status}
                busy={busy}
                tone={
                  status === "PRESENT"
                    ? "success"
                    : status === "ABSENT"
                      ? "danger"
                      : "warning"
                }
                onPress={() => onMark(pupil.enrollmentId, status)}
              />
            ))}
          </View>

          {/* Only once the retard is recorded: asking "how late?" before
              anybody has said they were late is a question about nothing. */}
          {pupil.status === "LATE" ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: spacing.sm,
                marginTop: spacing.sm,
              }}
            >
              <Caption>{t.lesson.howLate}</Caption>
              {LATE_PRESETS.map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() =>
                    onMark(pupil.enrollmentId, "LATE", minutes)
                  }
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                    borderRadius: radius.lg,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor:
                      pupil.minutesLate === minutes
                        ? theme.warning
                        : theme.border,
                    backgroundColor:
                      pupil.minutesLate === minutes
                        ? `${theme.warning}1a`
                        : "transparent",
                    opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      color:
                        pupil.minutesLate === minutes
                          ? theme.warning
                          : theme.muted,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {interpolate(t.lesson.minutes, { count: minutes })}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {pupil.status === "ABSENT" || pupil.status === "EXCUSED" ? (
            <Pressable
              onPress={() =>
                onMark(
                  pupil.enrollmentId,
                  pupil.status === "EXCUSED" ? "ABSENT" : "EXCUSED",
                )
              }
              disabled={busy}
              accessibilityRole="button"
              style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {pupil.status === "EXCUSED"
                  ? t.lesson.removeExcuse
                  : t.lesson.markExcused}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {pupil.isJustified ? (
        <>
          <Divider />
          <Caption>{t.lesson.justifiedByOffice}</Caption>
        </>
      ) : null}
    </Card>
  );
}

/** A tally under the progress bar. Smaller than `Stat` — four fit on a row. */
function Count({
  label: text,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  const theme = useTheme();
  const color =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : tone === "danger"
          ? theme.danger
          : theme.text;

  return (
    <View style={{ minWidth: 64, gap: 2 }}>
      <Text style={{ color, fontSize: 18, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 11 }}>{text}</Text>
    </View>
  );
}

/**
 * One of the three marks, as a segment.
 *
 * Deliberately not `Button`: these sit three to a row under every name and are
 * pressed thirty times an hour, so they are sized for a thumb and show which
 * one is set rather than which one is primary. The colour is the status's own,
 * so a sheet of green with two red rows reads at a glance.
 */
function MarkButton({
  label: text,
  selected,
  busy,
  tone,
  onPress,
}: {
  label: string;
  selected: boolean;
  busy: boolean;
  tone: "success" | "warning" | "danger";
  onPress: () => void;
}) {
  const theme = useTheme();
  const color =
    tone === "success"
      ? theme.success
      : tone === "warning"
        ? theme.warning
        : theme.danger;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: 13,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? color : theme.border,
        backgroundColor: selected ? color : "transparent",
        opacity: busy ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.primaryText : theme.text,
          fontSize: 13,
          fontWeight: selected ? "700" : "600",
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/** "Tous" / "À pointer". Two options, so `FilterChips` would draw nothing. */
function Toggle({
  label: text,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: 9,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? `${theme.primary}1a` : theme.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.primary : theme.muted,
          fontSize: 13,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
