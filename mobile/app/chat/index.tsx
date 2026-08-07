import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChannels } from "../../src/api/hooks";
import {
  Empty,
  ErrorNote,
  Loading,
  Tile,
  TileGrid,
} from "../../src/ui/components";
import { spacing, useTheme } from "../../src/ui/theme";

/**
 * The conversations this family may open.
 *
 * Empty is the ordinary state, not an error: both switches default to off, and
 * a school that has not opened the parents' space simply has none. The message
 * says so rather than suggesting something is broken.
 */
export default function ChannelsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const channels = useChannels();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Espace parents" }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {channels.isPending ? <Loading /> : null}
        {channels.isError ? (
          <ErrorNote message="Impossible de charger les discussions." />
        ) : null}

        {channels.data ? (
          channels.data.length === 0 ? (
            <Empty message="L'école n'a pas ouvert d'espace parents." />
          ) : (
            <TileGrid>
              {channels.data.map((channel) => (
                <Tile
                  key={channel.id}
                  label={channel.label}
                  icon={
                    channel.kind === "GENERAL"
                      ? "account-group-outline"
                      : "school-outline"
                  }
                  hint={
                    channel.isArchived
                      ? "Fermé — lecture seule"
                      : `${channel.messageCount} messages`
                  }
                  badge={channel.isArchived ? "Fermé" : undefined}
                  tone={channel.isArchived ? "warning" : "default"}
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[channelId]",
                      params: { channelId: channel.id, title: channel.label },
                    })
                  }
                />
              ))}
            </TileGrid>
          )
        ) : null}
      </ScrollView>
    </>
  );
}
