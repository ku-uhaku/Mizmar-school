import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { EventsManager } from "@/modules/events/components/events-manager";
import { listAudienceChoices, listEvents } from "@/modules/events/queries";

export const metadata: Metadata = { title: "Événements" };

/**
 * The school's announcements for the year in context.
 *
 * Thin, as every page is: authorize, call the module's queries, render. The
 * three permissions are read here and handed down, so the manager decides what
 * to *draw* while every action re-checks what it may *do* — a button hidden on
 * a page protects nothing on its own.
 */
export default async function EventsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.EVENT_VIEW)) {
    return <ForbiddenState />;
  }

  const [events, audience] = await Promise.all([
    listEvents(context),
    listAudienceChoices(context),
  ]);

  return (
    <>
      <PageHeader title={t.event.title} description={t.event.subtitle} />

      <EventsManager
        events={events}
        levels={audience.levels}
        classes={audience.classes}
        permissions={{
          canManage: context.can(PERMISSIONS.EVENT_MANAGE),
          canPublish: context.can(PERMISSIONS.EVENT_PUBLISH),
          canDelete: context.can(PERMISSIONS.EVENT_DELETE),
        }}
      />
    </>
  );
}
