"use client";

import Link from "next/link";
import * as React from "react";
import { BellOffIcon } from "lucide-react";

import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/empty-state";
import { formatDateTime, interpolate } from "@/lib/i18n/format";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import { describeNotification } from "@/modules/notifications/describe";
import type { NotificationItem } from "@/modules/notifications/queries";
import type { NotificationTone } from "@/modules/notifications/enums";

/**
 * The whole inbox, on its own screen.
 *
 * A client component over a server-rendered list: the rows are read on the
 * server and passed in, and only the two decisions a reader makes here — "I
 * have read this one", "I have read all of them" — need the client. So a hard
 * refresh always shows the truth, and there is no loading state to design.
 *
 * ── Unread is a filter, not a separate list ─────────────────────────────────
 * The obvious layout puts unread at the top and read underneath. It is wrong
 * for this data: a notification's whole meaning is *when* it happened, and a
 * list that is chronological except where it is not makes a reader hunt for
 * something they saw an hour ago. One list in date order, with a filter.
 */

const TONE_DOTS: Record<NotificationTone, string> = {
  info: "bg-primary",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
};

export function NotificationInbox({
  items,
  unread,
}: {
  items: NotificationItem[];
  unread: number;
}) {
  const t = useT();
  const locale = useLocale();

  const [onlyUnread, setOnlyUnread] = React.useState(false);
  // Read state is held here as well as on the server so a row dims the moment
  // it is pressed. The server list stays the source of truth on reload.
  const [readLocally, setReadLocally] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  const isRead = (item: NotificationItem) =>
    item.isRead || readLocally.has(item.id);

  const remaining = Math.max(
    0,
    unread - items.filter((item) => !item.isRead && readLocally.has(item.id)).length,
  );

  const markRead = (item: NotificationItem) => {
    if (isRead(item)) return;
    setReadLocally((current) => new Set(current).add(item.id));
    startTransition(async () => {
      await markNotificationReadAction(item.id);
    });
  };

  const markAllRead = () => {
    setReadLocally(new Set(items.map((item) => item.id)));
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const shown = onlyUnread ? items.filter((item) => !isRead(item)) : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant={onlyUnread ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setOnlyUnread(false)}
          >
            {t.notification.filterAll}
          </Button>
          <Button
            variant={onlyUnread ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setOnlyUnread(true)}
          >
            {remaining > 0
              ? interpolate(t.notification.unread, { count: remaining })
              : t.notification.filterUnread}
          </Button>
        </div>

        {remaining > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={pending}
          >
            {t.notification.markAllRead}
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<BellOffIcon />}
          title={onlyUnread ? t.notification.emptyUnread : t.notification.empty}
          description={onlyUnread ? undefined : t.notification.emptyHint}
        />
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {shown.map((item) => {
            const read = isRead(item);
            const line = describeNotification(item, t, locale);

            const row = (
              <div className="flex w-full min-w-0 items-start gap-3 px-4 py-3 text-start">
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    read ? "bg-muted-foreground/30" : TONE_DOTS[item.tone]
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm leading-snug ${
                      read ? "text-muted-foreground" : "font-medium"
                    }`}
                  >
                    {line}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(item.createdAt, locale)}
                  </span>
                </span>
              </div>
            );

            return (
              <li key={item.id} className={read ? undefined : "bg-muted/30"}>
                {/*
                  A line with somewhere to go is a link, and one without is a
                  button that only marks it read — rather than a link to "#",
                  which lands a keyboard user somewhere they did not ask to be.
                */}
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => markRead(item)}
                    className="hover:bg-accent/50 block"
                  >
                    {row}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markRead(item)}
                    disabled={read}
                    className="hover:bg-accent/50 block w-full disabled:hover:bg-transparent"
                    aria-label={read ? undefined : t.notification.markRead}
                  >
                    {row}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
