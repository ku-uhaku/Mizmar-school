import "server-only";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Changing your own password, for whichever client asked.
 *
 * The web form and the native app's profile screen both land here rather than
 * each doing their own verify-and-hash: the current-password check and the
 * `credentialsChangedAt` stamp are the security of this operation, and a second
 * copy of them is a second place to get them wrong. The caller's only job is
 * turning the reason into a message its own user can read.
 */

export type PasswordChangeResult =
  | { ok: true; credentialsChangedAt: Date }
  | { ok: false; reason: "not-found" | "wrong-password" };

export async function changeOwnPassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<PasswordChangeResult> {
  // Re-read the hash rather than trusting anything from the session payload.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, reason: "not-found" };

  const correct = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!correct) return { ok: false, reason: "wrong-password" };

  /*
    Stamped alongside the hash, never separately: lib/dal.ts refuses every
    credential older than this, which is what signs the user's other devices
    out. Changing your password is the one action whose whole point is that
    whoever else had it stops being you. It is the same stamp a school's reset
    writes (modules/families/actions.ts), so the two cannot drift.
  */
  const credentialsChangedAt = new Date();
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      credentialsChangedAt,
    },
  });

  return { ok: true, credentialsChangedAt };
}
