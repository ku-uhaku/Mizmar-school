/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/chat/*.prisma`. Labels live in `i18n/*.ts` under
 * `chatOptions`.
 *
 * Pure data: this crosses to the client and to the phone's DTO mirror.
 */

import { nullableKey } from "@/lib/db-keys";

/**
 * Who a channel is between.
 *
 *   GENERAL  every parent in the school
 *   CLASS    the parents of one class
 *
 * Two and no more. A school that wants "the parents of 3AP" across its three
 * classes is asking for a level channel, and the honest answer is that nobody
 * has asked for one — adding it later is a value and a nullable column, not a
 * redesign.
 */
export const CHANNEL_KINDS = ["GENERAL", "CLASS"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

/**
 * Builds `ChatChannel.generalKey`, which is what stops a year having two
 * school-wide channels.
 *
 * The year id when the channel is GENERAL, null otherwise — so SQLite's "NULLs
 * are distinct" behaviour exempts every class channel from the unique index
 * while admitting only one general one. See lib/db-keys.ts for the pattern.
 */
export function generalChannelKey(
  schoolYearId: string,
  kind: string,
): string | null {
  return kind === "GENERAL" ? nullableKey(schoolYearId) : null;
}

/** The longest thing a parent may post. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Whether a message is still standing.
 *
 * Moderation is a soft delete — see the note on `ChatMessage.deletedAt` — so
 * every read has to say which it wants, and saying it here means the reads
 * cannot disagree about what "deleted" means.
 */
export function isLive(message: { deletedAt: Date | null }): boolean {
  return message.deletedAt === null;
}
