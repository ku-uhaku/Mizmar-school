import { Stack, router } from "expo-router";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMySupplyLists, useSubmitSupplyList } from "../src/api/hooks";
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

/** How a demande reads to its author. Mirrors `SUPPLY_STATUSES`. */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Envoyée — en attente",
  APPROVED: "Validée",
  REJECTED: "Refusée",
};

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

  const lists = useMySupplyLists();
  const submit = useSubmitSupplyList();

  const rows = lists.data ?? [];

  function send(listId: string, title: string) {
    Alert.alert(
      "Envoyer à la direction ?",
      `« ${title} » partira pour validation. Vous ne pourrez plus la modifier tant qu'elle n'a pas été traitée.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Envoyer",
          onPress: () =>
            submit.mutate(listId, {
              onSuccess: (result) => {
                if (!result.ok) {
                  Alert.alert(
                    "Envoi refusé",
                    "Cette demande ne peut plus être envoyée.",
                  );
                }
              },
              onError: () =>
                Alert.alert("Envoi refusé", "La demande n'a pas pu être envoyée."),
            }),
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Fournitures" }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
      >
        <Button
          label="Nouvelle demande"
          onPress={() => router.push("/supplies/new")}
        />

        {lists.isPending ? <Loading /> : null}
        {lists.isError ? (
          <ErrorNote message="Impossible de charger vos demandes." />
        ) : null}

        {lists.data && rows.length === 0 ? (
          <Empty message="Vous n'avez encore rien demandé." />
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
                  {list.itemCount} article{list.itemCount > 1 ? "s" : ""}
                </Caption>
              </View>

              <Badge tone={STATUS_TONES[list.status] ?? "default"}>
                {STATUS_LABELS[list.status] ?? list.status}
              </Badge>
            </View>

            {/* The reason it came back — the only thing that stops the same
                list being sent again unchanged. */}
            {list.status === "REJECTED" && list.reviewNote ? (
              <>
                <Divider />
                <Caption>Motif : {list.reviewNote}</Caption>
              </>
            ) : null}

            {list.status === "APPROVED" ? (
              <>
                <Divider />
                <Caption>
                  Validée{list.reviewedByName ? ` par ${list.reviewedByName}` : ""} —
                  visible par les familles.
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
                      label="Modifier"
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
                      label="Envoyer"
                      onPress={() => send(list.id, list.title)}
                      busy={submit.isPending}
                      disabled={list.itemCount === 0}
                    />
                  </View>
                </View>
                {list.itemCount === 0 ? (
                  <Caption>Ajoutez au moins un article avant d&apos;envoyer.</Caption>
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
