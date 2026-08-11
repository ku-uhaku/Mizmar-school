import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChannels } from "../../src/api/hooks";
import { interpolate, useT } from "../../src/i18n";
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
  const t = useT();
  const channels = useChannels();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.chatList.title }} />

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
          <ErrorNote message={t.chatList.loadError} />
        ) : null}

        {channels.data ? (
          channels.data.length === 0 ? (
            <Empty message={t.chatList.noParentSpace} />
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
                      ? t.chatList.closedReadOnly
                      : interpolate(t.chatList.messagesCount, {
                          count: channel.messageCount,
                        })
                  }
                  badge={channel.isArchived ? t.chatList.closed : undefined}
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
