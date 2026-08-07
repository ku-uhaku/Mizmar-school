"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { withActionErrors } from "@/lib/server-action";
import {
  deleteMessage,
  setChannelArchived,
} from "@/modules/chat/service";

/**
 * Actions for the parents' space — the staff half of it.
 *
 * Parents post from the phone, through `app/api/mobile/v1`, because a Server
 * Function needs a session cookie and the app carries a bearer token. Nothing
 * here is reachable by a parent: every action asserts `CHAT_MODERATE`, and the
 * school comes from the working context rather than from the request.
 */

async function currentScope() {
  const t = await getDictionary();
  const context = await requireAuth();
  return { t, context, schoolId: context.currentSchool?.id ?? null };
}

export async function deleteMessageAction(
  messageId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CHAT_MODERATE);

    const removed = await deleteMessage(messageId, schoolId, context.user.id);
    if (!removed) return failure(t.errors.notFound);

    refresh();
    return success(t.chat.deleted);
  });
}

export async function setChannelArchivedAction(
  channelId: string,
  isArchived: boolean,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.CHAT_MODERATE);

    const changed = await setChannelArchived(channelId, schoolId, isArchived);
    if (!changed) return failure(t.errors.notFound);

    refresh();
    return success(isArchived ? t.chat.archived_ : t.chat.reopened);
  });
}
