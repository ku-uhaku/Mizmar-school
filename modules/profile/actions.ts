"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
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
      jobTitle: field(formData, "jobTitle"),
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

    // Re-read the hash rather than trusting anything from the session payload.
    const user = await db.user.findUnique({
      where: { id: context.user.id },
      select: { passwordHash: true },
    });
    if (!user) return failure(t.errors.notFound);

    const correct = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!correct) {
      return failure(undefined, {
        currentPassword: t.profile.wrongCurrentPassword,
      });
    }

    // Stamped alongside the hash, never separately: lib/dal.ts refuses every
    // credential older than this, which is what signs the user's other devices
    // out. Changing your password is the one action whose whole point is that
    // whoever else had it stops being you.
    await db.user.update({
      where: { id: context.user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        credentialsChangedAt: new Date(),
      },
    });

    return success(t.profile.passwordChanged);
  });
}
