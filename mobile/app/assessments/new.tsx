import { Stack, router } from "expo-router";
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

import { useAssessmentOptions, useCreateAssessment } from "../../src/api/hooks";
import { gradingDefaults } from "../../src/api/grading";
import { interpolate, isoDay, useT } from "../../src/i18n";
import {
  Button,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorNote,
  Heading,
  Loading,
} from "../../src/ui/components";
import { radius, spacing, useTheme } from "../../src/ui/theme";

/**
 * Setting a piece of work from the phone.
 *
 * The class and the subject are chosen as one — a teaching slot — because that
 * is the pair the server re-derives against the teacher's own assignments, and
 * offering them as two independent pickers would let somebody build a
 * combination they do not teach and only find out on submit.
 *
 * Which *kinds* appear is the school's policy, not this screen's: the options
 * endpoint returns only the types marked `allowTeacherCreate`. A school that
 * lets its teachers set contrôles will see them here; one that reserves them
 * for the office will not.
 *
 * No barème editor — a paper's questions are typed at a desk, and it can gain
 * them later on the web without the mark sheet needing them.
 */
export default function NewAssessmentScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const options = useAssessmentOptions();
  const create = useCreateAssessment();

  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [typeId, setTypeId] = useState("");
  const [termId, setTermId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [maxScore, setMaxScore] = useState("20");
  const [coefficient, setCoefficient] = useState("1");

  const data = options.data;
  const slot = slotIndex === null ? null : (data?.teaching[slotIndex] ?? null);

  // Seeded from the niveau's own barème for the chosen kind — see
  // `gradingDefaults` — or the kind's own defaults when the slot has none, so
  // a school marking its devoirs out of 10 in the primaire does not have to
  // retype it every time.
  function chooseType(id: string) {
    setTypeId(id);
    const type = data?.types.find((candidate) => candidate.id === id);
    if (type) {
      const scale = gradingDefaults(
        data?.gradingRules ?? [],
        { assessmentTypeId: id, levelId: slot?.levelId ?? null, subjectId: slot?.subjectId ?? null },
        type,
      );
      setMaxScore(String(scale.maxScore));
      setCoefficient(String(scale.coefficient));
    }
  }

  const parsedMax = Number(maxScore);
  const parsedCoefficient = Number(coefficient);
  const canSave =
    slot !== null &&
    typeId !== "" &&
    termId !== "" &&
    title.trim().length > 0 &&
    Number.isInteger(parsedMax) &&
    parsedMax >= 1 &&
    parsedMax <= 100 &&
    Number.isInteger(parsedCoefficient) &&
    parsedCoefficient >= 1 &&
    parsedCoefficient <= 20;

  function submit() {
    if (!canSave || !slot || create.isPending) return;

    create.mutate(
      {
        schoolClassId: slot.schoolClassId,
        subjectId: slot.subjectId,
        termId,
        assessmentTypeId: typeId,
        title: title.trim(),
        notes: notes.trim() || null,
        scheduledOn: isoDay(new Date()),
        maxScore: parsedMax,
        coefficient: parsedCoefficient,
      },
      {
        onSuccess: (result) => {
          if (result.ok && result.assessmentId) {
            // Straight onto the mark sheet: a devoir is created PUBLISHED, so
            // there is nothing else to press before marking it.
            router.replace({
              pathname: "/assessments/[assessmentId]",
              params: { assessmentId: result.assessmentId },
            });
            return;
          }

          Alert.alert(
            t.newAssessment.creationRefusedTitle,
            result.reason === "not-teaching"
              ? t.newAssessment.notTeaching
              : result.reason === "term-closed"
                ? t.newAssessment.termClosedError
                : result.reason === "kind-not-allowed"
                  ? t.newAssessment.kindNotAllowed
                  : t.newAssessment.creationFailed,
          );
        },
        onError: () =>
          Alert.alert(
            t.newAssessment.creationRefusedTitle,
            t.newAssessment.creationFailed,
          ),
      },
    );
  }

  const boxStyle = {
    color: theme.text,
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    marginTop: spacing.sm,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.newAssessment.title }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {options.isPending ? <Loading /> : null}
        {options.isError ? (
          <ErrorNote message={t.newAssessment.loadError} />
        ) : null}

        {data && data.teaching.length === 0 ? (
          <Empty message={t.newAssessment.noClasses} />
        ) : null}

        {data && data.types.length === 0 ? (
          <Empty message={t.newAssessment.noTypes} />
        ) : null}

        {data && data.teaching.length > 0 && data.types.length > 0 ? (
          <>
            <Card>
              <Heading>{t.newAssessment.classAndSubject}</Heading>
              <Divider />
              <View style={{ gap: spacing.sm }}>
                {data.teaching.map((option, index) => (
                  <Choice
                    key={option.assignmentId}
                    label={`${option.classCode}${option.groupLabel ? ` (${option.groupLabel})` : ""} · ${option.subjectName}`}
                    selected={slotIndex === index}
                    onPress={() => setSlotIndex(index)}
                  />
                ))}
              </View>
            </Card>

            <Card>
              <Heading>{t.newAssessment.type}</Heading>
              <Divider />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {data.types.map((type) => (
                  <Chip
                    key={type.id}
                    label={type.name}
                    selected={typeId === type.id}
                    onPress={() => chooseType(type.id)}
                  />
                ))}
              </View>

              <Divider />
              <Heading>{t.newAssessment.term}</Heading>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {data.terms.map((term) => (
                  <Chip
                    key={term.id}
                    label={
                      term.status === "CLOSED"
                        ? interpolate(t.newAssessment.termClosed, { name: term.name })
                        : term.name
                    }
                    selected={termId === term.id}
                    onPress={() => setTermId(term.id)}
                  />
                ))}
              </View>
            </Card>

            <Card>
              <Heading>{t.newAssessment.titleLabel}</Heading>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t.newAssessment.titlePlaceholder}
                placeholderTextColor={theme.muted}
                maxLength={160}
                style={boxStyle}
              />

              <Caption>{t.newAssessment.notesLabel}</Caption>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t.newAssessment.notesPlaceholder}
                placeholderTextColor={theme.muted}
                multiline
                maxLength={500}
                style={{ ...boxStyle, minHeight: 70, textAlignVertical: "top" }}
              />
            </Card>

            <Card>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Heading>{t.newAssessment.maxScore}</Heading>
                  <TextInput
                    value={maxScore}
                    onChangeText={setMaxScore}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={boxStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Heading>{t.newAssessment.coefficient}</Heading>
                  <TextInput
                    value={coefficient}
                    onChangeText={setCoefficient}
                    keyboardType="number-pad"
                    maxLength={2}
                    style={boxStyle}
                  />
                </View>
              </View>
            </Card>

            <Button
              label={t.newAssessment.submit}
              onPress={submit}
              disabled={!canSave}
              busy={create.isPending}
            />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/** A full-width row — class and subject names are long. */
function Choice({
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
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? `${theme.primary}1a` : "transparent",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.primary : theme.text,
          fontSize: 14,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm - 2,
        borderRadius: radius.lg,
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
