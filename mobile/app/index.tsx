import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { hasSession } from "../src/api/client";
import { Loading } from "../src/ui/components";
import { useTheme } from "../src/ui/theme";

/**
 * The gate.
 *
 * Only asks whether a refresh token is on the device — not whether it is still
 * good. Validating it here would put a network round trip in front of the
 * splash screen; instead the first real request finds out, and `api()` sends
 * the user back here if it has expired.
 */
export default function Index() {
  const theme = useTheme();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    hasSession().then((result) => {
      if (active) setSignedIn(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (signedIn === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center" }}>
        <Loading />
      </View>
    );
  }

  return <Redirect href={signedIn ? "/home" : "/login"} />;
}
