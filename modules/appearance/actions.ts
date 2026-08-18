"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";

import {
  normalizeUiPrefs,
  serializeUiPrefs,
  UI_PREFS_COOKIE,
  type UiPrefs,
} from "@/modules/appearance/prefs";
import { preferenceCookieOptions } from "@/lib/cookies";
import { getAuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

/**
 * Persists appearance preferences.
 *
 * The cookie is what the next server render reads (so there is no theme flash);
 * the profile row is the durable copy that follows the user across devices.
 * Works signed-out too — the cookie is set either way, which is what the login
 * page needs.
 */
export async function saveAppearanceAction(input: UiPrefs): Promise<void> {
  const prefs = normalizeUiPrefs(input);

  const store = await cookies();
  store.set(
    UI_PREFS_COOKIE,
    serializeUiPrefs(prefs),
    await preferenceCookieOptions(),
  );

  const context = await getAuthContext();
  if (!context) return;

  await db.profile.updateMany({
    where: { userId: context.user.id },
    data: {
      themeMode: prefs.mode,
      accent: prefs.accent,
      fontFamily: prefs.fontFamily,
      fontSize: prefs.fontSize,
      radius: prefs.radius,
    },
  });
}

/**
 * Switches the interface language. Unlike appearance, this changes what the
 * server renders, so the router is refreshed to pull the new dictionary.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, await preferenceCookieOptions());

  const context = await getAuthContext();
  if (context) {
    await db.profile.updateMany({
      where: { userId: context.user.id },
      data: { locale },
    });
  }

  refresh();
}
