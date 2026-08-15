import "server-only";

import { db } from "@/lib/db";
import { generalChannelKey, MAX_MESSAGE_LENGTH } from "@/modules/chat/enums";

/**
 * Writes and data invariants for the parents' space.
 *
 * ── Channels are created on demand, not provisioned ─────────────────────────
 * A school with 24 classes does not want 25 empty channels the moment somebody
 * flicks a switch, and a class created in November would miss the provisioning
 * pass anyway. So a channel comes into being the first time somebody opens it,
 * and `ensureChannel` is idempotent because two parents opening the same class
 * on the same morning is the ordinary case rather than a race worth losing.
 */

export type EnsureChannelInput = {
  schoolId: string;
  schoolYearId: string;
  kind: "GENERAL" | "CLASS";
  /** Required for CLASS, and refused for GENERAL — see the note on the column. */
  schoolClassId: string | null;
};

/**
 * The channel for this school year and class, creating it if it is the first
 * time anybody has looked.
 *
 * Returns null when the shape is wrong rather than throwing: the kind and the
 * class come from a request, and "CLASS with no class" is a crafted call, not a
 * bug worth a stack trace.
 */
export async function ensureChannel(
  input: EnsureChannelInput,
): Promise<{ id: string; isArchived: boolean } | null> {
  // The invariant MySQL cannot express — see the note on
  // `ChatChannel.schoolClassId`.
  if (input.kind === "CLASS" && !input.schoolClassId) return null;
  if (input.kind === "GENERAL" && input.schoolClassId) return null;

  const existing = await db.chatChannel.findFirst({
    where: {
      schoolYearId: input.schoolYearId,
      kind: input.kind,
      schoolClassId: input.schoolClassId,
    },
    select: { id: true, isArchived: true },
  });
  if (existing) return existing;

  try {
    const created = await db.chatChannel.create({
      data: {
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        kind: input.kind,
        schoolClassId: input.schoolClassId,
        generalKey: generalChannelKey(input.schoolYearId, input.kind),
      },
      select: { id: true, isArchived: true },
    });
    return created;
  } catch {
    /*
      Two parents opening the same channel at the same moment: the second loses
      on the unique index, and the right answer is the row the first one made
      rather than an error nobody can act on. Re-read rather than assume, so a
      genuine failure still surfaces as null.
    */
    return db.chatChannel.findFirst({
      where: {
        schoolYearId: input.schoolYearId,
        kind: input.kind,
        schoolClassId: input.schoolClassId,
      },
      select: { id: true, isArchived: true },
    });
  }
}

export type PostResult =
  | { ok: true; id: string }
  | { ok: false; reason: "EMPTY" | "TOO_LONG" | "ARCHIVED" | "NOT_FOUND" };

/**
 * Posts a message, having already established that the author may.
 *
 * The caller decides *whether* — the household scope for a parent, the
 * permission for staff. What this decides is whether the channel will take it:
 * a closed channel stays readable and refuses new messages, which is the whole
 * difference between closing one and deleting it.
 */
export async function postMessage(
  channelId: string,
  authorId: string,
  body: string,
): Promise<PostResult> {
  const trimmed = body.trim();
  if (trimmed === "") return { ok: false, reason: "EMPTY" };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: "TOO_LONG" };
  }

  const channel = await db.chatChannel.findFirst({
    where: { id: channelId },
    select: { id: true, isArchived: true },
  });
  if (!channel) return { ok: false, reason: "NOT_FOUND" };
  if (channel.isArchived) return { ok: false, reason: "ARCHIVED" };

  const message = await db.chatMessage.create({
    data: { channelId, authorId, body: trimmed },
    select: { id: true },
  });
  return { ok: true, id: message.id };
}

/**
 * Removes a message from a parent's view.
 *
 * A soft delete, and the stamp is the point: the school may have to say later
 * what it removed and who removed it. `updateMany` filtered on `deletedAt: null`
 * so a second moderator pressing the same button does not overwrite the first
 * one's name on the removal.
 */
export async function deleteMessage(
  messageId: string,
  schoolId: string,
  deletedById: string,
): Promise<boolean> {
  const removed = await db.chatMessage.updateMany({
    where: {
      id: messageId,
      deletedAt: null,
      // Scoped through the channel rather than trusted: a message id from a
      // request must not reach another school's conversation.
      channel: { schoolId },
    },
    data: { deletedAt: new Date(), deletedById },
  });
  return removed.count > 0;
}

/** Closes a channel to new messages, or reopens it. Readable either way. */
export async function setChannelArchived(
  channelId: string,
  schoolId: string,
  isArchived: boolean,
): Promise<boolean> {
  const updated = await db.chatChannel.updateMany({
    where: { id: channelId, schoolId },
    data: { isArchived },
  });
  return updated.count > 0;
}
