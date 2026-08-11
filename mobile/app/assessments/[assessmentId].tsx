import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useMarkSheet,
  useSaveMark,
  useSetAssessmentStatus,
} from "../../src/api/hooks";
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
 * Correcting one paper.
 *
 * ── Why a box per pupil rather than one big form ─────────────────────────────
 * Each mark is posted the moment it is entered, exactly as the register posts
 * each pupil: marking thirty copies takes twenty minutes, often with the phone
 * locking in between, and a form that only saves at the end is a form that
 * loses an evening's work when it does. It also means the class average under
 * the sheet is the server's, recomputed on every entry, rather than a figure
 * the phone guessed at.
 *
 * A mark is committed on blur rather than per keystroke — typing "1" on the way
 * to "14" must not be written, and worse, must not be refused as out of range
 * when the paper is out of 10.
 */
export default function MarkSheetScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();

  const sheet = useMarkSheet(assessmentId);
  const save = useSaveMark(assessmentId);
  const move = useSetAssessmentStatus(assessmentId);

  const data = sheet.data;
  const paper = data?.assessment;

  function commit(
    enrollmentId: string,
    score: number | null,
    isAbsent: boolean,
  ) {
    save.mutate(
      { enrollmentId, score, isAbsent },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            Alert.alert(
              "Note refusée",
              result.reason === "out-of-range"
                ? `La note doit être comprise entre 0 et ${paper?.maxScore ?? 20}.`
                : "Cette copie n'accepte plus de notes.",
            );
          }
        },
        onError: () =>
          Alert.alert("Note refusée", "La note n'a pas pu être enregistrée."),
      },
    );
  }

  function handIn() {
    if (!data) return;
    const left = data.statistics.pendingCount;

    const send = () =>
      move.mutate("SUBMITTED", {
        onSuccess: (result) => {
          if (!result.ok) {
            Alert.alert(
              "Remise refusée",
              result.reason === "incomplete"
                ? "Toutes les copies ne sont pas encore notées."
                : "La copie n'a pas pu être rendue.",
            );
          }
        },
        onError: () =>
          Alert.alert("Remise refusée", "La copie n'a pas pu être rendue."),
      });

    if (left === 0) {
      send();
      return;
    }

    Alert.alert(
      "Rendre la correction ?",
      `${left} élève${left > 1 ? "s" : ""} sans note. Vous pourrez encore corriger après la remise.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Rendre", onPress: send },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: paper?.title ?? "Correction" }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {sheet.isPending ? <Loading /> : null}
        {sheet.isError ? (
          <ErrorNote message="Impossible de charger la copie." />
        ) : null}

        {data && paper ? (
          <>
            <View style={{ gap: 2 }}>
              <Title>{paper.title}</Title>
              <Caption>
                {paper.subjectName} · {paper.classCode}
                {paper.groupLabel ? ` (${paper.groupLabel})` : ""} ·{" "}
                {paper.termName}
              </Caption>
              {paper.notes ? <Body muted>{paper.notes}</Body> : null}
            </View>

            <Card>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <Stat
                  value={
                    data.statistics.average === null
                      ? "—"
                      : `${data.statistics.average}`
                  }
                  label={`Moyenne / ${paper.maxScore}`}
                />
                <Stat
                  value={data.statistics.pendingCount}
                  label="À noter"
                  tone={
                    data.statistics.pendingCount > 0 ? "warning" : "success"
                  }
                />
                <Stat value={data.statistics.absentCount} label="Absents" />
                <Stat
                  value={
                    data.statistics.passRate === null
                      ? "—"
                      : `${data.statistics.passRate}%`
                  }
                  label="Réussite"
                />
              </View>

              {data.statistics.absentCount > 0 ? (
                <>
                  <Divider />
                  {/* Absences are excluded from the mean rather than averaged
                      as zero — a pupil who was not there has not demonstrated
                      a zero. Said out loud so the figure is not mistrusted. */}
                  <Caption>
                    Les absents ne comptent pas dans la moyenne.
                  </Caption>
                </>
              ) : null}
            </Card>

            {/* Nobody validates a devoir: the teacher sets it, marks it and is
                done. So the hand-in pair is not offered on one, which would
                otherwise be a button whose other half nobody can press. */}
            {!data.isDevoir && paper.status === "PUBLISHED" ? (
              <Button
                label="Rendre la correction"
                onPress={handIn}
                busy={move.isPending}
              />
            ) : null}

            {!data.isDevoir && paper.status === "SUBMITTED" ? (
              <Card>
                <Heading>Correction rendue</Heading>
                <Caption>
                  En attente de validation par l&apos;administration. Vous
                  pouvez encore corriger une note.
                </Caption>
                <Divider />
                <Button
                  label="Reprendre la correction"
                  variant="ghost"
                  onPress={() => move.mutate("PUBLISHED")}
                  busy={move.isPending}
                />
              </Card>
            ) : null}

            <Heading>Copies</Heading>

            {data.rows.length === 0 ? (
              <Empty message="Aucun élève sur cette copie." />
            ) : (
              data.rows.map((row) => (
                <PupilMark
                  key={row.enrollmentId}
                  row={row}
                  maxScore={paper.maxScore}
                  onCommit={commit}
                />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/**
 * One pupil's mark.
 *
 * Holds its own text while it is being typed and reports on blur — see the note
 * on the screen. The value is re-seeded from the server whenever the row's own
 * score changes, so a refusal snaps the box back to what is actually stored
 * rather than leaving a number on screen that was never saved.
 */
function PupilMark({
  row,
  maxScore,
  onCommit,
}: {
  row: {
    enrollmentId: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    score: number | null;
    isAbsent: boolean;
  };
  maxScore: number;
  onCommit: (
    enrollmentId: string,
    score: number | null,
    isAbsent: boolean,
  ) => void;
}) {
  const theme = useTheme();

  const stored = row.score === null ? "" : String(row.score);
  const [draft, setDraft] = useState(stored);
  const [lastStored, setLastStored] = useState(stored);

  // Re-seed when the server's value moves under us, without clobbering what is
  // being typed right now.
  if (stored !== lastStored) {
    setLastStored(stored);
    setDraft(stored);
  }

  function blur() {
    const trimmed = draft.trim().replace(",", ".");
    if (trimmed === "") {
      if (row.score !== null) onCommit(row.enrollmentId, null, row.isAbsent);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(stored);
      return;
    }
    if (parsed === row.score) return;

    // Entering a mark means the pupil sat the paper, so it clears an absence
    // rather than leaving the two contradicting each other.
    onCommit(row.enrollmentId, parsed, false);
  }

  function toggleAbsent() {
    const next = !row.isAbsent;
    // An absence is not a zero — the score goes, it does not become one.
    onCommit(row.enrollmentId, next ? null : row.score, next);
  }

  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View style={{ flexShrink: 1, flexGrow: 1, gap: 2 }}>
          <Heading>
            {row.lastName} {row.firstName}
          </Heading>
          <Caption>{row.studentCode}</Caption>
        </View>

        {row.isAbsent ? (
          <Badge tone="danger">Absent</Badge>
        ) : (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onBlur={blur}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder="—"
              placeholderTextColor={theme.muted}
              selectTextOnFocus
              style={{
                width: 64,
                textAlign: "center",
                color: theme.text,
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: radius.sm,
                paddingVertical: 10,
                fontSize: 17,
                fontWeight: "700",
              }}
            />
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              / {maxScore}
            </Text>
          </View>
        )}
      </View>

      <Divider />

      <Pressable
        onPress={toggleAbsent}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: row.isAbsent ? theme.danger : theme.border,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: row.isAbsent ? theme.danger : theme.muted,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {row.isAbsent ? "Marquer présent" : "Absent à l'épreuve"}
        </Text>
      </Pressable>
    </Card>
  );
}
