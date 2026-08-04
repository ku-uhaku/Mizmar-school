import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiError } from "../src/api/client";

/**
 * The app shell.
 *
 * One QueryClient for the whole app, created in state so a fast refresh does
 * not throw the cache away mid-session.
 */
export default function RootLayout() {
  const scheme = useColorScheme();

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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
