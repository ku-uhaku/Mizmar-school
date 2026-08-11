import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useMarkSeen, useMessages, usePostMessage } from "../../src/api/hooks";
import { useT } from "../../src/i18n";
import { Empty, ErrorNote, Loading } from "../../src/ui/components";
import { radius, spacing, useTheme } from "../../src/ui/theme";
import { useKeyboardOverlap } from "../../src/ui/use-keyboard";

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
  const t = useT();
  const { channelId, title } = useLocalSearchParams<{
    channelId: string;
    title?: string;
  }>();

  const overlap = useKeyboardOverlap();
  const scrollRef = useRef<ScrollView>(null);

  // The keyboard taking half the screen would otherwise leave you looking at
  // the middle of the thread with the newest message hidden behind it.
  useEffect(() => {
    if (overlap > 0) scrollRef.current?.scrollToEnd({ animated: true });
  }, [overlap]);
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
        options={{ headerShown: true, title: title ?? t.chatChannel.defaultTitle }}
      />

      {/*
        ── The composer sits exactly on the keyboard ────────────────────────────
        Not a `KeyboardAvoidingView`. Android's `softwareKeyboardLayoutMode`
        defaults to "resize", so the window has already shrunk by the time that
        component adds its own offset — the two stacked, and the composer ended
        up far above the keyboard rather than on it.

        `useKeyboardOverlap` measures what is actually left uncovered after the
        resize, so the padding is the keyboard's height on iOS, nothing on an
        Android that resized, and the difference on one that half did.
      */}
      <View style={{ flex: 1, backgroundColor: theme.background }}>
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
            <ErrorNote message={t.chatChannel.loadError} />
          ) : null}

          {messages.data?.length === 0 ? (
            <Empty message={t.chatChannel.empty} />
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
            // The safe-area inset is the home indicator's, and the keyboard
            // covers it when it is up — so it is one or the other, never both.
            paddingBottom:
              overlap > 0 ? overlap + spacing.md : insets.bottom + spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.card,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t.chatChannel.composerPlaceholder}
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
            accessibilityLabel={t.chatChannel.sendA11y}
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
      </View>
    </>
  );
}
