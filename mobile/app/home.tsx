import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearTokens } from "../src/api/client";
import { useIdentity } from "../src/api/hooks";
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

  const signOut = async () => {
    await clearTokens();
    queryClient.clear();
    router.replace("/login");
  };

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

        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "600" }}>
            Déconnexion
          </Text>
        </Pressable>
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
