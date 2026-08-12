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
  /**
   * The id of the last row already shown. Everything older than it comes next.
   *
   * An id and not a timestamp: two notifications raised by the same fan-out
   * share a `createdAt` to the millisecond — a class's worth of guardians are
   * written in one transaction — so paging on the date alone would either
   * repeat that whole batch or skip past it, depending which comparison was
   * used. See the tiebreaker on `orderBy`.
   */
  cursor?: string | null;
};

/** This account's notifications, newest first. */
export async function listInbox(
  context: AuthContext,
  options: InboxOptions = {},
): Promise<NotificationItem[]> {
  return (await pageOf(context, options)).items;
}

/**
 * One page, and where the next one starts.
 *
 * ── Why the cursor comes off the raw rows ───────────────────────────────────
 * `toItem` drops any row whose kind this build has never heard of, so the list
 * handed back can be shorter than the page that produced it. Deciding "is there
 * more" from the *rendered* length would then end the list early — an old app
 * against a newer server would scroll to a wall it could not get past, at the
 * first unknown kind rather than at the end of the inbox. Both answers come
 * from what the database returned, not from what survived rendering.
 */
async function pageOf(
  context: AuthContext,
  options: InboxOptions,
): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const limit = options.limit ?? INBOX_PAGE_SIZE;

  const rows = await db.notification.findMany({
    where: {
      userId: context.user.id,
      organizationId: context.organization.id,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    // `id` breaks ties, and must: cuids are monotonic, so within one fan-out's
    // shared millisecond it still gives a total order — which is what makes a
    // cursor land in exactly one place.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    // `skip: 1` because the cursor row is the last one already on screen.
    ...(options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {}),
    select: ITEM_SELECT,
  });

  return {
    items: rows
      .map(toItem)
      .filter((item): item is NotificationItem => item !== null),
    // A full page means there may be more; a short one is the end of the list.
    nextCursor:
      rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null,
  };
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
  /**
   * Pass back as `cursor` to get the next page, or null at the end of the list.
   *
   * Decided by whether the page came back *full* rather than by counting the
   * rows behind it: a `count` on every scroll to answer "is there more" costs
   * as much as the page itself, and the one case it gets wrong — a total that
   * is an exact multiple of the page size — costs one empty request that
   * settles it.
   */
  nextCursor: string | null;
};

export async function loadInbox(
  context: AuthContext,
  options: InboxOptions = {},
): Promise<Inbox> {
  const [page, unread] = await Promise.all([
    pageOf(context, options),
    unreadCount(context),
  ]);

  return { ...page, unread };
}
