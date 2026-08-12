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

import { appreciationFor } from "../../src/api/appreciation";
import {
  useMarkSheet,
  useSaveMark,
  useSetAssessmentStatus,
} from "../../src/api/hooks";
import type { AppreciationBand } from "../../src/api/types";
import { interpolate, useT } from "../../src/i18n";
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
  const t = useT();
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
    comment: string | null,
  ) {
    save.mutate(
      { enrollmentId, score, isAbsent, comment },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            Alert.alert(
              t.markSheet.markRefusedTitle,
              result.reason === "out-of-range"
                ? interpolate(t.markSheet.outOfRange, { max: paper?.maxScore ?? 20 })
                : t.markSheet.noMoreMarks,
            );
          }
        },
        onError: () =>
          Alert.alert(t.markSheet.markRefusedTitle, t.markSheet.markSaveFailed),
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
              t.markSheet.handInRefusedTitle,
              result.reason === "incomplete"
                ? t.markSheet.incomplete
                : t.markSheet.handInFailed,
            );
          }
        },
        onError: () =>
          Alert.alert(t.markSheet.handInRefusedTitle, t.markSheet.handInFailed),
      });

    if (left === 0) {
      send();
      return;
    }

    Alert.alert(
      t.markSheet.confirmHandInTitle,
      interpolate(t.markSheet.confirmHandInBody, { count: left }),
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.markSheet.handInConfirm, onPress: send },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: paper?.title ?? t.markSheet.defaultTitle,
        }}
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
          <ErrorNote message={t.markSheet.loadError} />
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
                  label={interpolate(t.markSheet.averageOf, { max: paper.maxScore })}
                />
                <Stat
                  value={data.statistics.pendingCount}
                  label={t.markSheet.toMark}
                  tone={
                    data.statistics.pendingCount > 0 ? "warning" : "success"
                  }
                />
                <Stat value={data.statistics.absentCount} label={t.markSheet.absent} />
                <Stat
                  value={
                    data.statistics.passRate === null
                      ? "—"
                      : `${data.statistics.passRate}%`
                  }
                  label={t.markSheet.passRate}
                />
              </View>

              {data.statistics.absentCount > 0 ? (
                <>
                  <Divider />
                  {/* Absences are excluded from the mean rather than averaged
                      as zero — a pupil who was not there has not demonstrated
                      a zero. Said out loud so the figure is not mistrusted. */}
                  <Caption>{t.markSheet.absentExcludedNote}</Caption>
                </>
              ) : null}
            </Card>

            {/* Nobody validates a devoir: the teacher sets it, marks it and is
                done. So the hand-in pair is not offered on one, which would
                otherwise be a button whose other half nobody can press. */}
            {!data.isDevoir && paper.status === "PUBLISHED" ? (
              <Button
                label={t.markSheet.handIn}
                onPress={handIn}
                busy={move.isPending}
              />
            ) : null}

            {!data.isDevoir && paper.status === "SUBMITTED" ? (
              <Card>
                <Heading>{t.markSheet.handedInTitle}</Heading>
                <Caption>{t.markSheet.handedInNote}</Caption>
                <Divider />
                <Button
                  label={t.markSheet.resumeCorrection}
                  variant="ghost"
                  onPress={() => move.mutate("PUBLISHED")}
                  busy={move.isPending}
                />
              </Card>
            ) : null}

            <Heading>{t.markSheet.papers}</Heading>

            {data.rows.length === 0 ? (
              <Empty message={t.markSheet.noStudents} />
            ) : (
              data.rows.map((row) => (
                <PupilMark
                  key={row.enrollmentId}
                  row={row}
                  maxScore={paper.maxScore}
                  bands={data.appreciationBands}
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
 * One pupil's mark and the appréciation beside it.
 *
 * Holds its own text while it is being typed and reports on blur — see the note
 * on the screen. The value is re-seeded from the server whenever the row's own
 * score changes, so a refusal snaps the box back to what is actually stored
 * rather than leaving a number on screen that was never saved.
 *
 * ── The appréciation fills itself in ────────────────────────────────────────
 * Entering a mark writes the rung the school's scale puts it on — "Très bien" —
 * into the remark box, and only over a box the teacher has not written in
 * themselves: an empty one, or one still holding a suggestion from a previous
 * mark. Their own wording is never overwritten, which is what makes filling it
 * in safe to do without asking. The scale itself is the school's, edited on the
 * web under Contrôles → Appréciations.
 */
function PupilMark({
  row,
  maxScore,
  bands,
  onCommit,
}: {
  row: {
    enrollmentId: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    score: number | null;
    isAbsent: boolean;
    comment: string | null;
  };
  maxScore: number;
  bands: AppreciationBand[];
  onCommit: (
    enrollmentId: string,
    score: number | null,
    isAbsent: boolean,
    comment: string | null,
  ) => void;
}) {
  const theme = useTheme();
  const t = useT();

  const stored = row.score === null ? "" : String(row.score);
  const [draft, setDraft] = useState(stored);
  const [lastStored, setLastStored] = useState(stored);

  const storedComment = row.comment ?? "";
  const [commentDraft, setCommentDraft] = useState(storedComment);
  const [lastComment, setLastComment] = useState(storedComment);

  // Re-seed when the server's value moves under us, without clobbering what is
  // being typed right now.
  if (stored !== lastStored) {
    setLastStored(stored);
    setDraft(stored);
  }
  if (storedComment !== lastComment) {
    setLastComment(storedComment);
    setCommentDraft(storedComment);
  }

  /** Whether the box still holds a suggestion rather than the teacher's words. */
  function isSuggestion(text: string): boolean {
    const trimmed = text.trim();
    return trimmed === "" || bands.some((band) => band.label === trimmed);
  }

  /**
   * The remark to store alongside a mark: the scale's rung when the box is
   * still a suggestion, and whatever the teacher wrote when it is not.
   */
  function remarkFor(score: number | null): string | null {
    if (!isSuggestion(commentDraft)) return commentDraft.trim() || null;
    return appreciationFor(score, maxScore, bands)?.label ?? null;
  }

  function blur() {
    const trimmed = draft.trim().replace(",", ".");
    if (trimmed === "") {
      if (row.score !== null) {
        const remark = remarkFor(null);
        setCommentDraft(remark ?? "");
        onCommit(row.enrollmentId, null, row.isAbsent, remark);
      }
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(stored);
      return;
    }

    const remark = remarkFor(parsed);
    if (parsed === row.score && remark === (row.comment ?? null)) return;
    setCommentDraft(remark ?? "");

    // Entering a mark means the pupil sat the paper, so it clears an absence
    // rather than leaving the two contradicting each other.
    onCommit(row.enrollmentId, parsed, false, remark);
  }

  /** The remark on its own, when the teacher rewords what was suggested. */
  function blurComment() {
    const trimmed = commentDraft.trim();
    if (trimmed === (row.comment ?? "")) return;
    onCommit(row.enrollmentId, row.score, row.isAbsent, trimmed || null);
  }

  function toggleAbsent() {
    const next = !row.isAbsent;
    // An absence is not a zero — the score goes, it does not become one. The
    // suggested remark goes with it, since it described a mark that is gone;
    // a remark the teacher wrote themselves stays.
    const remark = next ? (isSuggestion(commentDraft) ? null : commentDraft.trim() || null) : remarkFor(row.score);
    setCommentDraft(remark ?? "");
    onCommit(row.enrollmentId, next ? null : row.score, next, remark);
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
          <Badge tone="danger">{t.labels.attendance.ABSENT}</Badge>
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

      {/* The appréciation. Shown even for an absent pupil: "absent justifié,
          rattrapage prévu" is exactly the sort of thing that goes here. */}
      <TextInput
        value={commentDraft}
        onChangeText={setCommentDraft}
        onBlur={blurComment}
        placeholder={t.markSheet.appreciationPlaceholder}
        placeholderTextColor={theme.muted}
        maxLength={500}
        style={{
          color: theme.text,
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          fontSize: 15,
        }}
      />

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
          {row.isAbsent ? t.markSheet.markPresent : t.markSheet.absentAtExam}
        </Text>
      </Pressable>
    </Card>
  );
}
