"use server";

import { refresh } from "next/cache";

import { success, type ActionState } from "@/lib/action-state";
import { requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { withActionErrors } from "@/lib/server-action";
import { loadInbox, type Inbox } from "@/modules/notifications/queries";

/**
 * Actions for the notifications module.
 *
 * ── The authorization is the `where` clause ─────────────────────────────────
 * There is no permission code to assert — see module.ts. What stops one account
 * clearing another's inbox is that `userId` is taken from the session and put
 * in the `where`, never taken from the request. A crafted id therefore matches
 * no rows and the action reports success over nothing, which is the right
 * answer: whether that id exists is not the caller's business.
 *
 * `updateMany` rather than `update` throughout, for the same reason — `update`
 * by id would have to read the row first to check whose it is, and would throw
 * where matching nothing is the correct outcome.
 */

/**
 * The bell's poll.
 *
 * A Server Function rather than a route handler so it goes through the same
 * `requireAuth` as everything else, and so the DTO stays the module's own
 * rather than becoming a public JSON shape. The phone has its own endpoint —
 * it cannot send a session cookie — and both call the same query.
 */
export async function loadInboxAction(): Promise<Inbox> {
  const context = await requireAuth();
  return loadInbox(context, { limit: 8 });
}

/**
 * Stamps one as read.
 *
 * `readAt: null` is in the `where` as well as the id, so opening the same line
 * twice does not move the timestamp — when you first read it is the fact worth
 * keeping, not when you last looked at it.
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const context = await requireAuth();

    await db.notification.updateMany({
      where: {
        id: notificationId,
        userId: context.user.id,
        organizationId: context.organization.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    refresh();
    return success();
  });
}

/** Clears the whole inbox's unread state. */
export async function markAllNotificationsReadAction(): Promise<ActionState> {
  return withActionErrors(async () => {
    const context = await requireAuth();
    const t = await getDictionary();

    await db.notification.updateMany({
      where: {
        userId: context.user.id,
        organizationId: context.organization.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    refresh();
    return success(t.notification.markedAllRead);
  });
}
