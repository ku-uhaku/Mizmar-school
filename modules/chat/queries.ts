import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolYearId, schoolScope } from "@/lib/scope";

/**
 * Reads for the moderation screen.
 *
 * Staff only — a parent reads the same conversations through
 * `modules/portal/queries.ts`, scoped on the household. The difference is not
 * cosmetic: this one can see removed messages, and that is exactly what it is
 * for.
 */

export type ChatChannelRow = {
  id: string;
  kind: string;
  /** The class's name for a CLASS channel, null for the general one. */
  className: string | null;
  isArchived: boolean;
  messageCount: number;
  /** ISO, or null when nobody has posted. */
  lastMessageAt: string | null;
};

export async function listChannels(
  context: AuthContext,
): Promise<ChatChannelRow[]> {
  const channels = await db.chatChannel.findMany({
    where: {
      ...schoolScope(context),
      schoolYearId: currentSchoolYearId(context),
    },
    // The general channel first, then classes by name: the school-wide one is
    // the one a moderator checks without being asked to.
    orderBy: [{ kind: "asc" }, { schoolClass: { code: "asc" } }],
    select: {
      id: true,
      kind: true,
      isArchived: true,
      schoolClass: { select: { name: true, code: true } },
      _count: { select: { messages: { where: { deletedAt: null } } } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return channels.map((channel) => ({
    id: channel.id,
    kind: channel.kind,
    className: channel.schoolClass
      ? channel.schoolClass.name || channel.schoolClass.code
      : null,
    isArchived: channel.isArchived,
    messageCount: channel._count.messages,
    lastMessageAt: channel.messages[0]?.createdAt.toISOString() ?? null,
  }));
}

export type ChatMessageRow = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  /** Set when a moderator removed it — see the note on the column. */
  deletedAt: string | null;
  deletedByName: string | null;
};

function displayName(user: {
  username: string;
  profile: { firstName: string; lastName: string } | null;
} | null): string {
  if (!user) return "—";
  if (!user.profile) return user.username;
  return (
    `${user.profile.firstName} ${user.profile.lastName}`.trim() || user.username
  );
}

/**
 * One channel's messages, removed ones included.
 *
 * A moderator has to be able to see what was removed — otherwise "was this
 * dealt with?" is a question the screen cannot answer, and the same message
 * gets reported twice.
 */
export async function listMessages(
  context: AuthContext,
  channelId: string,
  { limit = 100 }: { limit?: number } = {},
): Promise<ChatMessageRow[] | null> {
  const channel = await db.chatChannel.findFirst({
    where: { id: channelId, ...schoolScope(context) },
    select: { id: true },
  });
  if (!channel) return null;

  const messages = await db.chatMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      deletedAt: true,
      author: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      deletedBy: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    authorName: displayName(message.author),
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt?.toISOString() ?? null,
    deletedByName: message.deletedBy ? displayName(message.deletedBy) : null,
  }));
}
