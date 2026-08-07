import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBadges, useChildren } from "../src/api/hooks";
import { Empty, ErrorNote, Loading, Tile, TileGrid } from "../src/ui/components";
import { spacing, useTheme } from "../src/ui/theme";

/**
 * What this family has not looked at yet.
 *
 * ── Counts, and where to go ─────────────────────────────────────────────────
 * Not a feed. The watermark behind these can say how many things are new but
 * not which — see the note on `PortalSeen` — and a feed built on that would be
 * inventing entries. So each tile says how many and takes you to the screen
 * that shows them in order, which is where the count is cleared.
 *
 * Marks and remarks are per child, so they lead to the first child's screen
 * when there is one child and to the list when there are several: sending a
 * parent of three to one child's marks would be picking for them.
 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const badges = useBadges();
  const children = useChildren();

  const only = children.data?.length === 1 ? children.data[0] : null;

  const toChild = (topic: string) => {
    if (!only) {
      router.back();
      return;
    }
    router.push({
      pathname: "/child/[studentId]/[topic]",
      params: { studentId: only.studentId, topic },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Nouveautés" }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {badges.isPending ? <Loading /> : null}
        {badges.isError ? (
          <ErrorNote message="Impossible de charger les nouveautés." />
        ) : null}

        {badges.data ? (
          badges.data.total === 0 ? (
            <Empty message="Rien de nouveau." />
          ) : (
            <TileGrid>
              {badges.data.chat > 0 ? (
                <Tile
                  label="Messages"
                  icon="message-text-outline"
                  hint="Espace parents"
                  badge={String(badges.data.chat)}
                  tone="danger"
                  onPress={() => router.push("/chat")}
                />
              ) : null}

              {badges.data.events > 0 ? (
                <Tile
                  label="Événements"
                  icon="calendar-star"
                  hint="Annoncés par l'école"
                  badge={String(badges.data.events)}
                  tone="warning"
                  onPress={() => toChild("evenements")}
                />
              ) : null}

              {badges.data.marks > 0 ? (
                <Tile
                  label="Notes"
                  icon="notebook-outline"
                  hint={only ? only.fullName : "Choisissez un enfant"}
                  badge={String(badges.data.marks)}
                  tone="success"
                  onPress={() => toChild("notes")}
                />
              ) : null}

              {badges.data.remarks > 0 ? (
                <Tile
                  label="Remarques"
                  icon="comment-text-outline"
                  hint={only ? only.fullName : "Choisissez un enfant"}
                  badge={String(badges.data.remarks)}
                  onPress={() => toChild("remarques")}
                />
              ) : null}
            </TileGrid>
          )
        ) : null}
      </ScrollView>
    </>
  );
}
