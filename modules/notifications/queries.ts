import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  INBOX_PAGE_SIZE,
  KIND_TONES,
  isNotificationKind,
  readParams,
  webHref,
  type NotificationKind,
  type NotificationTone,
} from "@/modules/notifications/enums";

/**
 * Reads for the notifications module.
 *
 * ── The whole scope is one column ───────────────────────────────────────────
 * Every read here is `userId: context.user.id`, plus the tenant as a belt to
 * the braces. There is no permission to check and no school to scope on: you
 * read your own inbox and there is no other one, which is why this module's
 * manifest declares no code at all (see module.ts).
 *
 * The organisation is in the `where` anyway. It cannot currently differ from
 * the user's — an account belongs to one org — but writing the scope out means
 * the day somebody is moved between organisations, their old inbox does not
 * follow them.
 */

/** One line of the inbox. The phone mirrors this in mobile/src/api/types.ts. */
export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  /** Substitution values for the label — the client does the wording. */
  params: Record<string, string>;
  subjectId: string | null;
  studentId: string | null;
  tone: NotificationTone;
  /** Where it opens on the web dashboard. Null for the family-facing kinds. */
  href: string | null;
  isRead: boolean;
  /** ISO. Formatted by whichever client is showing it, in its own locale. */
  createdAt: string;
};

type Row = {
  id: string;
  kind: string;
  params: string;
  subjectId: string | null;
  studentId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Shapes a row into the DTO both clients read.
 *
 * In one place so the bell, the page and the phone cannot drift about what a
 * notification *is* — and so a kind the running code has never heard of, which
 * is what a rolled-back deployment looks like, is dropped rather than rendered
 * as a line with no words in it.
 */
function toItem(row: Row): NotificationItem | null {
  if (!isNotificationKind(row.kind)) return null;

  return {
    id: row.id,
    kind: row.kind,
    params: readParams(row.params),
    subjectId: row.subjectId,
    studentId: row.studentId,
    tone: KIND_TONES[row.kind],
    href: webHref(row.kind, { subjectId: row.subjectId }),
    isRead: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

const ITEM_SELECT = {
  id: true,
  kind: true,
  params: true,
  subjectId: true,
  studentId: true,
  readAt: true,
  createdAt: true,
} as const;

export type InboxOptions = {
  /** Hide what has already been read — the bell's view. */
  unreadOnly?: boolean;
  limit?: number;
};

/** This account's notifications, newest first. */
export async function listInbox(
  context: AuthContext,
  options: InboxOptions = {},
): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: {
      userId: context.user.id,
      organizationId: context.organization.id,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: options.limit ?? INBOX_PAGE_SIZE,
    select: ITEM_SELECT,
  });

  return rows
    .map(toItem)
    .filter((item): item is NotificationItem => item !== null);
}

/** What the bell draws. Counted rather than listed — it is one integer. */
export async function unreadCount(context: AuthContext): Promise<number> {
  return db.notification.count({
    where: {
      userId: context.user.id,
      organizationId: context.organization.id,
      readAt: null,
    },
  });
}

/** The list and the count in one round trip, for the header and the phone. */
export type Inbox = {
  items: NotificationItem[];
  unread: number;
};

export async function loadInbox(
  context: AuthContext,
  options: InboxOptions = {},
): Promise<Inbox> {
  const [items, unread] = await Promise.all([
    listInbox(context, options),
    unreadCount(context),
  ]);

  return { items, unread };
}
