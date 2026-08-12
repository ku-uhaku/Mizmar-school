import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  useBadges,
  useChannels,
  useIdentity,
  unreadOf,
  useNotifications,
} from "../src/api/hooks";
import type { MobileSpace } from "../src/api/types";
import { interpolate, useT } from "../src/i18n";
import { DirectorSpace } from "../src/spaces/director";
import { DriverSpace } from "../src/spaces/driver";
import { FamilySpace } from "../src/spaces/family";
import { TeacherSpace } from "../src/spaces/teacher";
import { Body, Caption, Empty, ErrorNote, Loading } from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

/**
 * The app, once signed in.
 *
 * There are no tabs: most accounts hold exactly one space, and a tab bar with
 * one tab is furniture. The switcher below appears only for the accounts that
 * genuinely have two — a directrice who also teaches, typically.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const t = useT();

  const SPACE_LABELS: Record<MobileSpace, string> = {
    family: t.spaces.family,
    teacher: t.spaces.teacher,
    driver: t.spaces.driver,
    director: t.spaces.director,
  };

  const identity = useIdentity();
  const [chosen, setChosen] = useState<MobileSpace | null>(null);

  const space = chosen ?? identity.data?.defaultSpace ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
        gap: spacing.lg,
      }}
      refreshControl={
        <RefreshControl
          refreshing={identity.isRefetching}
          onRefresh={() => queryClient.invalidateQueries()}
          tintColor={theme.muted}
        />
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: spacing.md,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: "700" }}>
            {identity.data?.fullName ?? "…"}
          </Text>
          <Caption>
            {[identity.data?.schoolName ?? identity.data?.organizationName, identity.data?.schoolYearName]
              .filter(Boolean)
              .join(" · ")}
          </Caption>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {/* Every account has an inbox, whichever space it is in — the scope
            is the account and not the space. See app/notifications.tsx. */}
          <InboxBell />

          {/* Messages are their own control and keep their own count. A parent
            reading "you have three notifications" and finding a conversation
            is not the same affordance as a bell that opens the conversation,
            and the other three spaces have no parents' channel at all. */}
          {space === "family" ? <MessagesBell /> : null}

          <Pressable
            onPress={() => router.push("/profile")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.home.profileA11y}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
            }}
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={20}
              color={theme.text}
            />
          </Pressable>
        </View>
      </View>

      {identity.isPending ? <Loading /> : null}

      {identity.isError ? <ErrorNote message={t.home.loadError} /> : null}

      {identity.data && identity.data.spaces.length > 1 ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {identity.data.spaces.map((option) => {
            const active = option === space;
            return (
              <Pressable
                key={option}
                onPress={() => setChosen(option)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primary : theme.card,
                }}
              >
                <Text
                  style={{
                    color: active ? theme.primaryText : theme.text,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {SPACE_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {identity.data && space === null ? (
        <Empty message={t.home.noSpaceAccess} />
      ) : null}

      {space === "family" ? <FamilySpace /> : null}
      {space === "teacher" ? <TeacherSpace /> : null}
      {space === "driver" ? <DriverSpace /> : null}
      {space === "director" ? <DirectorSpace /> : null}

      {identity.data ? (
        <Body muted>{identity.data.organizationName}</Body>
      ) : null}
    </ScrollView>
  );
}


/**
 * The inbox: how many unread notifications, and one tap to read them.
 *
 * ── Why this can be a summary when the messages bell could not ──────────────
 * The note below explains why a bell over the *badge counts* was wrong: it
 * opened a screen of tiles that repeated the number and put the actual thing
 * two taps away, because a count is not an item. This one is different in
 * exactly that respect — behind it is a list of things that happened, each a
 * sentence you can read and press, so the number and the screen are the same
 * fact rather than one describing the other.
 *
 * Silent at zero, for the same reason as its neighbour.
 */
function InboxBell() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const inbox = useNotifications();
  const unread = unreadOf(inbox.data);

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0
          ? interpolate(t.notifications.bellUnreadA11y, { count: unread })
          : t.notifications.bellA11y
      }
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      }}
    >
      <MaterialCommunityIcons
        name={unread > 0 ? "bell-badge-outline" : "bell-outline"}
        size={20}
        color={unread > 0 ? theme.primary : theme.text}
      />

      {unread > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 17,
            height: 17,
            paddingHorizontal: 4,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.danger,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The messages bell: unread messages, and one tap to them.
 *
 * ── It used to open a summary, and that was wrong ───────────────────────────
 * The first version counted four things — events, marks, remarks, messages —
 * and opened a screen of tiles saying how many of each. Which meant a bell
 * showing "3" led to a page that showed "3" again, and the message was still
 * two taps away. Worse, the badge said something was new while the screen
 * behind it had nothing to read, because a count is not an item.
 *
 * So the bell is about messages, which is the one thing here that is genuinely
 * addressed *to* you and that you would want to answer. It opens the
 * conversation. The other three still have their counts, and they are on the
 * tiles of the child they belong to, where the number sits next to the thing it
 * is about.
 *
 * Silent at zero: a bell with a nought on it teaches you to stop reading bells.
 */
function MessagesBell() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const badges = useBadges();
  const channels = useChannels();
  const total = badges.data?.chat ?? 0;

  // Straight to the conversation when there is only one, which is the ordinary
  // case for a school that opened only the class groups or only the general
  // one. The list is a choice, and a choice of one is not a choice.
  const open = () => {
    const only = channels.data?.length === 1 ? channels.data[0] : null;
    if (only) {
      router.push({
        pathname: "/chat/[channelId]",
        params: { channelId: only.id, title: only.label },
      });
      return;
    }
    router.push("/chat");
  };

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        total > 0
          ? interpolate(t.home.messagesUnreadA11y, { count: total })
          : t.home.messagesA11y
      }
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      }}
    >
      <MaterialCommunityIcons
        name={total > 0 ? "message-badge-outline" : "message-outline"}
        size={20}
        color={total > 0 ? theme.primary : theme.text}
      />

      {total > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 17,
            height: 17,
            paddingHorizontal: 4,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.danger,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
            {total > 99 ? "99+" : total}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
