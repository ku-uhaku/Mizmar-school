import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, changePassword, clearTokens } from "../src/api/client";
import { useIdentity } from "../src/api/hooks";
import { LOCALES, LOCALE_META, useLocale, useT } from "../src/i18n";
import {
  Badge,
  Body,
  Button,
  Card,
  Caption,
  Divider,
  ErrorNote,
  Heading,
  Loading,
  Row,
} from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

/** Matches PASSWORD_MIN_LENGTH server-side; the API refuses anything shorter. */
const PASSWORD_MIN_LENGTH = 8;

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

            <PasswordCard />

            <Button label={t.profile.signOut} onPress={signOut} variant="ghost" />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/**
 * Choosing your own password, folded away until asked for.
 *
 * A parent signs in with what the secretary wrote on a slip of paper, which is
 * generated and unmemorable — so the first thing many of them want is to
 * replace it. It stays behind a button because it is a once-ever action on a
 * screen whose everyday job is "which account am I", and three password boxes
 * sitting open would make that screen look like a form.
 *
 * The hint says where a forgotten password comes from, and the answer is the
 * office: there is no self-service recovery, the school reissues one from the
 * dossier (`family.portal`). Saying so here is what stops a parent locking
 * themselves out and assuming the app has abandoned them.
 */
function PasswordCard() {
  const theme = useTheme();
  const t = useT();

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    color: theme.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  } as const;

  const submit = async () => {
    setError(null);

    // Checked here as well as on the server because the server never sees the
    // confirmation field — it is a question about what the user typed twice.
    if (next !== confirm) {
      setError(t.profile.passwordMismatch);
      return;
    }
    if (next.length < PASSWORD_MIN_LENGTH) {
      setError(t.profile.passwordRule);
      return;
    }

    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setOpen(false);
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "wrong_password") {
        setError(t.profile.wrongCurrentPassword);
      } else if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError(t.common.serverUnreachable);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Heading>{t.profile.password}</Heading>

      {done ? <Body muted>{t.profile.passwordChanged}</Body> : null}

      {open ? (
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <Caption>{t.profile.passwordHint}</Caption>

          {error ? <ErrorNote message={error} /> : null}

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {t.profile.currentPassword}
            </Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              style={inputStyle}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {t.profile.newPassword}
            </Text>
            <TextInput
              value={next}
              onChangeText={setNext}
              style={inputStyle}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <Caption>{t.profile.passwordRule}</Caption>
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {t.profile.confirmPassword}
            </Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              style={inputStyle}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          <Button
            label={t.profile.changePassword}
            onPress={submit}
            busy={busy}
            disabled={!current || !next || !confirm}
          />
          <Button
            label={t.common.cancel}
            onPress={() => {
              setOpen(false);
              setError(null);
              setCurrent("");
              setNext("");
              setConfirm("");
            }}
            variant="ghost"
          />
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label={t.profile.changePassword}
            onPress={() => {
              setDone(false);
              setOpen(true);
            }}
            variant="ghost"
          />
        </View>
      )}
    </Card>
  );
}
