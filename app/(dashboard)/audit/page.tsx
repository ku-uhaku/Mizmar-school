import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ActivityFeed } from "@/modules/audit/components/activity-feed";
import {
  listActivity,
  listActivityActors,
  readableActions,
} from "@/modules/audit/queries";

export const metadata: Metadata = { title: "Journal d'activité" };

/**
 * The trail of everything.
 *
 * Thin by the usual rule: it authorizes, reads, renders. The filters come in
 * through the query string and go straight to the query, which is also where
 * they are constrained — none of them can widen what this reader may see, since
 * the scope is rebuilt from their permissions on every call and the filters
 * only ever narrow it further.
 *
 * `can` rather than `canOrg`: a director holds `audit.view` in their own school
 * and reads their own school's trail. What that means is decided in
 * `listActivity`, not here.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();
  const params = await searchParams;

  if (!context.can(PERMISSIONS.AUDIT_VIEW) && !context.canOrg(PERMISSIONS.AUDIT_VIEW)) {
    return <ForbiddenState />;
  }

  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  const filters = {
    actorId: single("actorId"),
    action: single("action"),
    domain: single("domain"),
    entity: single("entity"),
    entityId: single("entityId"),
    from: single("from"),
    to: single("to"),
    search: single("search"),
    page: Number(single("page") ?? 1) || 1,
  };

  const [page, actors] = await Promise.all([
    listActivity(context, filters),
    listActivityActors(context),
  ]);

  return (
    <>
      <PageHeader title={t.audit.title} description={t.audit.subtitle} />

      <ActivityFeed
        page={page}
        actors={actors}
        actions={readableActions(context)}
        filtered={Object.entries(filters).some(
          ([key, value]) => key !== "page" && value !== undefined,
        )}
      />
    </>
  );
}
