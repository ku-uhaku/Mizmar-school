"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";

import { failure, type ActionState } from "@/lib/action-state";
import { recordEvent } from "@/lib/audit";
import { preferenceCookieOptions } from "@/lib/cookies";
import { getAuthContext } from "@/lib/dal";
import {
  serializeUiPrefs,
  UI_PREFS_COOKIE,
  normalizeUiPrefs,
} from "@/modules/appearance/prefs";
import {
  accountMayOpenWebApp,
  checkCredentials,
  signIn,
  signOut,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { SESSION_ENTITY } from "@/modules/audit/enums";
import { fieldErrors } from "@/lib/validation";
import { field, withActionErrors } from "@/lib/server-action";

/**
 * On successful login, copy the user's stored language and appearance into
 * cookies so the very first authenticated render is already in their
 * preferences rather than the previous visitor's.
 */
async function applyStoredPreferences(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return;

  const store = await cookies();
  const options = await preferenceCookieOptions();

  if (isLocale(profile.locale)) {
    store.set(LOCALE_COOKIE, profile.locale, options);
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
    options,
  );
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = await getDictionary();

  /*
    A plain required string, deliberately not `z.email()`.

    Staff sign in with a username now, so validating the box as an email would
    refuse `k.bennis` before it ever reached the database. What was typed is
    only ever an *identifier* here; which column it is looked up in is decided
    in `checkCredentials`, and whether it matches anything is decided by the
    row. Nothing is gained by guessing at the shape first — a malformed address
    and a username nobody holds deserve the same answer, and giving them the
    same answer is also what stops the form telling a stranger which accounts
    exist.
  */
  const schema = z.object({
    identifier: z.string().trim().min(1, { error: t.validation.required }),
    password: z.string().min(1, { error: t.validation.required }),
  });

  const parsed = schema.safeParse({
    identifier: field(formData, "identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return failure(undefined, fieldErrors(parsed.error));
  }

  const result = await withActionErrors(async () => {
    const check = await checkCredentials(
      parsed.data.identifier,
      parsed.data.password,
    );

    if (!check.ok) {
      if (check.reason === "throttled") {
        // Rounded up so the message never reads "try again in 0 minutes".
        return failure(
          interpolate(t.auth.tooManyAttempts, {
            minutes: Math.ceil(check.retryAfterSeconds / 60),
          }),
        );
      }
      return failure(
        check.reason === "disabled"
          ? t.auth.accountDisabled
          : t.auth.invalidCredentials,
      );
    }

    /*
      The password was right and this surface is still not theirs.

      Said plainly rather than folded into `invalidCredentials`: a teacher
      typing their correct password into the wrong app deserves to be told which
      app is theirs, and there is nothing to protect by being vague — whoever is
      typing has already proved the account is theirs. Auth.js refuses the same
      account in its own `authorize`, so this message is the courtesy and that
      is the gate.
    */
    if (!(await accountMayOpenWebApp(check.userId))) {
      return failure(t.auth.mobileOnlyAccount);
    }

    await applyStoredPreferences(check.userId);

    // Auth.js re-verifies the credentials in its own `authorize` callback.
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirect: false,
    });

    return { status: "success" as const };
  });

  if (result.status !== "success") return result;

  // Outside the try/catch above: redirect works by throwing.
  //
  // The callback comes from the query string, so it is only ever a path inside
  // this app — see lib/safe-redirect.ts for why a leading slash is not enough
  // to establish that.
  redirect(safeCallbackPath(field(formData, "callbackUrl")));
}

export async function logoutAction(): Promise<void> {
  // Before the sign-out, while there is still a session for the trail to name.
  // Silent when nobody is signed in: a logout with no session is a stale tab,
  // not an event.
  const context = await getAuthContext();
  if (context) {
    await recordEvent({
      action: "LOGOUT",
      entity: SESSION_ENTITY,
      entityId: context.user.id,
      entityLabel: context.user.email,
    });
  }

  await signOut({ redirectTo: "/login" });
}
