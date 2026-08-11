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

import {
  useMySupplyLists,
  useSaveSupplyList,
  useSupplyOptions,
} from "../../src/api/hooks";
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

/** The shelves of a papeterie. Mirrors `SUPPLY_CATEGORIES`. */
const CATEGORY_LABELS: Record<string, string> = {
  ECRITURE: "Écriture",
  CAHIERS: "Cahiers",
  COUVERTURES: "Couvertures",
  CLASSEMENT: "Classement",
  GEOMETRIE: "Géométrie",
  ARTS: "Arts",
  CARTABLE: "Cartable",
  SPORT: "Sport",
  HYGIENE: "Hygiène",
  AUTRE: "Autre",
};

/** Lowercased and stripped of accents, so "geometrie" finds "Géométrie". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Writing a demande de fournitures.
 *
 * Articles come from the school's catalogue and are chosen, never typed: the
 * wording was decided once by the school, and a request that could post its own
 * label would be a way around that. What the teacher adds is the quantity and
 * whether the line is required.
 *
 * Saving leaves it DRAFT. Sending it to the direction is a separate, deliberate
 * act on the list screen — a half-written request must not land on somebody's
 * desk because its author tapped save.
 */
export default function NewSupplyListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listId } = useLocalSearchParams<{ listId?: string }>();

  const options = useSupplyOptions();
  const lists = useMySupplyLists();
  const save = useSaveSupplyList();

  const existing = listId
    ? (lists.data?.find((row) => row.id === listId) ?? null)
    : null;

  const [seeded, setSeeded] = useState(false);
  const [schoolClassId, setSchoolClassId] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<
    Record<string, { quantity: number | null; isRequired: boolean }>
  >({});

  // Seeded once the list being edited has arrived, without clobbering typing.
  if (existing && !seeded) {
    setSeeded(true);
    setSchoolClassId(existing.schoolClassId);
    setSubjectId(existing.subjectId);
    setTitle(existing.title);
    setNotes(existing.notes ?? "");
    setPicked(
      Object.fromEntries(
        existing.items.flatMap((item) =>
          item.articleId
            ? [
                [
                  item.articleId,
                  { quantity: item.quantity, isRequired: item.isRequired },
                ] as const,
              ]
            : [],
        ),
      ),
    );
  }

  const data = options.data;
  const needle = fold(search);
  const articles = (data?.articles ?? []).filter((article) => {
    if (needle === "") return true;
    if (picked[article.id]) return true;
    return fold(
      `${article.label} ${CATEGORY_LABELS[article.category] ?? article.category}`,
    ).includes(needle);
  });

  // The classes a teacher holds, deduplicated — one entry per class, not one
  // per class-and-subject, because fournitures are asked for by class.
  const classes = [
    ...new Map(
      (data?.teaching ?? []).map((slot) => [
        slot.schoolClassId,
        { id: slot.schoolClassId, label: slot.classCode },
      ]),
    ).values(),
  ];

  const chosenCount = Object.keys(picked).length;
  const canSave = schoolClassId !== "" && title.trim().length > 0;

  function toggle(articleId: string, defaultQuantity: number | null) {
    setPicked((current) => {
      const next = { ...current };
      if (next[articleId]) {
        delete next[articleId];
      } else {
        next[articleId] = {
          quantity: defaultQuantity ?? 1,
          isRequired: true,
        };
      }
      return next;
    });
  }

  function setQuantity(articleId: string, raw: string) {
    const parsed = Number(raw.trim());
    setPicked((current) => ({
      ...current,
      [articleId]: {
        ...current[articleId],
        quantity:
          raw.trim() === "" || !Number.isFinite(parsed) || parsed < 1
            ? null
            : Math.trunc(parsed),
      },
    }));
  }

  function submit() {
    if (!canSave || save.isPending) return;

    save.mutate(
      {
        ...(listId ? { listId } : {}),
        schoolClassId,
        subjectId,
        title: title.trim(),
        notes: notes.trim() || null,
        items: Object.entries(picked).map(([articleId, entry]) => ({
          articleId,
          quantity: entry.quantity,
          notes: null,
          isRequired: entry.isRequired,
        })),
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            router.back();
            return;
          }
          Alert.alert(
            "Enregistrement refusé",
            result.reason === "not-yours"
              ? "Cette demande n'est pas la vôtre."
              : result.reason === "not-editable"
                ? "Une demande déjà validée ne peut plus être modifiée."
                : "La demande n'a pas pu être enregistrée.",
          );
        },
        onError: () =>
          Alert.alert(
            "Enregistrement refusé",
            "La demande n'a pas pu être enregistrée.",
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
      <Stack.Screen
        options={{
          headerShown: true,
          title: listId ? "Modifier la demande" : "Nouvelle demande",
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
        {options.isPending ? <Loading /> : null}
        {options.isError ? (
          <ErrorNote message="Impossible de charger le catalogue." />
        ) : null}

        {data && classes.length === 0 ? (
          <Empty message="Vous n'avez aucune classe cette année." />
        ) : null}

        {data && classes.length > 0 ? (
          <>
            <Card>
              <Heading>Classe</Heading>
              <Divider />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {classes.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    selected={schoolClassId === option.id}
                    onPress={() => setSchoolClassId(option.id)}
                  />
                ))}
              </View>

              <Divider />
              <Heading>Matière</Heading>
              <Caption>Facultatif — pour une liste propre à une matière.</Caption>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Chip
                  label="Toutes"
                  selected={subjectId === null}
                  onPress={() => setSubjectId(null)}
                />
                {data.subjects.map((subject) => (
                  <Chip
                    key={subject.id}
                    label={subject.label}
                    selected={subjectId === subject.id}
                    onPress={() => setSubjectId(subject.id)}
                  />
                ))}
              </View>
            </Card>

            <Card>
              <Heading>Intitulé</Heading>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Fournitures rentrée 2026"
                placeholderTextColor={theme.muted}
                maxLength={160}
                style={boxStyle}
              />

              <Caption>Note pour la direction — facultatif</Caption>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Pourquoi cette demande…"
                placeholderTextColor={theme.muted}
                multiline
                maxLength={1000}
                style={{ ...boxStyle, minHeight: 70, textAlignVertical: "top" }}
              />
            </Card>

            <Card>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Heading>Articles</Heading>
                <Caption>{chosenCount} choisi{chosenCount > 1 ? "s" : ""}</Caption>
              </View>

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Chercher un article…"
                placeholderTextColor={theme.muted}
                autoCorrect={false}
                autoCapitalize="none"
                style={boxStyle}
              />

              <Divider />

              {articles.length === 0 ? (
                <Caption>Aucun article de ce nom.</Caption>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {articles.map((article) => {
                    const entry = picked[article.id];
                    return (
                      <View key={article.id} style={{ gap: spacing.xs }}>
                        <Pressable
                          onPress={() =>
                            toggle(article.id, article.defaultQuantity)
                          }
                          accessibilityRole="button"
                          accessibilityState={{ selected: Boolean(entry) }}
                          style={({ pressed }) => ({
                            paddingVertical: 10,
                            paddingHorizontal: spacing.md,
                            borderRadius: radius.sm,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: entry ? theme.primary : theme.border,
                            backgroundColor: entry
                              ? `${theme.primary}1a`
                              : "transparent",
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Text
                            style={{
                              color: entry ? theme.primary : theme.text,
                              fontSize: 14,
                              fontWeight: entry ? "700" : "500",
                            }}
                          >
                            {article.label}
                          </Text>
                          <Text style={{ color: theme.muted, fontSize: 11 }}>
                            {CATEGORY_LABELS[article.category] ??
                              article.category}
                            {article.notes ? ` · ${article.notes}` : ""}
                          </Text>
                        </Pressable>

                        {entry ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.sm,
                              paddingHorizontal: spacing.md,
                            }}
                          >
                            <Caption>Quantité</Caption>
                            <TextInput
                              value={
                                entry.quantity === null
                                  ? ""
                                  : String(entry.quantity)
                              }
                              onChangeText={(value) =>
                                setQuantity(article.id, value)
                              }
                              keyboardType="number-pad"
                              maxLength={3}
                              style={{
                                width: 56,
                                textAlign: "center",
                                color: theme.text,
                                backgroundColor: theme.background,
                                borderColor: theme.border,
                                borderWidth: StyleSheet.hairlineWidth,
                                borderRadius: radius.sm,
                                paddingVertical: 6,
                                fontSize: 14,
                              }}
                            />
                            <Pressable
                              onPress={() =>
                                setPicked((current) => ({
                                  ...current,
                                  [article.id]: {
                                    ...current[article.id],
                                    isRequired: !current[article.id].isRequired,
                                  },
                                }))
                              }
                              accessibilityRole="button"
                            >
                              <Text
                                style={{
                                  color: entry.isRequired
                                    ? theme.text
                                    : theme.muted,
                                  fontSize: 12,
                                  fontWeight: "600",
                                }}
                              >
                                {entry.isRequired ? "Obligatoire" : "Facultatif"}
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {needle !== "" && articles.length < (data.articles.length ?? 0) ? (
                <Caption>
                  {articles.length} sur {data.articles.length} articles
                </Caption>
              ) : null}
            </Card>

            <Body muted>
              Enregistrer ne l&apos;envoie pas. Vous l&apos;enverrez à la
              direction depuis la liste de vos demandes.
            </Body>

            <Button
              label="Enregistrer le brouillon"
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
