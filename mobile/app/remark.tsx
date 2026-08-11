import { Stack, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMyRemarks } from "../src/api/hooks";
import { interpolate, label, useFormat, useT } from "../src/i18n";
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
  const t = useT();
  const fmt = useFormat();

  const remarks = useMyRemarks();
  const rows = remarks.data ?? [];
  const waiting = rows.filter((row) => !row.isVisibleToFamily).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.myRemarks.title }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
      >
        <Button
          label={t.myRemarks.write}
          onPress={() => router.push("/remark/new")}
        />

        {remarks.isPending ? <Loading /> : null}
        {remarks.isError ? (
          <ErrorNote message={t.myRemarks.loadError} />
        ) : null}

        {remarks.data && rows.length === 0 ? (
          <Empty message={t.myRemarks.none} />
        ) : null}

        {rows.length > 0 ? (
          <Card>
            <Caption>
              {waiting === 0
                ? t.myRemarks.allProcessed
                : interpolate(t.myRemarks.pending, { count: waiting })}
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
                  {remark.classCode} · {fmt.shortDate(remark.occurredOn)}
                  {remark.subjectName ? ` · ${remark.subjectName}` : ""}
                </Caption>
              </View>

              <Badge
                tone={remark.isVisibleToFamily ? "success" : "warning"}
              >
                {remark.isVisibleToFamily ? t.myRemarks.transmitted : t.myRemarks.waiting}
              </Badge>
            </View>

            <Divider />

            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
            >
              <Caption>
                {label(t.labels.remarkKind, remark.kind)} ·{" "}
                {label(t.labels.remarkTone, remark.tone)}
              </Caption>
            </View>

            <Body>{remark.body}</Body>

            {!remark.isVisibleToFamily ? (
              <Caption>{t.myRemarks.internalNote}</Caption>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </>
  );
}
