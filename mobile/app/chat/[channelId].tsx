import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useMarkSeen, useMessages, usePostMessage } from "../../src/api/hooks";
import { Empty, ErrorNote, Loading } from "../../src/ui/components";
import { radius, spacing, useTheme } from "../../src/ui/theme";

/** Mirrors `MAX_MESSAGE_LENGTH` in modules/chat/enums.ts. */
const MAX_LENGTH = 2000;

/**
 * One conversation.
 *
 * ── Oldest at the top, newest at the bottom ─────────────────────────────────
 * It read newest-first, which is right for a notice board and wrong for this:
 * a reply landed above the thing it replied to, so a conversation had to be
 * read upwards. The API still returns newest-first — that is what makes `take`
 * mean "the most recent hundred" — and the order is reversed here, at the one
 * place that renders it.
 *
 * The view keeps itself at the bottom on new content, so opening the thread
 * lands on the newest message and a reply arriving while you read does not
 * jump the scroll.
 *
 * The thread polls — see `useMessages`. There is no push infrastructure here,
 * and pretending otherwise with a websocket the server does not have would be
 * worse than a ten-second refresh.
 */
export default function ChannelScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { channelId, title } = useLocalSearchParams<{
    channelId: string;
    title?: string;
  }>();

  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const messages = useMessages(channelId);
  const post = usePostMessage(channelId);
  // Stamped on open, not on close: a parent who reads half the thread and
  // leaves has still seen what the badge was about.
  const markSeen = useMarkSeen();
  useEffect(() => {
    markSeen.mutate("CHAT");
    // Once per visit. `markSeen` is a stable mutation object; listing it would
    // re-stamp on every render it happens to change identity on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);
  const [draft, setDraft] = useState("");

  // Reversed for reading: see the note above. A copy, because the query cache
  // owns that array and mutating it would reorder every other reader of it.
  const ordered = messages.data ? [...messages.data].reverse() : [];

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LENGTH;

  function send() {
    if (!canSend || post.isPending) return;
    post.mutate(trimmed, { onSuccess: () => setDraft("") });
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: title ?? "Discussion" }}
      />

      {/*
        ── The composer has to stay above the keyboard ──────────────────────────
        `behavior: undefined` on Android relies on `adjustResize`, which the
        Expo Go shell does not always apply — so the keyboard covered the box
        you were typing into. "height" is the behaviour that works on Android
        regardless, and iOS keeps "padding", which is the one that works there.

        The offset is the header's own height, taken from the navigation stack
        rather than guessed: a hardcoded 44 is wrong on every device with a
        notch, and wrong again in landscape.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {messages.isPending ? <Loading /> : null}
          {messages.isError ? (
            <ErrorNote message="Impossible de charger la discussion." />
          ) : null}

          {messages.data?.length === 0 ? (
            <Empty message="Rien n'a encore été écrit." />
          ) : null}

          {ordered.map((message) => (
            <View
              key={message.id}
              style={{
                alignSelf: message.isMine ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: message.isMine ? `${theme.primary}1a` : theme.card,
                borderColor: message.isMine ? `${theme.primary}44` : theme.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 2,
              }}
            >
              {/* Own messages need no name on them — the alignment says it. */}
              {message.isMine ? null : (
                <Text
                  style={{ color: theme.muted, fontSize: 11, fontWeight: "700" }}
                >
                  {message.authorName}
                </Text>
              )}
              <Text style={{ color: theme.text, fontSize: 14 }}>
                {message.body}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 10 }}>
                {message.createdAt.slice(11, 16)} ·{" "}
                {message.createdAt.slice(0, 10)}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            padding: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.card,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Votre message…"
            placeholderTextColor={theme.muted}
            multiline
            maxLength={MAX_LENGTH}
            style={{
              flex: 1,
              maxHeight: 120,
              color: theme.text,
              backgroundColor: theme.background,
              borderColor: theme.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: 14,
            }}
          />

          <Pressable
            onPress={send}
            disabled={!canSend || post.isPending}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: canSend ? theme.primary : theme.border,
              opacity: post.isPending ? 0.6 : 1,
            }}
          >
            <MaterialCommunityIcons name="send" size={19} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
