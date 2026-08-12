import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { NotificationInbox } from "@/modules/notifications/components/notification-inbox";
import { loadInbox } from "@/modules/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

/**
 * This account's inbox.
 *
 * The one screen in the app with no permission check above it, and the reason
 * is in modules/notifications/module.ts: the scope is `userId`, so there is
 * nothing here that being signed in does not already entitle you to. Every
 * other page reads a school's data and has to ask first.
 */
export default async function NotificationsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  const inbox = await loadInbox(context);

  return (
    <>
      <PageHeader
        title={t.notification.title}
        description={t.notification.subtitle}
      />

      <NotificationInbox items={inbox.items} unread={inbox.unread} />
    </>
  );
}
