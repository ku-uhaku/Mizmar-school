import { Stack, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMyRemarks } from "../src/api/hooks";
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
import {
  REMARK_KIND_LABELS,
  REMARK_TONE_LABELS,
  shortDate,
} from "../src/ui/format";
import { spacing, useTheme } from "../src/ui/theme";

/**
 * Mes remarques.
 *
 * The screen exists for one line on each card: whether the direction has
 * released the note to the family. A teacher writing from a phone otherwise has
 * no way to tell an internal observation from one a parent is already reading,
 * and that is exactly the distinction the carnet turns on.
 *
 * Releasing is not offered here — it is the direction's decision, made on the
 * web. This only reports it.
 */
export default function MyRemarksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const remarks = useMyRemarks();
  const rows = remarks.data ?? [];
  const waiting = rows.filter((row) => !row.isVisibleToFamily).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Mes remarques" }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
      >
        <Button
          label="Écrire une remarque"
          onPress={() => router.push("/remark/new")}
        />

        {remarks.isPending ? <Loading /> : null}
        {remarks.isError ? (
          <ErrorNote message="Impossible de charger vos remarques." />
        ) : null}

        {remarks.data && rows.length === 0 ? (
          <Empty message="Vous n'avez encore écrit aucune remarque." />
        ) : null}

        {rows.length > 0 ? (
          <Card>
            <Caption>
              {waiting === 0
                ? "Toutes vos remarques ont été traitées par la direction."
                : `${waiting} remarque${waiting > 1 ? "s" : ""} en attente de validation par la direction.`}
            </Caption>
          </Card>
        ) : null}

        {rows.map((remark) => (
          <Card key={remark.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: spacing.md,
              }}
            >
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Heading>{remark.studentName}</Heading>
                <Caption>
                  {remark.classCode} · {shortDate(remark.occurredOn)}
                  {remark.subjectName ? ` · ${remark.subjectName}` : ""}
                </Caption>
              </View>

              <Badge
                tone={remark.isVisibleToFamily ? "success" : "warning"}
              >
                {remark.isVisibleToFamily ? "Transmise" : "En attente"}
              </Badge>
            </View>

            <Divider />

            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
            >
              <Caption>
                {REMARK_KIND_LABELS[remark.kind] ?? remark.kind} ·{" "}
                {REMARK_TONE_LABELS[remark.tone] ?? remark.tone}
              </Caption>
            </View>

            <Body>{remark.body}</Body>

            {!remark.isVisibleToFamily ? (
              <Caption>
                Note interne — la famille ne la voit pas tant que la direction
                ne l&apos;a pas validée.
              </Caption>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </>
  );
}
