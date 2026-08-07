import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clearTokens } from "../src/api/client";
import { useIdentity } from "../src/api/hooks";
import {
  Badge,
  Button,
  Card,
  Divider,
  Heading,
  Loading,
  Row,
} from "../src/ui/components";
import { spacing, useTheme } from "../src/ui/theme";

const SPACE_LABELS: Record<string, string> = {
  family: "Famille",
  teacher: "Classe",
  driver: "Transport",
  director: "Direction",
};

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

  const signOut = async () => {
    await clearTokens();
    // Cleared, not invalidated: the next account to sign in on this phone must
    // not see a flash of the previous one's children.
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Profil" }} />

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
              <Row label="Compte" value={identity.data.email} />
              <Divider />
              <Row
                label="Établissement"
                value={
                  identity.data.schoolName ?? identity.data.organizationName
                }
              />
              {identity.data.schoolYearName ? (
                <>
                  <Divider />
                  <Row
                    label="Année scolaire"
                    value={identity.data.schoolYearName}
                  />
                </>
              ) : null}
            </Card>

            {identity.data.spaces.length > 0 ? (
              <Card>
                <Heading>Accès</Heading>
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

            <Button label="Déconnexion" onPress={signOut} variant="ghost" />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
