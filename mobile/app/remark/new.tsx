import { Stack, router, useLocalSearchParams } from "expo-router";
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

import { useMyPupils, useSaveRemark } from "../../src/api/hooks";
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
import {
  REMARK_KIND_LABELS,
  REMARK_TONE_LABELS,
  isoDay,
} from "../../src/ui/format";
import { radius, spacing, useTheme } from "../../src/ui/theme";

/** Mirrors `REMARK_MAX_LENGTH` in modules/classroom/enums.ts. */
const MAX_LENGTH = 1000;

/** Lowercased and stripped of accents, so "Belaid" matches "Belaïd". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const KINDS = ["BEHAVIOUR", "WORK", "PROGRESS", "ATTENDANCE", "OTHER"] as const;
const TONES = ["POSITIVE", "NEUTRAL", "CONCERN"] as const;

/**
 * Writing an observation about a pupil, from the phone.
 *
 * The remark is always internal: releasing one to the family is a separate
 * grant and an office decision, so the composer does not offer it at all
 * rather than showing a toggle that would be quietly ignored. See the note on
 * the route in app/api/mobile/v1/teacher/remarks.
 *
 * `enrollmentId` may arrive as a param — from a pupil's row on the register —
 * in which case the picker opens on that child instead of asking again.
 */
export default function NewRemarkScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ enrollmentId?: string }>();

  const pupils = useMyPupils();
  const save = useSaveRemark();

  const [enrollmentId, setEnrollmentId] = useState(params.enrollmentId ?? "");
  const [kind, setKind] = useState<string>("BEHAVIOUR");
  const [tone, setTone] = useState<string>("NEUTRAL");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");

  /*
    A teacher of six classes reaches seventy-odd pupils, which is a lot of
    scrolling to find one name. Filtered here rather than on the server: the
    whole list is already in hand, and a round trip per keystroke would make
    the box lag behind the typing on a school's wifi.

    Accents are folded away so "Belaid" finds "Belaïd" — a teacher types the
    name, not the diacritic.
  */
  const needle = fold(search);
  const shown = (pupils.data ?? []).filter((pupil) => {
    if (needle === "") return true;
    // The chosen pupil stays visible whatever is typed, so the selection can
    // never be hidden by a search that no longer matches it.
    if (pupil.enrollmentId === enrollmentId) return true;
    return fold(`${pupil.label} ${pupil.classCode}`).includes(needle);
  });

  const trimmed = body.trim();
  const canSave =
    enrollmentId.length > 0 &&
    trimmed.length >= 3 &&
    trimmed.length <= MAX_LENGTH;

  function submit() {
    if (!canSave || save.isPending) return;

    save.mutate(
      {
        enrollmentId,
        subjectId: null,
        kind,
        tone,
        body: trimmed,
        occurredOn: isoDay(new Date()),
      },
      {
        onSuccess: () => router.back(),
        onError: () =>
          Alert.alert(
            "Remarque refusée",
            "La remarque n'a pas pu être enregistrée.",
          ),
      },
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: "Nouvelle remarque" }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {pupils.isPending ? <Loading /> : null}
        {pupils.isError ? (
          <ErrorNote message="Impossible de charger vos élèves." />
        ) : null}

        {pupils.data?.length === 0 ? (
          <Empty message="Vous n'avez aucun élève cette année." />
        ) : null}

        {pupils.data && pupils.data.length > 0 ? (
          <>
            <Card>
              <Heading>Élève</Heading>
              <Caption>De qui parlez-vous ?</Caption>

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Chercher un nom…"
                placeholderTextColor={theme.muted}
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontSize: 14,
                  marginTop: spacing.sm,
                }}
              />

              <Divider />

              {shown.length === 0 ? (
                <Caption>Aucun élève de ce nom.</Caption>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {shown.map((pupil) => (
                    <Choice
                      key={pupil.enrollmentId}
                      label={`${pupil.label} · ${pupil.classCode}`}
                      selected={pupil.enrollmentId === enrollmentId}
                      onPress={() => setEnrollmentId(pupil.enrollmentId)}
                    />
                  ))}
                </View>
              )}

              {/* Says how much is hidden, so a teacher scrolling a short list
                  knows it is a filter and not the whole roll. */}
              {needle !== "" && shown.length < pupils.data.length ? (
                <Caption>
                  {shown.length} sur {pupils.data.length} élèves
                </Caption>
              ) : null}
            </Card>

            <Card>
              <Heading>Nature</Heading>
              <Divider />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {KINDS.map((value) => (
                  <Chip
                    key={value}
                    label={REMARK_KIND_LABELS[value] ?? value}
                    selected={kind === value}
                    onPress={() => setKind(value)}
                  />
                ))}
              </View>

              <Divider />
              <Heading>Ton</Heading>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {TONES.map((value) => (
                  <Chip
                    key={value}
                    label={REMARK_TONE_LABELS[value] ?? value}
                    selected={tone === value}
                    onPress={() => setTone(value)}
                  />
                ))}
              </View>
            </Card>

            <Card>
              <Heading>Remarque</Heading>
              <Caption>
                Note interne — elle n&apos;est pas transmise à la famille.
              </Caption>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Ce que vous avez observé…"
                placeholderTextColor={theme.muted}
                multiline
                maxLength={MAX_LENGTH}
                style={{
                  minHeight: 120,
                  textAlignVertical: "top",
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontSize: 14,
                  marginTop: spacing.sm,
                }}
              />
              <Caption>
                {trimmed.length} / {MAX_LENGTH}
              </Caption>
            </Card>

            <Button
              label="Enregistrer la remarque"
              onPress={submit}
              disabled={!canSave}
              busy={save.isPending}
            />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/** One pupil in the list — a full-width row, since the names are long. */
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

/** A short one-tap option — kind and tone both have a handful. */
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
