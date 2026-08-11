import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiError } from "../src/api/client";
import { LocaleProvider } from "../src/i18n";
import { useTheme } from "../src/ui/theme";

/**
 * The app shell.
 *
 * One QueryClient for the whole app, created in state so a fast refresh does
 * not throw the cache away mid-session. `LocaleProvider` sits outside
 * everything else — it is what every screen's `useT()` and `useFormat()`
 * ultimately read from, and it is also what applies the phone's reading
 * direction, so it has to be mounted before anything it wraps first renders.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A phone on school wifi drops in and out of range constantly.
            // Two retries, but never on a refusal: a 401 has already been
            // through the refresh path in `api()`, and a 403 will not become a
            // 200 by being asked again.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          {/*
            The header is painted from the app's own palette rather than left to
            React Navigation's defaults. Its light theme is near-white and its
            dark theme is a grey that is neither of ours, so a screen with a
            header used to have a title bar in one colour scheme and a body in
            another — most obviously in dark mode, where the bar stayed pale.

            Set once on the Stack so no screen has to remember: every
            `Stack.Screen` in the app inherits it.
          */}
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: { backgroundColor: theme.card },
              headerTintColor: theme.primary,
              headerTitleStyle: { color: theme.text },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          />
        </SafeAreaProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
