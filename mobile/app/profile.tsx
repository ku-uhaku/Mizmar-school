import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearTokens } from "../src/api/client";
import { useIdentity } from "../src/api/hooks";
import { LOCALES, LOCALE_META, useLocale, useT } from "../src/i18n";
import {
  Badge,
  Button,
  Card,
  Divider,
  Heading,
  Loading,
  Row,
} from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

/**
 * The account, and the way out of it.
 *
 * Sign-out lived on the home header, one mis-tap from the name you had just
 * read. It belongs behind a screen you have to mean to open — which is also the
 * screen that answers "which account am I signed in as", the question somebody
 * asks precisely when the app is showing them the wrong child.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const identity = useIdentity();
  const t = useT();
  const { locale, setLocale } = useLocale();

  const SPACE_LABELS: Record<string, string> = {
    family: t.spaces.family,
    teacher: t.spaces.teacher,
    driver: t.spaces.driver,
    director: t.spaces.director,
  };

  const signOut = async () => {
    await clearTokens();
    // Cleared, not invalidated: the next account to sign in on this phone must
    // not see a flash of the previous one's children.
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.profile.title }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {identity.isPending ? <Loading /> : null}

        {identity.data ? (
          <>
            <Card>
              <Heading>{identity.data.fullName}</Heading>
              <Row label={t.profile.account} value={identity.data.email} />
              <Divider />
              <Row
                label={t.profile.establishment}
                value={
                  identity.data.schoolName ?? identity.data.organizationName
                }
              />
              {identity.data.schoolYearName ? (
                <>
                  <Divider />
                  <Row
                    label={t.profile.schoolYear}
                    value={identity.data.schoolYearName}
                  />
                </>
              ) : null}
            </Card>

            {identity.data.spaces.length > 0 ? (
              <Card>
                <Heading>{t.profile.access}</Heading>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.sm,
                  }}
                >
                  {identity.data.spaces.map((space) => (
                    <Badge key={space}>
                      {SPACE_LABELS[space] ?? space}
                    </Badge>
                  ))}
                </View>
              </Card>
            ) : null}

            <Card>
              <Heading>{t.profile.language}</Heading>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                {LOCALES.map((code) => {
                  const active = code === locale;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setLocale(code)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: radius.sm,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active
                          ? `${theme.primary}1a`
                          : theme.card,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? theme.primary : theme.text,
                          fontSize: 14,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {LOCALE_META[code].label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Button label={t.profile.signOut} onPress={signOut} variant="ghost" />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
