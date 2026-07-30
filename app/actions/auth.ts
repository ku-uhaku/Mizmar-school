"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";

import { failure, type ActionState } from "@/lib/action-state";
import { serializeUiPrefs, UI_PREFS_COOKIE, normalizeUiPrefs } from "@/lib/appearance";
import { checkCredentials, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { fieldErrors } from "@/lib/validation/common";
import { field, withActionErrors } from "@/lib/server-action";

const ONE_YEAR = 60 * 60 * 24 * 365;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: ONE_YEAR,
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * On successful login, copy the user's stored language and appearance into
 * cookies so the very first authenticated render is already in their
 * preferences rather than the previous visitor's.
 */
async function applyStoredPreferences(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return;

  const store = await cookies();

  if (isLocale(profile.locale)) {
    store.set(LOCALE_COOKIE, profile.locale, COOKIE_OPTIONS);
  }

  store.set(
    UI_PREFS_COOKIE,
    serializeUiPrefs(
      normalizeUiPrefs({
        mode: profile.themeMode,
        accent: profile.accent,
        fontFamily: profile.fontFamily,
        fontSize: profile.fontSize,
        radius: profile.radius,
      }),
    ),
    COOKIE_OPTIONS,
  );
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getDictionary();

  const schema = z.object({
    email: z.email({ error: t.validation.email }),
    password: z.string().min(1, { error: t.validation.required }),
  });

  const parsed = schema.safeParse({
    email: field(formData, "email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failure(undefined, fieldErrors(parsed.error));
  }

  const result = await withActionErrors(async () => {
    const check = await checkCredentials(parsed.data.email, parsed.data.password);

    if (!check.ok) {
      return failure(
        check.reason === "disabled"
          ? t.auth.accountDisabled
          : t.auth.invalidCredentials,
      );
    }

    await applyStoredPreferences(check.userId);

    // Auth.js re-verifies the credentials in its own `authorize` callback.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    return { status: "success" as const };
  });

  if (result.status !== "success") return result;

  // Outside the try/catch above: redirect works by throwing.
  const callbackUrl = field(formData, "callbackUrl");
  redirect(callbackUrl.startsWith("/") ? callbackUrl : "/");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
