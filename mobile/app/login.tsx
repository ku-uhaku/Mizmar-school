import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, login } from "../src/api/client";
import { interpolate, useT } from "../src/i18n";
import { Body, Button, ErrorNote, Title } from "../src/ui/components";
import { radius, spacing, useTheme } from "../src/ui/theme";

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await login(identifier.trim(), password);
      router.replace("/home");
    } catch (caught) {
      // The server's own message, which is already the localised one and
      // already says the same thing for a wrong password as for an unknown
      // username. The one worth expanding on is the lockout, which has a number
      // attached the parent needs.
      if (caught instanceof ApiError && caught.retryAfterSeconds) {
        const minutes = Math.ceil(caught.retryAfterSeconds / 60);
        setError(interpolate(t.login.tooManyAttempts, { minutes }));
      } else if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError(t.common.serverUnreachable);
      }
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    color: theme.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.xl,
          paddingTop: insets.top + spacing.xl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
          <Title>{t.login.title}</Title>
          <Body muted>{t.login.tagline}</Body>
        </View>

        {error ? <ErrorNote message={error} /> : null}

        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {t.login.identifierLabel}
          </Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            style={inputStyle}
            placeholder={t.login.identifierPlaceholder}
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            // `default`, not `email-address`: the keyboard's `@` key is no use
            // for a username and its layout hides the dot.
            keyboardType="default"
            textContentType="username"
            returnKeyType="next"
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {t.login.passwordLabel}
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={inputStyle}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </View>

        <Button
          label={t.login.submit}
          onPress={submit}
          busy={busy}
          disabled={!identifier.trim() || !password}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
