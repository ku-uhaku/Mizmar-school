import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useBadges, useIdentity } from "../src/api/hooks";
import type { MobileSpace } from "../src/api/types";
import { DirectorSpace } from "../src/spaces/director";
import { DriverSpace } from "../src/spaces/driver";
import { FamilySpace } from "../src/spaces/family";
import { TeacherSpace } from "../src/spaces/teacher";
import { Body, Caption, Empty, ErrorNote, Loading } from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

const SPACE_LABELS: Record<MobileSpace, string> = {
  family: "Famille",
  teacher: "Classe",
  driver: "Transport",
  director: "Direction",
};

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
          {/* Only the family space has anything to be notified about — the
            other three are read from the school's side, where "what is new"
            is the screen itself. */}
          {space === "family" ? <NotificationBell /> : null}

          <Pressable
            onPress={() => router.push("/profile")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Profil"
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

      {identity.isError ? (
        <ErrorNote message="Impossible de joindre l'école. Tirez pour réessayer." />
      ) : null}

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
        <Empty message="Ce compte n'a accès à aucun espace de l'application. Contactez l'administration." />
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
 * The bell, and the count of things this family has not looked at.
 *
 * Silent when there is nothing: a bell with a zero on it is a bell that teaches
 * you to stop reading bells. Tapping opens the list, which is where the count
 * gets cleared — per topic, as each screen is opened.
 */
function NotificationBell() {
  const theme = useTheme();
  const router = useRouter();
  const badges = useBadges();
  const total = badges.data?.total ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        total > 0 ? `Notifications, ${total} nouveautés` : "Notifications"
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
        name={total > 0 ? "bell-badge-outline" : "bell-outline"}
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
