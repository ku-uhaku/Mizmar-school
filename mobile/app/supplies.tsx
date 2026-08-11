import { Stack, router } from "expo-router";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMySupplyLists, useSubmitSupplyList } from "../src/api/hooks";
import { interpolate, useT } from "../src/i18n";
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

const STATUS_TONES: Record<string, "default" | "success" | "warning" | "danger"> =
  {
    DRAFT: "default",
    SUBMITTED: "warning",
    APPROVED: "success",
    REJECTED: "danger",
  };

/**
 * Mes demandes de fournitures.
 *
 * The whole screen is the approval loop made visible: a teacher writes what the
 * class needs, sends it to the direction, and nothing reaches a family until the
 * direction has said yes. A refusal comes back with its reason attached — that
 * is the point of REJECTED being a status rather than a deletion, since a list
 * that simply vanished would be rewritten identically next week.
 */
export default function SuppliesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const lists = useMySupplyLists();
  const submit = useSubmitSupplyList();

  const rows = lists.data ?? [];

  function send(listId: string, title: string) {
    Alert.alert(
      t.suppliesList.sendConfirmTitle,
      interpolate(t.suppliesList.sendConfirmBody, { title }),
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.suppliesList.sendConfirmAction,
          onPress: () =>
            submit.mutate(listId, {
              onSuccess: (result) => {
                if (!result.ok) {
                  Alert.alert(
                    t.suppliesList.sendRefusedTitle,
                    t.suppliesList.notAllowedAnymore,
                  );
                }
              },
              onError: () =>
                Alert.alert(t.suppliesList.sendRefusedTitle, t.suppliesList.sendFailed),
            }),
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.suppliesList.title }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
      >
        <Button
          label={t.suppliesList.newRequest}
          onPress={() => router.push("/supplies/new")}
        />

        {lists.isPending ? <Loading /> : null}
        {lists.isError ? (
          <ErrorNote message={t.suppliesList.loadError} />
        ) : null}

        {lists.data && rows.length === 0 ? (
          <Empty message={t.suppliesList.none} />
        ) : null}

        {rows.map((list) => (
          <Card key={list.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: spacing.md,
              }}
            >
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Heading>{list.title}</Heading>
                <Body muted>
                  {list.className}
                  {list.subjectName ? ` · ${list.subjectName}` : ""}
                </Body>
                <Caption>
                  {interpolate(t.suppliesList.itemCount, { count: list.itemCount })}
                </Caption>
              </View>

              <Badge tone={STATUS_TONES[list.status] ?? "default"}>
                {t.labels.supplyStatus[list.status as keyof typeof t.labels.supplyStatus] ??
                  list.status}
              </Badge>
            </View>

            {/* The reason it came back — the only thing that stops the same
                list being sent again unchanged. */}
            {list.status === "REJECTED" && list.reviewNote ? (
              <>
                <Divider />
                <Caption>
                  {interpolate(t.suppliesList.reason, { note: list.reviewNote })}
                </Caption>
              </>
            ) : null}

            {list.status === "APPROVED" ? (
              <>
                <Divider />
                <Caption>
                  {interpolate(t.suppliesList.approvedBy, {
                    by: list.reviewedByName
                      ? interpolate(t.suppliesList.approvedByName, {
                          name: list.reviewedByName,
                        })
                      : "",
                  })}
                </Caption>
              </>
            ) : null}

            {/* DRAFT and REJECTED are the two the author may still act on. */}
            {list.status === "DRAFT" || list.status === "REJECTED" ? (
              <>
                <Divider />
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t.suppliesList.editButton}
                      variant="ghost"
                      onPress={() =>
                        router.push({
                          pathname: "/supplies/new",
                          params: { listId: list.id },
                        })
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t.suppliesList.sendButton}
                      onPress={() => send(list.id, list.title)}
                      busy={submit.isPending}
                      disabled={list.itemCount === 0}
                    />
                  </View>
                </View>
                {list.itemCount === 0 ? (
                  <Caption>{t.suppliesList.addAtLeastOne}</Caption>
                ) : null}
              </>
            ) : null}

            {list.items.length > 0 ? (
              <>
                <Divider />
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/supplies/new",
                      params: { listId: list.id },
                    })
                  }
                  disabled={list.status !== "DRAFT" && list.status !== "REJECTED"}
                >
                  <Caption>
                    {list.items
                      .slice(0, 4)
                      .map((item) =>
                        item.quantity
                          ? `${item.quantity} × ${item.label}`
                          : item.label,
                      )
                      .join(", ")}
                    {list.items.length > 4
                      ? ` … +${list.items.length - 4}`
                      : ""}
                  </Caption>
                </Pressable>
              </>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </>
  );
}
