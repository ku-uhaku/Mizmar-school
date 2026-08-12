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

import {
  useChildren,
  useFileRequest,
  useRequestTypes,
} from "../../src/api/hooks";
import { interpolate, useT } from "../../src/i18n";
import {
  Body,
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

/** Mirrors `MAX_COPIES` in modules/requests/enums.ts. */
const MAX_COPIES = 10;
/** Mirrors `REASON_MAX`. */
const REASON_MAX = 500;

/**
 * Asking the school for a paper.
 *
 * ── The child comes first, and it decides the rest ──────────────────────────
 * Every paper a school issues names one child, and the catalogue belongs to a
 * school — a parent with children in two schools of the same groupe has two
 * different lists. So the child is chosen first and the list of papers is
 * fetched for that child, rather than one merged list that would offer a paper
 * the wrong school writes. A parent of one never sees the choice: it is made
 * for them.
 *
 * ── Why the reason is sometimes required ────────────────────────────────────
 * Some papers cannot be written blind — an attestation destined for a consulate
 * is worded differently from one for a bank, and a certificat de radiation ends
 * an inscription. The catalogue says which (`requiresReason`), the form asks for
 * it, and the server refuses without it.
 */
export default function NewRequestScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const children = useChildren();
  const file = useFileRequest();

  const only = children.data?.length === 1 ? children.data[0] : undefined;
  const [studentId, setStudentId] = useState(only?.studentId ?? "");
  const [typeId, setTypeId] = useState("");
  const [copies, setCopies] = useState("1");
  const [reason, setReason] = useState("");

  // Chosen for a parent of one, who has no choice to make. Re-seeded rather
  // than defaulted in state, because the list arrives after the first render.
  if (only && studentId === "") setStudentId(only.studentId);

  const types = useRequestTypes(studentId);
  const chosen = types.data?.find((type) => type.id === typeId);
  const needsReason = chosen?.requiresReason ?? false;

  const parsedCopies = Number(copies);
  const canSubmit =
    studentId !== "" &&
    typeId !== "" &&
    Number.isInteger(parsedCopies) &&
    parsedCopies >= 1 &&
    parsedCopies <= MAX_COPIES &&
    (!needsReason || reason.trim() !== "");

  function submit() {
    file.mutate(
      {
        studentId,
        typeId,
        copies: parsedCopies,
        reason: reason.trim() || null,
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            // Back to the list, where the new request is at the top with its
            // status on it — which is the confirmation, rather than a toast
            // that says the same thing and then disappears.
            router.replace("/requests");
            return;
          }

          Alert.alert(
            t.requests.refusedTitle,
            result.reason === "duplicate"
              ? t.requests.refusedDuplicate
              : result.reason === "reason-required"
                ? t.requests.refusedReason
                : t.requests.refusedUnknown,
          );
        },
        onError: () =>
          Alert.alert(t.requests.refusedTitle, t.requests.saveFailed),
      },
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.requests.newRequest }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children.isPending ? <Loading /> : null}
        {children.isError ? <ErrorNote message={t.requests.loadError} /> : null}

        {children.data && children.data.length > 1 ? (
          <Card>
            <Heading>{t.requests.forWhom}</Heading>
            <View style={{ gap: spacing.sm }}>
              {children.data.map((child) => (
                <Choice
                  key={child.studentId}
                  label={child.fullName}
                  hint={child.className ?? child.levelName ?? undefined}
                  selected={child.studentId === studentId}
                  onPress={() => {
                    setStudentId(child.studentId);
                    // The catalogue is the school's, so switching child can
                    // switch the list out from under the choice.
                    setTypeId("");
                  }}
                />
              ))}
            </View>
          </Card>
        ) : null}

        {studentId !== "" ? (
          <Card>
            <Heading>{t.requests.whichDocument}</Heading>

            {types.isPending ? <Loading /> : null}
            {types.data && types.data.length === 0 ? (
              <Empty message={t.requests.noTypes} />
            ) : null}

            <View style={{ gap: spacing.sm }}>
              {types.data?.map((type) => (
                <Choice
                  key={type.id}
                  label={type.name}
                  hint={
                    type.description ??
                    (type.usualDelayDays === null
                      ? undefined
                      : delayHint(t, type.usualDelayDays))
                  }
                  selected={type.id === typeId}
                  onPress={() => setTypeId(type.id)}
                />
              ))}
            </View>

            {chosen?.usualDelayDays !== null &&
            chosen?.usualDelayDays !== undefined ? (
              <>
                <Divider />
                <Caption>{delayHint(t, chosen.usualDelayDays)}</Caption>
              </>
            ) : null}
          </Card>
        ) : null}

        {typeId !== "" ? (
          <Card>
            <Heading>{t.requests.copies}</Heading>
            <TextInput
              value={copies}
              onChangeText={setCopies}
              keyboardType="number-pad"
              style={boxStyle(theme)}
            />

            <Divider />

            <Heading>
              {needsReason ? t.requests.reasonRequired : t.requests.reason}
            </Heading>
            <Body muted>{t.requests.reasonHint}</Body>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={REASON_MAX}
              placeholder={t.requests.reasonPlaceholder}
              placeholderTextColor={theme.muted}
              style={{ ...boxStyle(theme), minHeight: 96, textAlignVertical: "top" }}
            />
          </Card>
        ) : null}

        <Button
          label={t.requests.send}
          onPress={submit}
          disabled={!canSubmit}
          busy={file.isPending}
        />
      </ScrollView>
    </>
  );
}

/** "Usually 3 days", or the singular the plural would read wrongly as. */
function delayHint(
  t: { requests: { usualDelay: string; usualDelayOne: string } },
  days: number,
): string {
  return days <= 1
    ? t.requests.usualDelayOne
    : interpolate(t.requests.usualDelay, { count: days });
}

function boxStyle(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.text,
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  } as const;
}

/** One tappable option. A radio in everything but name. */
function Choice({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        borderColor: selected ? theme.primary : theme.border,
        borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        opacity: pressed ? 0.85 : 1,
        gap: 2,
      })}
    >
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
        {label}
      </Text>
      {hint ? (
        <Text style={{ color: theme.muted, fontSize: 13 }}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}
