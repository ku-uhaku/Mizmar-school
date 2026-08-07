import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useMessages, usePostMessage } from "../../src/api/hooks";
import { Empty, ErrorNote, Loading } from "../../src/ui/components";
import { radius, spacing, useTheme } from "../../src/ui/theme";

/** Mirrors `MAX_MESSAGE_LENGTH` in modules/chat/enums.ts. */
const MAX_LENGTH = 2000;

/**
 * One conversation.
 *
 * ── Newest at the top, not the bottom ───────────────────────────────────────
 * A messaging app scrolls to the bottom because you are having a conversation.
 * This is a parents' notice board that happens to be threaded: somebody opens
 * it to find out what they missed, and the thing they missed is the newest.
 * The API returns newest-first and the list keeps that order, which also means
 * no scroll-to-end dance on every poll.
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

  const messages = useMessages(channelId);
  const post = usePostMessage(channelId);
  const [draft, setDraft] = useState("");

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

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        >
          {messages.isPending ? <Loading /> : null}
          {messages.isError ? (
            <ErrorNote message="Impossible de charger la discussion." />
          ) : null}

          {messages.data?.length === 0 ? (
            <Empty message="Rien n'a encore été écrit." />
          ) : null}

          {messages.data?.map((message) => (
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
