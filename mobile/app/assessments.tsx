import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAssessments } from "../src/api/hooks";
import { interpolate, useFormat, useT } from "../src/i18n";
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
} from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

type Kind = "ALL" | "CONTROLE" | "DEVOIR";

/**
 * What this teacher still has to mark.
 *
 * The list is the server's "mine, and not finished" — PUBLISHED or SUBMITTED,
 * scoped to their own papers — so there is nothing to filter out here. The
 * three tabs only narrow it further: contrôles are the school's rounds, devoirs
 * are what the teacher set themselves, and the split is the school's own
 * `allowTeacherCreate` rather than a guess made on the phone.
 */
export default function AssessmentsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const fmt = useFormat();
  const [kind, setKind] = useState<Kind>("ALL");

  const assessments = useAssessments(kind === "ALL" ? undefined : kind);
  const rows = assessments.data ?? [];

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.assessmentsList.title }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["ALL", "CONTROLE", "DEVOIR"] as const).map((value) => (
            <Tab
              key={value}
              label={
                value === "ALL"
                  ? t.assessmentsList.tabAll
                  : value === "CONTROLE"
                    ? t.assessmentsList.tabControle
                    : t.assessmentsList.tabDevoir
              }
              selected={kind === value}
              onPress={() => setKind(value)}
            />
          ))}
        </View>

        <Button
          label={t.assessmentsList.newAssessment}
          variant="ghost"
          onPress={() => router.push("/assessments/new")}
        />

        {assessments.isPending ? <Loading /> : null}
        {assessments.isError ? (
          <ErrorNote message={t.assessmentsList.loadError} />
        ) : null}

        {assessments.data && rows.length === 0 ? (
          <Empty message={t.assessmentsList.nothingToMark} />
        ) : null}

        {rows.map((paper) => {
          // Everybody accounted for — a mark or an absence against each name.
          const done = paper.markedCount + paper.absentCount;
          const left = Math.max(0, paper.rosterCount - done);

          return (
            <Pressable
              key={paper.id}
              onPress={() =>
                router.push({
                  pathname: "/assessments/[assessmentId]",
                  params: { assessmentId: paper.id },
                })
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
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
                    <Heading>{paper.title}</Heading>
                    <Body muted>
                      {paper.subjectName} · {paper.classCode}
                      {paper.groupLabel ? ` (${paper.groupLabel})` : ""}
                    </Body>
                    <Caption>
                      {paper.typeName}
                      {paper.scheduledOn
                        ? ` · ${fmt.shortDate(paper.scheduledOn)}`
                        : ""}
                      {` · /${paper.maxScore}`}
                    </Caption>
                  </View>

                  <Badge
                    tone={
                      left === 0
                        ? "success"
                        : done === 0
                          ? "danger"
                          : "warning"
                    }
                  >
                    {left === 0
                      ? t.assessmentsList.corrected
                      : interpolate(t.assessmentsList.toCorrect, { count: left })}
                  </Badge>
                </View>

                <Divider />

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Caption>
                    {interpolate(t.assessmentsList.studentsMarked, {
                      done,
                      total: paper.rosterCount,
                    })}
                  </Caption>
                  <Caption>
                    {paper.average === null
                      ? t.assessmentsList.noAverage
                      : interpolate(t.assessmentsList.average, {
                          average: paper.average,
                          max: paper.maxScore,
                        })}
                  </Caption>
                </View>

                {paper.status === "SUBMITTED" ? (
                  <Caption>{t.assessmentsList.submittedNote}</Caption>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

function Tab({
  label,
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
        {label}
      </Text>
    </Pressable>
  );
}
