"use client";

import Link from "next/link";
import * as React from "react";
import { BellIcon } from "lucide-react";

import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime, interpolate } from "@/lib/i18n/format";
import {
  loadInboxAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import { describeNotification } from "@/modules/notifications/describe";
import { BADGE_CAP } from "@/modules/notifications/enums";
import type { Inbox } from "@/modules/notifications/queries";

/**
 * The header bell.
 *
 * ── Polled, not pushed ──────────────────────────────────────────────────────
 * There is no socket and no stream. A notification here is never urgent in the
 * sense that a minute matters — the paper is ready, the bulletin is out — and a
 * persistent connection per open tab is a real cost to run for a school on a
 * shared host. So the count is re-read on a timer, when the tab comes back to
 * the front, and whenever the menu is opened.
 *
 * The timer stops while the tab is hidden. Without that, a dashboard left open
 * on a spare screen over a weekend would make several thousand pointless
 * round trips, and would wake the database to answer every one of them.
 *
 * ── Why the first count comes from the server, and only the count ───────────
 * `initialUnread` is read in the layout and passed down, so the badge is right
 * in the first paint. Fetching it on mount instead would show every reader a
 * bell with no dot for a moment and then pop one in, which reads as a
 * notification having just arrived when it has been sitting there since
 * Tuesday.
 *
 * The *list* is deliberately not fetched there. It is invisible until somebody
 * opens the menu, and the menu reloads on open regardless — so reading it in
 * the layout put a second query on every page render of the whole app to
 * prepare a dropdown almost nobody opens. The badge is the only part that has
 * to be right before a click, and one `count` answers it.
 */

/** How often the count is re-read while somebody is actually looking. */
const POLL_MS = 60_000;

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const t = useT();
  const locale = useLocale();

  // Items start empty and arrive on first open; the count is server-rendered.
  const [inbox, setInbox] = React.useState<Inbox>({
    items: [],
    unread: initialUnread,
    nextCursor: null,
  });
  const [loaded, setLoaded] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const reload = React.useCallback(() => {
    // A failed poll leaves the last good answer on screen. The bell is not
    // worth an error state: the next tick will either fix it or the reader will
    // open the page, which renders on the server and cannot be stale.
    loadInboxAction()
      .then((fresh) => {
        setInbox(fresh);
        setLoaded(true);
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) timer = setInterval(reload, POLL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Coming back to the tab is the moment the count is most likely wrong,
        // so read once immediately rather than waiting out a whole interval.
        reload();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload]);

  const unread = inbox.unread;

  const markRead = (notificationId: string) => {
    // Optimistic: the line is already open in front of them, and waiting for a
    // round trip before the dot goes out makes the click feel broken.
    setInbox((current) => ({
      ...current,
      unread: Math.max(0, current.unread - 1),
      items: current.items.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item,
      ),
    }));
    startTransition(async () => {
      await markNotificationReadAction(notificationId);
    });
  };

  const markAllRead = () => {
    setInbox((current) => ({
      ...current,
      unread: 0,
      items: current.items.map((item) => ({ ...item, isRead: true })),
    }));
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) reload();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0
              ? interpolate(t.notification.bellUnread, { count: unread })
              : t.notification.bell
          }
        >
          <BellIcon />
          {/* Silent at zero: a bell showing a nought teaches people not to read
            bells. The count is announced through the label above, so nothing
            here needs reading by a screen reader. */}
          {unread > 0 ? (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
            >
              {unread > BADGE_CAP ? `${BADGE_CAP}+` : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>{t.notification.title}</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground text-xs font-normal underline-offset-2 hover:underline disabled:opacity-50"
            >
              {t.notification.markAllRead}
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {inbox.items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            {/* Before the first answer comes back there is nothing to say yet —
              claiming the inbox is empty would be a guess, and a wrong one for
              anyone whose badge is showing a number. */}
            {loaded ? t.notification.empty : "…"}
          </p>
        ) : (
          inbox.items.map((item) => {
            const line = describeNotification(item, t, locale);
            const body = (
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span
                  className={`w-full text-start text-sm leading-snug text-wrap ${
                    item.isRead ? "text-muted-foreground" : "font-medium"
                  }`}
                >
                  {line}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDateTime(item.createdAt, locale)}
                </span>
              </span>
            );

            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => markRead(item.id)}
                className="items-start gap-2"
                asChild={item.href !== null}
              >
                {item.href ? (
                  <Link href={item.href}>
                    <UnreadDot isRead={item.isRead} />
                    {body}
                  </Link>
                ) : (
                  <div>
                    <UnreadDot isRead={item.isRead} />
                    {body}
                  </div>
                )}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="justify-center text-sm">
            {t.notification.viewAll}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Holds the row's alignment whether or not there is a dot to draw. */
function UnreadDot({ isRead }: { isRead: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-1.5 size-2 shrink-0 rounded-full ${
        isRead ? "bg-transparent" : "bg-primary"
      }`}
    />
  );
}
