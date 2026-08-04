import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the tokens are kept.
 *
 * On a phone that is the Keychain / Keystore, through expo-secure-store. On web
 * there is no such thing — `expo-secure-store` is a native module and calling
 * it in a browser throws, which is what makes the app fail on the very first
 * screen when opened at localhost:8081.
 *
 * The web branch uses `localStorage` and is **for the development preview
 * only**. A token in localStorage is readable by any script on the origin; the
 * shipped app is the native one, and this exists so a browser can be used to
 * look at the screens without pretending it is a secure client.
 */

const isWeb = Platform.OS === "web";

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // A browser with storage disabled still gets a working session for as
      // long as the tab lives — the in-memory token is enough for that.
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to clear.
    }
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
