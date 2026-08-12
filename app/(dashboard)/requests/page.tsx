import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { RequestsManager } from "@/modules/requests/components/requests-manager";
import { CLOSED_STATUSES } from "@/modules/requests/enums";
import { listRequests, requestSummary } from "@/modules/requests/queries";

export const metadata: Metadata = { title: "Demandes de documents" };

/**
 * The guichet's queue: papers families have asked for.
 *
 * Thin, like every route — authorize, call the module's queries, render. The
 * two lists are fetched separately rather than filtered on the client: the
 * archive of a school that has run for three years is thousands of rows, and
 * none of them belong in the payload of a screen showing eleven open requests.
 */
export default async function RequestsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.REQUEST_VIEW)) {
    return <ForbiddenState />;
  }

  const [open, summary, ...closedLists] = await Promise.all([
    listRequests(context),
    requestSummary(context),
    ...CLOSED_STATUSES.map((status) => listRequests(context, { status })),
  ]);

  // Newest first: the archive is only ever read backwards, looking for one
  // thing that happened recently.
  const closed = closedLists
    .flat()
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return (
    <>
      <PageHeader title={t.request.title} description={t.request.subtitle} />

      <RequestsManager
        open={open}
        closed={closed}
        summary={summary}
        canHandle={context.can(PERMISSIONS.REQUEST_HANDLE)}
      />
    </>
  );
}
