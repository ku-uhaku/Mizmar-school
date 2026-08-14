"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { changeOwnPassword } from "@/modules/profile/service";
import {
  passwordChangeSchema,
  profileSchema,
} from "@/modules/profile/validation";

/**
 * Both actions operate on the caller's own account only — the user id comes
 * from the session, so there is no id to validate or spoof.
 */

export async function updateOwnProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const parsed = profileSchema(t).safeParse({
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      phone: field(formData, "phone"),

      bio: field(formData, "bio"),
      avatarUrl: field(formData, "avatarUrl"),
      birthDate: field(formData, "birthDate"),
    });

    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    await db.profile.upsert({
      where: { userId: context.user.id },
      create: { userId: context.user.id, ...parsed.data },
      update: parsed.data,
    });

    refresh();
    return success(t.profile.updated);
  });
}

export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const parsed = passwordChangeSchema(t).safeParse({
      currentPassword: formData.get("currentPassword") ?? "",
      newPassword: formData.get("newPassword") ?? "",
      confirmPassword: formData.get("confirmPassword") ?? "",
    });

    if (!parsed.success) {
      return failure(undefined, fieldErrors(parsed.error));
    }

    const result = await changeOwnPassword(context.user.id, {
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });

    if (!result.ok) {
      if (result.reason === "not-found") return failure(t.errors.notFound);
      return failure(undefined, {
        currentPassword: t.profile.wrongCurrentPassword,
      });
    }

    /*
      ── It signs this device out too, and the message says so ────────────────
      The cookie in the browser that just made the change was minted before it,
      so it is one of the credentials now refused — the next navigation lands on
      the sign-in screen. That is the safe way round and not worth engineering
      away, but it is not obvious: somebody who reads "Password changed." and
      then finds themselves at a login box concludes it did not take, and tries
      the old one. So the message tells them, rather than the app pretending
      nothing happened.

      Keeping the seat would mean re-stamping the session cookie through
      next-auth's `unstable_update` and handling `trigger === "update"` in the
      jwt callback. Worth doing when that API stops being unstable; until then
      a failure there would leave the password changed and the user told
      otherwise, which is the worse trade.

      The native app has no such problem: it re-issues its tokens from the new
      stamp in the same response (app/api/mobile/v1/me/password).
    */
    return success(t.profile.passwordChanged);
  });
}
